import type { Addon, Minor, Order, RefundSelection, Unit } from './types'

/**
 * Pure refund rules shared by the selection UI and the review step.
 * The backend re-applies the same rules and is the source of truth; this is the preview.
 */

export const addonKey = (unitId: string, addonId: string) => `${unitId}:${addonId}`

export const emptySelection = (): RefundSelection => ({
  unitIds: new Set(),
  addonKeys: new Set(),
  includeDeliveryFee: false,
})

export const isUnitRefundable = (unit: Unit) => unit.status === 'paid'

/**
 * - `refundable`: paid, and its main item can still be refunded.
 * - `refunded`: the add-on itself was refunded.
 * - `locked`: still paid, but its main item was refunded without it (e.g. L2-2 in the
 *   sample data). An add-on can't be refunded on its own, so it can't be refunded anymore.
 */
export type AddonRefundState = 'refundable' | 'refunded' | 'locked'

export function addonRefundState(unit: Unit, addon: Addon): AddonRefundState {
  if (addon.status === 'refunded') return 'refunded'
  return isUnitRefundable(unit) ? 'refundable' : 'locked'
}

export const isAddonRefundable = (unit: Unit, addon: Addon) =>
  addonRefundState(unit, addon) === 'refundable'

export const isDeliveryFeeRefundable = (order: Order) =>
  order.deliveryFee !== null && order.deliveryFee.amount > 0 && order.deliveryFee.status === 'paid'

export const allUnits = (order: Order): Unit[] => order.lines.flatMap((line) => line.units)

export const refundableUnits = (order: Order): Unit[] => allUnits(order).filter(isUnitRefundable)

export const hasRefundableItems = (order: Order) =>
  refundableUnits(order).length > 0 || isDeliveryFeeRefundable(order)

const findUnit = (order: Order, unitId: string) => allUnits(order).find((u) => u.id === unitId)

/** Selecting a unit also selects its refundable add-ons; deselecting clears them. */
export function toggleUnit(
  order: Order,
  selection: RefundSelection,
  unitId: string,
): RefundSelection {
  const unit = findUnit(order, unitId)
  if (!unit || !isUnitRefundable(unit)) return selection

  const unitIds = new Set(selection.unitIds)
  const addonKeys = new Set(selection.addonKeys)
  const unitAddonKeys = unit.addons
    .filter((a) => isAddonRefundable(unit, a))
    .map((a) => addonKey(unit.id, a.id))

  if (unitIds.has(unitId)) {
    unitIds.delete(unitId)
    unit.addons.forEach((a) => addonKeys.delete(addonKey(unit.id, a.id)))
  } else {
    unitIds.add(unitId)
    unitAddonKeys.forEach((k) => addonKeys.add(k))
  }
  return { ...selection, unitIds, addonKeys }
}

/** An add-on can only be toggled while its main item is selected. */
export function toggleAddon(
  order: Order,
  selection: RefundSelection,
  unitId: string,
  addonId: string,
): RefundSelection {
  const unit = findUnit(order, unitId)
  const addon = unit?.addons.find((a) => a.id === addonId)
  if (!unit || !addon || !isAddonRefundable(unit, addon) || !selection.unitIds.has(unitId)) {
    return selection
  }
  const key = addonKey(unitId, addonId)
  const addonKeys = new Set(selection.addonKeys)
  if (addonKeys.has(key)) addonKeys.delete(key)
  else addonKeys.add(key)
  return { ...selection, addonKeys }
}

export function setDeliveryFee(
  order: Order,
  selection: RefundSelection,
  include: boolean,
): RefundSelection {
  return { ...selection, includeDeliveryFee: include && isDeliveryFeeRefundable(order) }
}

/** Selects every remaining refundable unit and add-on. The delivery fee is left as is. */
export function selectAllItems(order: Order, selection: RefundSelection): RefundSelection {
  const units = refundableUnits(order)
  return {
    ...selection,
    unitIds: new Set(units.map((u) => u.id)),
    addonKeys: new Set(
      units.flatMap((u) =>
        u.addons.filter((a) => isAddonRefundable(u, a)).map((a) => addonKey(u.id, a.id)),
      ),
    ),
  }
}

export const clearItems = (selection: RefundSelection): RefundSelection => ({
  ...selection,
  unitIds: new Set(),
  addonKeys: new Set(),
})

/**
 * Drops anything that is no longer refundable, e.g. after the order was refreshed
 * and another staff member refunded some of the selected items.
 */
export function sanitizeSelection(order: Order, selection: RefundSelection): RefundSelection {
  const unitIds = new Set<string>()
  const addonKeys = new Set<string>()
  for (const unit of refundableUnits(order)) {
    if (!selection.unitIds.has(unit.id)) continue
    unitIds.add(unit.id)
    for (const addon of unit.addons) {
      const key = addonKey(unit.id, addon.id)
      if (selection.addonKeys.has(key) && isAddonRefundable(unit, addon)) addonKeys.add(key)
    }
  }
  return {
    unitIds,
    addonKeys,
    includeDeliveryFee: selection.includeDeliveryFee && isDeliveryFeeRefundable(order),
  }
}

export function isSameSelection(a: RefundSelection, b: RefundSelection) {
  const sameSet = (x: ReadonlySet<string>, y: ReadonlySet<string>) =>
    x.size === y.size && [...x].every((v) => y.has(v))
  return (
    a.includeDeliveryFee === b.includeDeliveryFee &&
    sameSet(a.unitIds, b.unitIds) &&
    sameSet(a.addonKeys, b.addonKeys)
  )
}

export interface RefundLineItem {
  unitId: string
  lineId: string
  name: string
  unitIndex: number
  unitCount: number
  price: Minor
  addons: { id: string; name: string; price: Minor }[]
  /**
   * Refundable add-ons left out of this unit's refund. Once the unit is refunded
   * they can never be refunded, so the UI warns about them.
   */
  excludedAddons: { id: string; name: string; price: Minor }[]
  subtotal: Minor
}

export interface RefundBreakdown {
  items: RefundLineItem[]
  itemsSubtotal: Minor
  deliveryFee: Minor
  total: Minor
  /** True when every remaining refundable unit and add-on is selected. */
  isFullRefund: boolean
  isEmpty: boolean
  excludedAddonCount: number
}

export function calculateRefund(order: Order, rawSelection: RefundSelection): RefundBreakdown {
  const selection = sanitizeSelection(order, rawSelection)
  const items: RefundLineItem[] = []

  for (const line of order.lines) {
    for (const unit of line.units) {
      if (!selection.unitIds.has(unit.id)) continue
      const toSummary = ({ id, name, price }: Addon) => ({ id, name, price })
      const isSelected = (a: Addon) => selection.addonKeys.has(addonKey(unit.id, a.id))
      const addons = unit.addons.filter(isSelected).map(toSummary)
      const excludedAddons = unit.addons
        .filter((a) => !isSelected(a) && isAddonRefundable(unit, a))
        .map(toSummary)
      items.push({
        unitId: unit.id,
        lineId: line.id,
        name: unit.name,
        unitIndex: unit.index,
        unitCount: line.units.length,
        price: unit.price,
        addons,
        excludedAddons,
        subtotal: unit.price + sum(addons.map((a) => a.price)),
      })
    }
  }

  const itemsSubtotal = sum(items.map((i) => i.subtotal))
  const deliveryFee =
    selection.includeDeliveryFee && order.deliveryFee ? order.deliveryFee.amount : 0
  const total = itemsSubtotal + deliveryFee
  const all = selectAllItems(order, emptySelection())

  return {
    items,
    itemsSubtotal,
    deliveryFee,
    total,
    isFullRefund:
      all.unitIds.size > 0 && isSameSelection({ ...selection, includeDeliveryFee: false }, all),
    isEmpty: total === 0,
    excludedAddonCount: sum(items.map((i) => i.excludedAddons.length)),
  }
}

export interface OrderTotals {
  itemsTotal: Minor
  deliveryFee: Minor
  orderTotal: Minor
  refundedAmount: Minor
  refundableRemaining: Minor
  /** Paid add-ons that can no longer be refunded because their drink was refunded without them. */
  lockedAmount: Minor
  refundStatus: OrderRefundStatus
}

/**
 * Based on money returned, not on what can still be refunded: an order whose
 * add-ons were left out of a drink refund stays `partial` even when nothing more
 * can be refunded, because the customer didn't get that money back.
 */
export type OrderRefundStatus = 'none' | 'partial' | 'full'

export function calculateOrderTotals(order: Order): OrderTotals {
  const units = allUnits(order)
  const itemsTotal = sum(units.map((u) => u.price + sum(u.addons.map((a) => a.price))))
  const deliveryFee = order.deliveryFee?.amount ?? 0
  const orderTotal = itemsTotal + deliveryFee
  const refundedAmount =
    sum(units.filter((u) => u.status === 'refunded').map((u) => u.price)) +
    sum(units.flatMap((u) => u.addons.filter((a) => a.status === 'refunded').map((a) => a.price))) +
    (order.deliveryFee?.status === 'refunded' ? deliveryFee : 0)
  const remaining = calculateRefund(order, {
    ...selectAllItems(order, emptySelection()),
    includeDeliveryFee: true,
  }).total
  return {
    itemsTotal,
    deliveryFee,
    orderTotal,
    refundedAmount,
    refundableRemaining: remaining,
    lockedAmount: sum(
      units.flatMap((u) =>
        u.addons.filter((a) => addonRefundState(u, a) === 'locked').map((a) => a.price),
      ),
    ),
    refundStatus: refundedAmount === 0 ? 'none' : refundedAmount >= orderTotal ? 'full' : 'partial',
  }
}

function sum(values: Minor[]): Minor {
  return values.reduce((acc, v) => acc + v, 0)
}
