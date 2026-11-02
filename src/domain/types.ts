/**
 * Domain model used by the UI. Money is always an integer in the currency's
 * minor unit (e.g. sen for MYR) to avoid floating point errors.
 */
export type Minor = number

export type PaymentStatus = 'paid' | 'refunded'

export interface Addon {
  id: string
  name: string
  price: Minor
  status: PaymentStatus
}

export interface Unit {
  id: string
  lineId: string
  /** 1-based position within its line, used for "Unit 1 of 2" labels. */
  index: number
  name: string
  price: Minor
  status: PaymentStatus
  addons: Addon[]
}

export interface OrderLine {
  id: string
  name: string
  unitPrice: Minor
  units: Unit[]
}

export interface DeliveryFee {
  amount: Minor
  status: PaymentStatus
}

export interface Order {
  id: string
  status: string
  currency: string
  deliveryFee: DeliveryFee | null
  lines: OrderLine[]
}

export interface RefundSelection {
  unitIds: ReadonlySet<string>
  /** Keys built with `addonKey(unitId, addonId)`; add-on ids repeat across units. */
  addonKeys: ReadonlySet<string>
  includeDeliveryFee: boolean
}

export const REFUND_REASONS = [
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'missing_item', label: 'Missing item' },
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'late_delivery', label: 'Late delivery' },
  { value: 'other', label: 'Other' },
] as const

export type RefundReason = (typeof REFUND_REASONS)[number]['value']

export const REFUND_CHANNELS = [
  {
    value: 'original_payment',
    label: 'Original payment method',
    description: 'Returned to the card or e-wallet used. May take a few business days.',
  },
  {
    value: 'in_app_credit',
    label: 'In-app credit',
    description: "Added to the customer's app wallet immediately.",
  },
] as const

export type RefundChannel = (typeof REFUND_CHANNELS)[number]['value']

export const reasonLabel = (reason: RefundReason) =>
  REFUND_REASONS.find((r) => r.value === reason)?.label ?? reason

export const channelLabel = (channel: RefundChannel) =>
  REFUND_CHANNELS.find((c) => c.value === channel)?.label ?? channel
