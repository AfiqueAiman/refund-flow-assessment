import { describe, expect, it } from 'vitest'
import { sampleOrder, seedOrderDto } from '../test/fixtures'
import { toOrder } from '../api/mappers'
import { formatMoney, toMinor } from './money'
import {
  addonKey,
  addonRefundState,
  calculateOrderTotals,
  calculateRefund,
  clearItems,
  emptySelection,
  hasRefundableItems,
  isAddonRefundable,
  isDeliveryFeeRefundable,
  sanitizeSelection,
  selectAllItems,
  setDeliveryFee,
  toggleAddon,
  toggleUnit,
} from './refundCalculation'
import type { Order, RefundSelection } from './types'

const select = (order: Order, ...unitIds: string[]): RefundSelection =>
  unitIds.reduce((sel, id) => toggleUnit(order, sel, id), emptySelection())

const unit = (order: Order, id: string) =>
  order.lines.flatMap((l) => l.units).find((u) => u.id === id)!

describe('calculateRefund', () => {
  it('is empty and zero when nothing is selected', () => {
    const result = calculateRefund(sampleOrder(), emptySelection())
    expect(result).toMatchObject({ total: 0, isEmpty: true, isFullRefund: false, items: [] })
  })

  it('includes a drink and its add-ons when the drink is selected', () => {
    const order = sampleOrder()
    const result = calculateRefund(order, select(order, 'L1-2'))
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ unitId: 'L1-2', price: 1390, subtotal: 1590 })
    expect(result.items[0]!.addons.map((a) => a.name)).toEqual(['Extra Shot'])
    expect(result.total).toBe(1590)
  })

  it('lets staff refund a drink without some of its add-ons', () => {
    const order = sampleOrder()
    const selection = toggleAddon(order, select(order, 'L2-1'), 'L2-1', 'A3')
    const result = calculateRefund(order, selection)
    expect(result.items[0]!.addons.map((a) => a.id)).toEqual(['A2'])
    expect(result.total).toBe(1190 + 150)
  })

  it('reports refundable add-ons left out of a drink refund', () => {
    const order = sampleOrder()
    const selection = toggleAddon(order, select(order, 'L2-1', 'L3-1'), 'L2-1', 'A3')
    const result = calculateRefund(order, selection)
    expect(result.items[0]!.excludedAddons.map((a) => a.name)).toEqual(['Brown Sugar Syrup'])
    expect(result.items[1]!.excludedAddons).toEqual([])
    expect(result.excludedAddonCount).toBe(1)
  })

  it('reports no excluded add-ons when every add-on of a selected drink is included', () => {
    const order = sampleOrder()
    expect(calculateRefund(order, select(order, 'L1-2', 'L2-1')).excludedAddonCount).toBe(0)
  })

  it('treats each unit of a multi-quantity item independently', () => {
    const order = sampleOrder()
    const result = calculateRefund(order, select(order, 'L3-1', 'L3-3'))
    expect(result.items.map((i) => [i.unitId, i.unitIndex, i.unitCount])).toEqual([
      ['L3-1', 1, 3],
      ['L3-3', 3, 3],
    ])
    expect(result.total).toBe(2 * 790)
  })

  it('avoids floating point errors when summing decimal prices', () => {
    const order = sampleOrder()
    // Three croissants at 7.90 is 23.700000000000003 in floating point.
    expect(7.9 + 7.9 + 7.9).not.toBe(23.7)
    expect(calculateRefund(order, select(order, 'L3-1', 'L3-2', 'L3-3')).total).toBe(2370)
  })

  it('adds the delivery fee only when chosen', () => {
    const order = sampleOrder()
    const items = select(order, 'L3-1')
    expect(calculateRefund(order, items).total).toBe(790)
    const withFee = calculateRefund(order, setDeliveryFee(order, items, true))
    expect(withFee).toMatchObject({ itemsSubtotal: 790, deliveryFee: 500, total: 1290 })
  })

  it('allows a delivery-fee-only refund (e.g. late delivery)', () => {
    const order = sampleOrder()
    const result = calculateRefund(order, setDeliveryFee(order, emptySelection(), true))
    expect(result).toMatchObject({ items: [], total: 500, isEmpty: false, isFullRefund: false })
  })

  it('ignores a delivery fee that was already refunded', () => {
    const dto = { ...seedOrderDto(), delivery_fee_status: 'refunded' as const }
    const order = toOrder(dto)
    expect(isDeliveryFeeRefundable(order)).toBe(false)
    const forced = { ...emptySelection(), includeDeliveryFee: true }
    expect(calculateRefund(order, forced).total).toBe(0)
  })

  it('handles orders without a delivery fee', () => {
    const order = toOrder({ ...seedOrderDto(), delivery_fee: null, delivery_fee_status: null })
    expect(order.deliveryFee).toBeNull()
    expect(calculateRefund(order, setDeliveryFee(order, emptySelection(), true)).total).toBe(0)
  })
})

describe('full refund', () => {
  it('selects every remaining refundable unit and add-on, skipping refunded ones', () => {
    const order = sampleOrder()
    const selection = selectAllItems(order, emptySelection())
    expect([...selection.unitIds]).toEqual(['L1-2', 'L2-1', 'L3-1', 'L3-2', 'L3-3'])
    expect([...selection.addonKeys]).toEqual(['L1-2:A1', 'L2-1:A2', 'L2-1:A3'])

    const result = calculateRefund(order, selection)
    expect(result.isFullRefund).toBe(true)
    expect(result.total).toBe(1590 + 1440 + 3 * 790)
  })

  it('is still a full refund with or without the optional delivery fee', () => {
    const order = sampleOrder()
    const all = selectAllItems(order, emptySelection())
    expect(calculateRefund(order, all).isFullRefund).toBe(true)
    const withFee = calculateRefund(order, setDeliveryFee(order, all, true))
    expect(withFee).toMatchObject({ isFullRefund: true, total: 5400 + 500 })
  })

  it('is not a full refund if any refundable add-on is left out', () => {
    const order = sampleOrder()
    const selection = toggleAddon(order, selectAllItems(order, emptySelection()), 'L1-2', 'A1')
    expect(calculateRefund(order, selection).isFullRefund).toBe(false)
  })

  it('clears items but keeps the delivery fee choice', () => {
    const order = sampleOrder()
    const selection = setDeliveryFee(order, selectAllItems(order, emptySelection()), true)
    expect(clearItems(selection)).toMatchObject({ includeDeliveryFee: true })
    expect(clearItems(selection).unitIds.size).toBe(0)
  })
})

describe('selection rules', () => {
  it('does not allow an add-on to be selected without its main item', () => {
    const order = sampleOrder()
    const selection = toggleAddon(order, emptySelection(), 'L1-2', 'A1')
    expect(selection.addonKeys.size).toBe(0)
  })

  it('clears add-ons when their main item is deselected', () => {
    const order = sampleOrder()
    const selection = toggleUnit(order, select(order, 'L2-1'), 'L2-1')
    expect(selection.unitIds.size).toBe(0)
    expect(selection.addonKeys.size).toBe(0)
  })

  it('cannot select units that were already refunded', () => {
    const order = sampleOrder()
    expect(select(order, 'L1-1', 'L2-2').unitIds.size).toBe(0)
  })

  it('keys add-ons per unit because add-on ids repeat across units', () => {
    const order = sampleOrder()
    const selection = select(order, 'L2-1')
    expect(selection.addonKeys.has(addonKey('L2-1', 'A2'))).toBe(true)
    expect(selection.addonKeys.has(addonKey('L2-2', 'A2'))).toBe(false)
  })

  it('distinguishes refunded add-ons from paid add-ons locked by a refunded drink', () => {
    const order = sampleOrder()
    const [l11, l12, l22] = [unit(order, 'L1-1'), unit(order, 'L1-2'), unit(order, 'L2-2')]
    expect(addonRefundState(l11, l11.addons[0]!)).toBe('refunded')
    expect(addonRefundState(l12, l12.addons[0]!)).toBe('refundable')
    expect(l22.addons.map((a) => addonRefundState(l22, a))).toEqual(['locked', 'locked'])
  })

  it('never refunds add-ons whose drink was already refunded without them (L2-2)', () => {
    const order = sampleOrder()
    const l22 = unit(order, 'L2-2')
    expect(l22.addons.every((a) => a.status === 'paid')).toBe(true)
    expect(l22.addons.some((a) => isAddonRefundable(l22, a))).toBe(false)

    const crafted: RefundSelection = {
      unitIds: new Set(['L2-2']),
      addonKeys: new Set([addonKey('L2-2', 'A2'), addonKey('L2-2', 'A3')]),
      includeDeliveryFee: false,
    }
    expect(calculateRefund(order, crafted).total).toBe(0)
  })

  it('sanitizes a stale selection after items were refunded elsewhere', () => {
    const order = sampleOrder()
    const selection = select(order, 'L1-2', 'L3-1')
    const dto = seedOrderDto()
    dto.items[0]!.units[1]!.status = 'refunded'
    const refreshed = toOrder(dto)
    const sanitized = sanitizeSelection(refreshed, selection)
    expect([...sanitized.unitIds]).toEqual(['L3-1'])
    expect(sanitized.addonKeys.size).toBe(0)
  })
})

describe('order totals', () => {
  it('reports the order total, refunded and remaining refundable amounts', () => {
    // Already refunded: L1-1 (13.90 + Extra Shot 2.00) and L2-2 (11.90; its add-ons were not).
    expect(calculateOrderTotals(sampleOrder())).toEqual({
      itemsTotal: 8430,
      deliveryFee: 500,
      orderTotal: 8930,
      refundedAmount: 1390 + 200 + 1190,
      refundableRemaining: 5900,
      lockedAmount: 150 + 100, // L2-2's Oat Milk and Brown Sugar Syrup
      refundStatus: 'partial',
    })
  })

  const refundEverything = (dto = seedOrderDto()) => {
    dto.items.forEach((line) =>
      line.units.forEach((u) => {
        u.status = 'refunded'
        u.addons.forEach((a) => (a.status = 'refunded'))
      }),
    )
    dto.delivery_fee_status = 'refunded'
    return dto
  }

  it('is "none" when nothing has been refunded', () => {
    const dto = seedOrderDto()
    dto.items.forEach((line) =>
      line.units.forEach((u) => {
        u.status = 'paid'
        u.addons.forEach((a) => (a.status = 'paid'))
      }),
    )
    expect(calculateOrderTotals(toOrder(dto))).toMatchObject({
      refundedAmount: 0,
      refundStatus: 'none',
    })
  })

  it('is "full" when every item, add-on and the delivery fee are refunded', () => {
    expect(calculateOrderTotals(toOrder(refundEverything()))).toMatchObject({
      refundedAmount: 8930,
      refundableRemaining: 0,
      refundStatus: 'full',
    })
  })

  it('is "partial" while the delivery fee is still unrefunded', () => {
    const dto = refundEverything()
    dto.delivery_fee_status = 'paid'
    expect(calculateOrderTotals(toOrder(dto))).toMatchObject({
      refundableRemaining: 500,
      refundStatus: 'partial',
    })
  })

  it('stays "partial" when only locked add-ons remain, though nothing is refundable', () => {
    const dto = refundEverything()
    dto.items[1]!.units[1]!.addons.forEach((a) => (a.status = 'paid')) // L2-2 as in the sample
    const order = toOrder(dto)
    expect(calculateOrderTotals(order)).toMatchObject({
      refundedAmount: 8930 - 250,
      refundableRemaining: 0,
      lockedAmount: 250,
      refundStatus: 'partial',
    })
    expect(hasRefundableItems(order)).toBe(false)
    expect(calculateOrderTotals(toOrder(refundEverything())).lockedAmount).toBe(0)
  })

  it('reports whether anything is left to refund', () => {
    const dto = seedOrderDto()
    dto.items.forEach((line) => line.units.forEach((u) => (u.status = 'refunded')))
    expect(hasRefundableItems(toOrder(dto))).toBe(true)
    dto.delivery_fee_status = 'refunded'
    expect(hasRefundableItems(toOrder(dto))).toBe(false)
  })
})

describe('money', () => {
  it('converts using the currency minor unit', () => {
    expect(toMinor(13.9, 'MYR')).toBe(1390)
    expect(toMinor(1.005, 'MYR')).toBe(101)
    expect(toMinor(500, 'JPY')).toBe(500)
  })

  it('formats with the order currency', () => {
    // Exact spacing depends on the ICU version, so only the meaningful parts are asserted.
    expect(formatMoney(3030, 'MYR', 'en-MY')).toMatch(/^RM\s?30\.30$/)
    expect(formatMoney(1290, 'SGD', 'en-SG')).toMatch(/^\$\s?12\.90$/)
    expect(formatMoney(500, 'JPY', 'ja-JP')).toMatch(/500$/)
  })
})
