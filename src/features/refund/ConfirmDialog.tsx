import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import { formatMoney } from '../../domain/money'
import { channelLabel, type Minor, type RefundChannel } from '../../domain/types'
import type { SubmitState } from './useRefundFlow'

interface Props {
  open: boolean
  orderId: string
  amount: Minor
  currency: string
  channel: RefundChannel
  itemCount: number
  includesDeliveryFee: boolean
  submit: SubmitState
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  orderId,
  amount,
  currency,
  channel,
  itemCount,
  includesDeliveryFee,
  submit,
  onCancel,
  onConfirm,
}: Props) {
  const submitting = submit.status === 'submitting'
  const parts = [
    itemCount > 0 && `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`,
    includesDeliveryFee && 'the delivery fee',
  ].filter(Boolean)

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onCancel()}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { role: 'alertdialog' } }}
      aria-labelledby="confirm-refund-title"
      aria-describedby="confirm-refund-description"
    >
      <DialogTitle id="confirm-refund-title" sx={{ fontWeight: 700 }}>
        Confirm refund?
      </DialogTitle>
      <DialogContent>
        <Typography id="confirm-refund-description" variant="body2">
          Refund <strong className="tabular-nums">{formatMoney(amount, currency)}</strong> for{' '}
          {parts.join(' and ')} on order {orderId} to <strong>{channelLabel(channel)}</strong>.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This can't be undone.
        </Typography>
        {submit.status === 'error' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {submit.error.message} Retrying is safe: the customer won't be refunded twice.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onCancel} disabled={submitting} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" onClick={onConfirm} loading={submitting} autoFocus>
          {submit.status === 'error' ? 'Try again' : 'Confirm refund'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
