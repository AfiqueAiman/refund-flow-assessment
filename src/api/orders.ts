import { toMajor, toMinor } from '../domain/money'
import type { Minor, Order, RefundChannel, RefundReason, RefundSelection } from '../domain/types'
import { request } from './client'
import type {
  CreateRefundRequest,
  CreateRefundResponse,
  OrderDto,
  RefundQuoteRequest,
  RefundQuoteResponse,
} from './contracts'
import { toOrder, toRefundItems } from './mappers'

export async function getOrder(orderId: string, signal?: AbortSignal): Promise<Order> {
  return toOrder(await request<OrderDto>(`/orders/${encodeURIComponent(orderId)}`, { signal }))
}

export interface RefundQuote {
  itemsAmount: Minor
  deliveryFee: Minor
  total: Minor
}

export async function quoteRefund(
  order: Order,
  selection: RefundSelection,
  signal?: AbortSignal,
): Promise<RefundQuote> {
  const body: RefundQuoteRequest = {
    items: toRefundItems(order, selection),
    include_delivery_fee: selection.includeDeliveryFee,
  }
  const res = await request<RefundQuoteResponse>(
    `/orders/${encodeURIComponent(order.id)}/refunds/quote`,
    { method: 'POST', body: JSON.stringify(body), signal },
  )
  return {
    itemsAmount: toMinor(res.items_amount, res.currency),
    deliveryFee: toMinor(res.delivery_fee_amount, res.currency),
    total: toMinor(res.amount, res.currency),
  }
}

export interface CreateRefundInput {
  selection: RefundSelection
  reason: RefundReason
  note: string
  channel: RefundChannel
  expectedAmount: Minor
  idempotencyKey: string
}

export interface RefundResult {
  refundId: string
  amount: Minor
  channel: RefundChannel
  order: Order
}

export async function createRefund(order: Order, input: CreateRefundInput): Promise<RefundResult> {
  const body: CreateRefundRequest = {
    items: toRefundItems(order, input.selection),
    include_delivery_fee: input.selection.includeDeliveryFee,
    reason: input.reason,
    note: input.note.trim() || null,
    channel: input.channel,
    expected_amount: toMajor(input.expectedAmount, order.currency),
  }
  const res = await request<CreateRefundResponse>(
    `/orders/${encodeURIComponent(order.id)}/refunds`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': input.idempotencyKey },
      body: JSON.stringify(body),
    },
  )
  return {
    refundId: res.refund_id,
    amount: toMinor(res.amount, res.currency),
    channel: res.channel,
    order: toOrder(res.order),
  }
}
