import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { Money } from '../../components/Money'
import { formatMoney } from '../../domain/money'
import { isDeliveryFeeRefundable, type RefundBreakdown } from '../../domain/refundCalculation'
import {
  REFUND_CHANNELS,
  REFUND_REASONS,
  type Order,
  type RefundChannel,
  type RefundReason,
} from '../../domain/types'
import { NOTE_MAX_LENGTH, type RefundFlowState, validateDetails } from './useRefundFlow'

interface Props {
  order: Order
  state: RefundFlowState
  breakdown: RefundBreakdown
  errors: ReturnType<typeof validateDetails>
  onReasonChange: (reason: RefundReason) => void
  onNoteChange: (note: string) => void
  onChannelChange: (channel: RefundChannel) => void
  onIncludeDeliveryFee: () => void
  onRetryQuote: () => void
}

export function ReviewStep({
  order,
  state,
  breakdown,
  errors,
  onReasonChange,
  onNoteChange,
  onChannelChange,
  onIncludeDeliveryFee,
  onRetryQuote,
}: Props) {
  const { currency } = order
  const show = state.showValidation
  const showLateDeliveryHint =
    state.reason === 'late_delivery' &&
    isDeliveryFeeRefundable(order) &&
    !state.selection.includeDeliveryFee

  return (
    <Stack spacing={3}>
      <Box component="section" aria-labelledby="refund-summary-title">
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Typography id="refund-summary-title" variant="h3" component="h3">
            Items to refund
          </Typography>
          {breakdown.isFullRefund && <Chip size="small" color="primary" label="Full refund" />}
        </Stack>

        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 2 }}>
          <Stack component="ul" spacing={1.25} sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {breakdown.items.map((item) => (
              <Box component="li" key={item.unitId}>
                <SummaryRow
                  label={
                    <>
                      {item.name}
                      {item.unitCount > 1 && (
                        <Typography component="span" variant="body2" color="text.secondary">
                          {' '}
                          · Unit {item.unitIndex} of {item.unitCount}
                        </Typography>
                      )}
                    </>
                  }
                  amount={item.price}
                  currency={currency}
                />
                {item.addons.map((addon) => (
                  <SummaryRow
                    key={addon.id}
                    muted
                    label={`+ ${addon.name}`}
                    amount={addon.price}
                    currency={currency}
                  />
                ))}
                {item.excludedAddons.map((addon) => (
                  <Stack
                    key={addon.id}
                    direction="row"
                    spacing={2}
                    sx={{ justifyContent: 'space-between', pl: 2 }}
                  >
                    <Typography
                      variant="body2"
                      color="text.disabled"
                      sx={{ textDecoration: 'line-through' }}
                    >
                      + {addon.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="warning.dark"
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Not refunded
                    </Typography>
                  </Stack>
                ))}
              </Box>
            ))}
            {breakdown.deliveryFee > 0 && (
              <Box component="li">
                <SummaryRow
                  label="Delivery fee"
                  amount={breakdown.deliveryFee}
                  currency={currency}
                />
              </Box>
            )}
          </Stack>

          {breakdown.excludedAddonCount > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }}>
              {breakdown.excludedAddonCount === 1
                ? '1 add-on is'
                : `${breakdown.excludedAddonCount} add-ons are`}{' '}
              not included. Add-ons can't be refunded without their drink, so{' '}
              {breakdown.excludedAddonCount === 1 ? 'it' : 'they'} can't be refunded later. Go back
              to include {breakdown.excludedAddonCount === 1 ? 'it' : 'them'}.
            </Alert>
          )}

          <Divider sx={{ my: 1.5 }} />
          <RefundTotal
            state={state}
            breakdown={breakdown}
            currency={currency}
            onRetry={onRetryQuote}
          />
        </Box>
      </Box>

      <Box component="section" aria-labelledby="refund-details-title">
        <Typography id="refund-details-title" variant="h3" component="h3" sx={{ mb: 2 }}>
          Refund details
        </Typography>
        <Stack spacing={2.5}>
          <TextField
            select
            required
            fullWidth
            label="Reason"
            value={state.reason}
            onChange={(e) => onReasonChange(e.target.value as RefundReason)}
            error={show && !!errors.reason}
            helperText={show && errors.reason}
          >
            {REFUND_REASONS.map((r) => (
              <MenuItem key={r.value} value={r.value}>
                {r.label}
              </MenuItem>
            ))}
          </TextField>

          {showLateDeliveryHint && (
            <Alert
              severity="info"
              action={
                <Button color="inherit" size="small" onClick={onIncludeDeliveryFee}>
                  Include fee
                </Button>
              }
            >
              The delivery fee ({formatMoney(order.deliveryFee!.amount, currency)}) isn't included
              in this refund.
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            minRows={2}
            required={state.reason === 'other'}
            label={state.reason === 'other' ? 'Note' : 'Note (optional)'}
            value={state.note}
            onChange={(e) => onNoteChange(e.target.value)}
            error={show && !!errors.note}
            helperText={
              (show && errors.note) ||
              `${state.note.length}/${NOTE_MAX_LENGTH} · Visible to staff only`
            }
            slotProps={{ htmlInput: { maxLength: NOTE_MAX_LENGTH + 50 } }}
          />

          <FormControl required error={show && !!errors.channel}>
            <FormLabel
              id="refund-channel-label"
              sx={{ mb: 1, color: 'text.primary', fontWeight: 600 }}
            >
              Refund to
            </FormLabel>
            <RadioGroup
              aria-labelledby="refund-channel-label"
              value={state.channel}
              onChange={(e) => onChannelChange(e.target.value as RefundChannel)}
              sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}
            >
              {REFUND_CHANNELS.map((channel) => {
                const selected = state.channel === channel.value
                return (
                  <Box
                    key={channel.value}
                    component="label"
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 0.5,
                      p: 1.5,
                      pl: 0.5,
                      border: 1,
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? 'primary.light' : 'background.paper',
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    <Radio value={channel.value} sx={{ mt: -0.75 }} />
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {channel.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {channel.description}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </RadioGroup>
            {show && errors.channel && <FormHelperText>{errors.channel}</FormHelperText>}
          </FormControl>
        </Stack>
      </Box>
    </Stack>
  )
}

function SummaryRow({
  label,
  amount,
  currency,
  muted,
}: {
  label: ReactNode
  amount: number
  currency: string
  muted?: boolean
}) {
  return (
    <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', pl: muted ? 2 : 0 }}>
      <Typography
        variant="body2"
        color={muted ? 'text.secondary' : 'text.primary'}
        sx={{ fontWeight: muted ? 400 : 500, overflowWrap: 'anywhere' }}
      >
        {label}
      </Typography>
      <Money
        amount={amount}
        currency={currency}
        color={muted ? 'text.secondary' : 'text.primary'}
      />
    </Stack>
  )
}

function RefundTotal({
  state,
  breakdown,
  currency,
  onRetry,
}: {
  state: RefundFlowState
  breakdown: RefundBreakdown
  currency: string
  onRetry: () => void
}) {
  const { quote } = state
  const amount = quote.status === 'success' ? quote.quote.total : breakdown.total
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          Refund amount
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {quote.status === 'loading' && (
            <CircularProgress size={16} aria-label="Confirming amount" />
          )}
          <Money
            amount={amount}
            currency={currency}
            variant="h2"
            component="p"
            color={quote.status === 'success' ? 'primary' : 'text.secondary'}
            data-testid="review-total"
          />
        </Stack>
      </Stack>
      {quote.status === 'loading' && (
        <Typography variant="caption" color="text.secondary" role="status">
          Confirming the final amount with the server…
        </Typography>
      )}
      {quote.status === 'success' && quote.quote.total !== breakdown.total && (
        <Alert severity="warning">
          The final amount from the server ({formatMoney(quote.quote.total, currency)}) differs from
          the preview ({formatMoney(breakdown.total, currency)}). The server amount will be
          refunded.
        </Alert>
      )}
      {quote.status === 'error' && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          }
        >
          Couldn't confirm the refund amount. {quote.error.message}
        </Alert>
      )}
    </Stack>
  )
}
