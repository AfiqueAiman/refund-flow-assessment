import { delay, http, HttpResponse } from 'msw'
import type {
  ApiErrorBody,
  ApiErrorCode,
  CreateRefundRequest,
  CreateRefundResponse,
  OrderDto,
  RefundQuoteRequest,
  RefundQuoteResponse,
  UnitDto,
} from '../api/contracts'
import { REFUND_CHANNELS, REFUND_REASONS } from '../domain/types'
import { mockConfig } from './config'
import { getDb, saveDb } from './db'

/**
 * A stand-in for the refunds service. Pricing and validation here are written
 * independently of the frontend preview on purpose: the server is the source of
 * truth and only trusts ids, never amounts sent by the client.
 */

const toCents = (amount: number) => Math.round(amount * 100)
const fromCents = (cents: number) => cents / 100

async function simulateNetwork(failureRate: number) {
  const { minLatencyMs, maxLatencyMs } = mockConfig
  await delay(minLatencyMs + Math.random() * (maxLatencyMs - minLatencyMs))
  if (Math.random() < failureRate) {
    return Math.random() < 0.5
      ? HttpResponse.error()
      : apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')
  }
  return null
}

function apiError(status: number, code: ApiErrorCode, message: string, amount?: number) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, amount } }, { status })
}

const findUnit = (order: OrderDto, unitId: string) => {
  for (const line of order.items) {
    const unit = line.units.find((u) => u.unit_id === unitId)
    if (unit) return { line, unit }
  }
  return undefined
}

type Priced =
  | {
      ok: true
      itemsCents: number
      feeCents: number
      units: { unit: UnitDto; addonIds: string[] }[]
    }
  | { ok: false; response: Response }

function priceRefund(order: OrderDto, body: RefundQuoteRequest | null): Priced {
  const fail = (status: number, code: ApiErrorCode, message: string) => ({
    ok: false as const,
    response: apiError(status, code, message),
  })
  if (!body || !Array.isArray(body.items) || typeof body.include_delivery_fee !== 'boolean') {
    return fail(422, 'VALIDATION_ERROR', 'items and include_delivery_fee are required.')
  }

  const seen = new Set<string>()
  const units: { unit: UnitDto; addonIds: string[] }[] = []
  let itemsCents = 0

  for (const item of body.items) {
    const found = findUnit(order, item.unit_id)
    if (!found || seen.has(item.unit_id)) {
      return fail(422, 'VALIDATION_ERROR', `Invalid or duplicate item ${item.unit_id}.`)
    }
    seen.add(item.unit_id)
    const { line, unit } = found
    if (unit.status !== 'paid') {
      return fail(
        409,
        'ITEM_NOT_REFUNDABLE',
        `${line.name} (${unit.unit_id}) was already refunded.`,
      )
    }
    itemsCents += toCents(line.unit_price)

    const addonIds = [...new Set(item.addon_ids ?? [])]
    for (const addonId of addonIds) {
      const addon = unit.addons.find((a) => a.addon_id === addonId)
      if (!addon) return fail(422, 'VALIDATION_ERROR', `${addonId} is not part of ${unit.unit_id}.`)
      if (addon.status !== 'paid') {
        return fail(
          409,
          'ITEM_NOT_REFUNDABLE',
          `${addon.name} on ${unit.unit_id} was already refunded.`,
        )
      }
      itemsCents += toCents(addon.unit_price)
    }
    units.push({ unit, addonIds })
  }

  let feeCents = 0
  if (body.include_delivery_fee) {
    if (!order.delivery_fee || order.delivery_fee_status !== 'paid') {
      return fail(409, 'ITEM_NOT_REFUNDABLE', 'The delivery fee is not refundable.')
    }
    feeCents = toCents(order.delivery_fee)
  }

  if (itemsCents + feeCents === 0) {
    return fail(422, 'VALIDATION_ERROR', 'Select at least one item or the delivery fee.')
  }
  return { ok: true, itemsCents, feeCents, units }
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

const orderNotFound = (orderId: string) =>
  apiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} was not found.`)

export const handlers = [
  http.get<{ orderId: string }>('/api/orders/:orderId', async ({ params }) => {
    const failure = await simulateNetwork(mockConfig.readFailureRate)
    if (failure) return failure
    const order = getDb().orders[params.orderId]
    return order ? HttpResponse.json<OrderDto>(order) : orderNotFound(params.orderId)
  }),

  http.post<{ orderId: string }>(
    '/api/orders/:orderId/refunds/quote',
    async ({ params, request }) => {
      const failure = await simulateNetwork(mockConfig.failureRate)
      if (failure) return failure
      const order = getDb().orders[params.orderId]
      if (!order) return orderNotFound(params.orderId)

      const priced = priceRefund(order, await readJson<RefundQuoteRequest>(request))
      if (!priced.ok) return priced.response
      return HttpResponse.json<RefundQuoteResponse>({
        currency: order.currency,
        items_amount: fromCents(priced.itemsCents),
        delivery_fee_amount: fromCents(priced.feeCents),
        amount: fromCents(priced.itemsCents + priced.feeCents),
      })
    },
  ),

  http.post<{ orderId: string }>('/api/orders/:orderId/refunds', async ({ params, request }) => {
    const failure = await simulateNetwork(mockConfig.failureRate)
    if (failure) return failure

    const db = getDb()
    const order = db.orders[params.orderId]
    if (!order) return orderNotFound(params.orderId)

    const key = request.headers.get('Idempotency-Key')
    if (!key)
      return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.')
    const replay = db.refundsByKey[key]
    if (replay) return HttpResponse.json<CreateRefundResponse>(replay, { status: 201 })

    const body = await readJson<CreateRefundRequest>(request)
    if (!body) return apiError(400, 'VALIDATION_ERROR', 'Invalid JSON body.')
    if (!REFUND_REASONS.some((r) => r.value === body.reason)) {
      return apiError(422, 'VALIDATION_ERROR', 'A valid reason is required.')
    }
    if (!REFUND_CHANNELS.some((c) => c.value === body.channel)) {
      return apiError(422, 'VALIDATION_ERROR', 'A valid refund channel is required.')
    }
    const note = body.note?.trim() ?? ''
    if ((body.reason === 'other' && !note) || note.length > 500) {
      return apiError(
        422,
        'VALIDATION_ERROR',
        'A note (max 500 characters) is required for "Other".',
      )
    }

    // Demo scenario: another staff member refunds one of the items moments before us.
    const firstItem = body.items?.[0]
    if (mockConfig.scenario === 'conflict' && !db.conflictTriggered && firstItem) {
      const found = findUnit(order, firstItem.unit_id)
      if (found) {
        db.conflictTriggered = true
        found.unit.status = 'refunded'
        found.unit.addons.forEach((a) => (a.status = 'refunded'))
        saveDb()
      }
    }

    const priced = priceRefund(order, body)
    if (!priced.ok) return priced.response

    const amountCents = priced.itemsCents + priced.feeCents
    if (typeof body.expected_amount !== 'number' || toCents(body.expected_amount) !== amountCents) {
      return apiError(
        409,
        'AMOUNT_MISMATCH',
        'The refund amount has changed. Please review it before confirming.',
        fromCents(amountCents),
      )
    }

    for (const { unit, addonIds } of priced.units) {
      unit.status = 'refunded'
      unit.addons
        .filter((a) => addonIds.includes(a.addon_id))
        .forEach((a) => (a.status = 'refunded'))
    }
    if (priced.feeCents > 0) order.delivery_fee_status = 'refunded'

    const response: CreateRefundResponse = {
      refund_id: `RF-${Date.now().toString(36).toUpperCase()}`,
      order_id: order.order_id,
      status: 'succeeded',
      amount: fromCents(amountCents),
      currency: order.currency,
      reason: body.reason,
      channel: body.channel,
      created_at: new Date().toISOString(),
      order: structuredClone(order),
    }
    db.refundsByKey[key] = response
    saveDb()
    return HttpResponse.json<CreateRefundResponse>(response, { status: 201 })
  }),
]
