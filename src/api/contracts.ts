/**
 * Wire format shared by the API client and the mock server.
 * The order shape matches the provided sample data (decimal amounts, snake_case).
 */
import type { PaymentStatus, RefundChannel, RefundReason } from '../domain/types'

export interface AddonDto {
  addon_id: string
  name: string
  unit_price: number
  status: PaymentStatus
}

export interface UnitDto {
  unit_id: string
  status: PaymentStatus
  addons: AddonDto[]
}

export interface LineDto {
  line_id: string
  name: string
  unit_price: number
  units: UnitDto[]
}

export interface OrderDto {
  order_id: string
  status: string
  currency: string
  delivery_fee: number | null
  delivery_fee_status: PaymentStatus | null
  items: LineDto[]
}

export interface RefundItemDto {
  unit_id: string
  addon_ids: string[]
}

export interface RefundQuoteRequest {
  items: RefundItemDto[]
  include_delivery_fee: boolean
}

export interface RefundQuoteResponse {
  currency: string
  items_amount: number
  delivery_fee_amount: number
  amount: number
}

export interface CreateRefundRequest extends RefundQuoteRequest {
  reason: RefundReason
  note: string | null
  channel: RefundChannel
  /** The amount staff saw and confirmed. Used only as a consistency check. */
  expected_amount: number
}

export interface CreateRefundResponse {
  refund_id: string
  order_id: string
  status: 'succeeded'
  amount: number
  currency: string
  reason: RefundReason
  channel: RefundChannel
  created_at: string
  order: OrderDto
}

export type ApiErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'ITEM_NOT_REFUNDABLE'
  | 'AMOUNT_MISMATCH'
  | 'IDEMPOTENCY_KEY_REQUIRED'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Present on AMOUNT_MISMATCH: the amount the server calculated. */
    amount?: number
  }
}
