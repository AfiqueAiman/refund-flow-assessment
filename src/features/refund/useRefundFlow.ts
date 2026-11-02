import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { ApiError } from '../../api/client'
import { createRefund, quoteRefund, type RefundQuote, type RefundResult } from '../../api/orders'
import {
  calculateRefund,
  clearItems,
  emptySelection,
  isSameSelection,
  refundableUnits,
  sanitizeSelection,
  selectAllItems,
  setDeliveryFee,
  toggleAddon,
  toggleUnit,
} from '../../domain/refundCalculation'
import type { Order, RefundChannel, RefundReason, RefundSelection } from '../../domain/types'

export type Step = 'select' | 'review'

export type QuoteState =
  | { status: 'loading' }
  | { status: 'success'; quote: RefundQuote }
  | { status: 'error'; error: ApiError }

export type SubmitState =
  { status: 'idle' } | { status: 'submitting' } | { status: 'error'; error: ApiError }

export interface RefundFlowState {
  step: Step
  selection: RefundSelection
  reason: RefundReason | ''
  note: string
  channel: RefundChannel | ''
  showValidation: boolean
  quote: QuoteState
  quoteAttempt: number
  confirmOpen: boolean
  submit: SubmitState
  /** Reused when retrying the same submission; cleared whenever the payload changes. */
  idempotencyKey: string | null
  notice: string | null
}

type Action =
  | { type: 'toggleUnit'; order: Order; unitId: string }
  | { type: 'toggleAddon'; order: Order; unitId: string; addonId: string }
  | { type: 'toggleAll'; order: Order }
  | { type: 'setDeliveryFee'; order: Order; include: boolean }
  | { type: 'goToReview' }
  | { type: 'backToSelect' }
  | { type: 'setReason'; reason: RefundReason }
  | { type: 'setNote'; note: string }
  | { type: 'setChannel'; channel: RefundChannel }
  | { type: 'quoteStart' }
  | { type: 'quoteSuccess'; quote: RefundQuote }
  | { type: 'quoteFailure'; error: ApiError }
  | { type: 'retryQuote' }
  | { type: 'openConfirm' }
  | { type: 'closeConfirm' }
  | { type: 'submitStart'; idempotencyKey: string }
  | { type: 'submitFailure'; error: ApiError }
  | { type: 'submitConflict'; message: string }
  | { type: 'orderUpdated'; order: Order }
  | { type: 'dismissNotice' }

export const NOTE_MAX_LENGTH = 500

export const initialRefundFlowState = (): RefundFlowState => ({
  step: 'select',
  selection: emptySelection(),
  reason: '',
  note: '',
  channel: '',
  showValidation: false,
  quote: { status: 'loading' },
  quoteAttempt: 0,
  confirmOpen: false,
  submit: { status: 'idle' },
  idempotencyKey: null,
  notice: null,
})

export function validateDetails(state: Pick<RefundFlowState, 'reason' | 'note' | 'channel'>) {
  return {
    reason: state.reason ? null : 'Choose a reason for the refund.',
    note:
      state.reason === 'other' && !state.note.trim()
        ? 'Add a short note explaining the reason.'
        : state.note.length > NOTE_MAX_LENGTH
          ? `Keep the note under ${NOTE_MAX_LENGTH} characters.`
          : null,
    channel: state.channel ? null : 'Choose where the refund goes.',
  }
}

const withSelection = (state: RefundFlowState, selection: RefundSelection): RefundFlowState => ({
  ...state,
  selection,
  idempotencyKey: null,
  notice: null,
})

export function refundFlowReducer(state: RefundFlowState, action: Action): RefundFlowState {
  switch (action.type) {
    case 'toggleUnit':
      return withSelection(state, toggleUnit(action.order, state.selection, action.unitId))
    case 'toggleAddon':
      return withSelection(
        state,
        toggleAddon(action.order, state.selection, action.unitId, action.addonId),
      )
    case 'toggleAll': {
      const all = selectAllItems(action.order, state.selection)
      const allSelected = all.unitIds.size > 0 && isSameSelection(all, state.selection)
      return withSelection(state, allSelected ? clearItems(state.selection) : all)
    }
    case 'setDeliveryFee':
      return withSelection(state, setDeliveryFee(action.order, state.selection, action.include))
    case 'goToReview':
      return { ...state, step: 'review', quote: { status: 'loading' }, notice: null }
    case 'backToSelect':
      return { ...state, step: 'select', confirmOpen: false, showValidation: false }
    case 'setReason':
      return { ...state, reason: action.reason, idempotencyKey: null }
    case 'setNote':
      return { ...state, note: action.note, idempotencyKey: null }
    case 'setChannel':
      return { ...state, channel: action.channel, idempotencyKey: null }
    case 'quoteStart':
      return { ...state, quote: { status: 'loading' } }
    case 'quoteSuccess':
      return { ...state, quote: { status: 'success', quote: action.quote } }
    case 'quoteFailure':
      return { ...state, quote: { status: 'error', error: action.error } }
    case 'retryQuote':
      return { ...state, quoteAttempt: state.quoteAttempt + 1 }
    case 'openConfirm': {
      const errors = validateDetails(state)
      const valid = Object.values(errors).every((e) => e === null)
      if (!valid || state.quote.status !== 'success') return { ...state, showValidation: true }
      return { ...state, showValidation: true, confirmOpen: true, submit: { status: 'idle' } }
    }
    case 'closeConfirm':
      return state.submit.status === 'submitting' ? state : { ...state, confirmOpen: false }
    case 'submitStart':
      return { ...state, submit: { status: 'submitting' }, idempotencyKey: action.idempotencyKey }
    case 'submitFailure':
      return { ...state, submit: { status: 'error', error: action.error } }
    case 'submitConflict':
      // The order changed on the server; a new submission (and key) is needed.
      return {
        ...state,
        confirmOpen: false,
        submit: { status: 'idle' },
        idempotencyKey: null,
        notice: action.message,
      }
    case 'orderUpdated': {
      const selection = sanitizeSelection(action.order, state.selection)
      if (isSameSelection(selection, state.selection)) return state
      const empty = calculateRefund(action.order, selection).isEmpty
      return {
        ...state,
        selection,
        idempotencyKey: null,
        step: empty ? 'select' : state.step,
        notice:
          'Some selected items were refunded by someone else and have been removed from this refund. Please review before continuing.',
      }
    }
    case 'dismissNotice':
      return { ...state, notice: null }
  }
}

const toApiError = (error: unknown) =>
  error instanceof ApiError
    ? error
    : new ApiError(0, 'INTERNAL_ERROR', 'Something went wrong. Please try again.')

interface Options {
  order: Order
  onRefunded: (result: RefundResult) => void
  /** Reloads the order after a conflict; the new order arrives through `order`. */
  onOrderStale: () => Promise<unknown>
}

export function useRefundFlow({ order, onRefunded, onOrderStale }: Options) {
  const [state, dispatch] = useReducer(refundFlowReducer, undefined, initialRefundFlowState)
  const breakdown = useMemo(() => calculateRefund(order, state.selection), [order, state.selection])

  useEffect(() => {
    dispatch({ type: 'orderUpdated', order })
  }, [order])

  // The review step shows the server's amount, which is what will actually be refunded.
  const { step, selection, quoteAttempt } = state
  useEffect(() => {
    if (step !== 'review') return
    const controller = new AbortController()
    dispatch({ type: 'quoteStart' })
    quoteRefund(order, selection, controller.signal).then(
      (quote) => dispatch({ type: 'quoteSuccess', quote }),
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'quoteFailure', error: toApiError(error) })
      },
    )
    return () => controller.abort()
  }, [step, order, selection, quoteAttempt])

  const submit = useCallback(async () => {
    if (state.submit.status === 'submitting' || state.quote.status !== 'success') return
    if (!state.reason || !state.channel) return
    const idempotencyKey = state.idempotencyKey ?? crypto.randomUUID()
    dispatch({ type: 'submitStart', idempotencyKey })
    try {
      const result = await createRefund(order, {
        selection: state.selection,
        reason: state.reason,
        note: state.note,
        channel: state.channel,
        expectedAmount: state.quote.quote.total,
        idempotencyKey,
      })
      onRefunded(result)
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.isConflict) {
        dispatch({ type: 'submitConflict', message: apiError.message })
        await onOrderStale().catch(() => {})
        dispatch({ type: 'retryQuote' })
      } else {
        dispatch({ type: 'submitFailure', error: apiError })
      }
    }
  }, [order, state, onRefunded, onOrderStale])

  const actions = useMemo(
    () => ({
      toggleUnit: (unitId: string) => dispatch({ type: 'toggleUnit', order, unitId }),
      toggleAddon: (unitId: string, addonId: string) =>
        dispatch({ type: 'toggleAddon', order, unitId, addonId }),
      toggleAll: () => dispatch({ type: 'toggleAll', order }),
      setDeliveryFee: (include: boolean) => dispatch({ type: 'setDeliveryFee', order, include }),
      goToReview: () => dispatch({ type: 'goToReview' }),
      backToSelect: () => dispatch({ type: 'backToSelect' }),
      setReason: (reason: RefundReason) => dispatch({ type: 'setReason', reason }),
      setNote: (note: string) => dispatch({ type: 'setNote', note }),
      setChannel: (channel: RefundChannel) => dispatch({ type: 'setChannel', channel }),
      retryQuote: () => dispatch({ type: 'retryQuote' }),
      openConfirm: () => dispatch({ type: 'openConfirm' }),
      closeConfirm: () => dispatch({ type: 'closeConfirm' }),
      dismissNotice: () => dispatch({ type: 'dismissNotice' }),
    }),
    [order],
  )

  const allSelectableCount = useMemo(() => refundableUnits(order).length, [order])

  return {
    state,
    breakdown,
    errors: validateDetails(state),
    allSelectableCount,
    actions,
    submit,
  }
}
