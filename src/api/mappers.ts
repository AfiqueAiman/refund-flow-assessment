import { addonKey } from '../domain/refundCalculation'
import { toMinor } from '../domain/money'
import type { Order, RefundSelection } from '../domain/types'
import type { OrderDto, RefundItemDto } from './contracts'

export function toOrder(dto: OrderDto): Order {
  const money = (amount: number) => toMinor(amount, dto.currency)
  return {
    id: dto.order_id,
    status: dto.status,
    currency: dto.currency,
    deliveryFee:
      dto.delivery_fee != null && dto.delivery_fee > 0
        ? { amount: money(dto.delivery_fee), status: dto.delivery_fee_status ?? 'paid' }
        : null,
    lines: dto.items.map((line) => ({
      id: line.line_id,
      name: line.name,
      unitPrice: money(line.unit_price),
      units: line.units.map((unit, i) => ({
        id: unit.unit_id,
        lineId: line.line_id,
        index: i + 1,
        name: line.name,
        price: money(line.unit_price),
        status: unit.status,
        addons: unit.addons.map((addon) => ({
          id: addon.addon_id,
          name: addon.name,
          price: money(addon.unit_price),
          status: addon.status,
        })),
      })),
    })),
  }
}

/** Sends ids only; the server prices them itself. */
export function toRefundItems(order: Order, selection: RefundSelection): RefundItemDto[] {
  return order.lines.flatMap((line) =>
    line.units
      .filter((unit) => selection.unitIds.has(unit.id))
      .map((unit) => ({
        unit_id: unit.id,
        addon_ids: unit.addons
          .filter((a) => selection.addonKeys.has(addonKey(unit.id, a.id)))
          .map((a) => a.id),
      })),
  )
}
