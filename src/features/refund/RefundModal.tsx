import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import SvgIcon from '@mui/material/SvgIcon'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { RefundResult } from '../../api/orders'
import { Money } from '../../components/Money'
import type { Order } from '../../domain/types'
import { ConfirmDialog } from './ConfirmDialog'
import { ReviewStep } from './ReviewStep'
import { SelectItemsStep } from './SelectItemsStep'
import { useRefundFlow } from './useRefundFlow'

interface Props {
  open: boolean
  order: Order
  onClose: () => void
  onRefunded: (result: RefundResult) => void
  onOrderStale: () => Promise<unknown>
}

const STEPS = ['Select items', 'Review & details']

export function RefundModal({ open, order, onClose, onRefunded, onOrderStale }: Props) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const { state, breakdown, errors, allSelectableCount, actions, submit } = useRefundFlow({
    order,
    onRefunded,
    onOrderStale,
  })
  const { step, quote, submit: submitState } = state
  const submitting = submitState.status === 'submitting'
  const footerAmount =
    step === 'review' && quote.status === 'success' ? quote.quote.total : breakdown.total
  const itemCount = breakdown.items.length

  const handleClose = (_: unknown, reason?: 'backdropClick' | 'escapeKeyDown') => {
    // Avoid losing a half-finished refund to a stray click outside the modal.
    if (reason === 'backdropClick' || submitting) return
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      aria-labelledby="refund-modal-title"
      slotProps={{
        paper: { sx: { height: fullScreen ? '100%' : 'min(860px, calc(100% - 64px))' } },
      }}
    >
      <DialogTitle id="refund-modal-title" sx={{ pr: 7, pb: 1 }}>
        <Typography component="span" variant="h2" sx={{ display: 'block' }}>
          Refund order
        </Typography>
        <Typography component="span" variant="body2" color="text.secondary">
          {order.id}
        </Typography>
      </DialogTitle>
      <IconButton
        aria-label="Close"
        onClick={() => handleClose(null)}
        disabled={submitting}
        sx={{ position: 'absolute', right: 12, top: 12 }}
      >
        <SvgIcon fontSize="small">
          <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </SvgIcon>
      </IconButton>

      <Box sx={{ px: 3, pb: 2 }}>
        <Stepper activeStep={step === 'select' ? 0 : 1} aria-label="Refund steps">
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent dividers>
        {state.notice && (
          <Alert severity="warning" onClose={actions.dismissNotice} sx={{ mb: 2 }}>
            {state.notice}
          </Alert>
        )}
        {step === 'select' ? (
          <SelectItemsStep
            order={order}
            selection={state.selection}
            breakdown={breakdown}
            allSelectableCount={allSelectableCount}
            onToggleUnit={actions.toggleUnit}
            onToggleAddon={actions.toggleAddon}
            onToggleAll={actions.toggleAll}
            onToggleDeliveryFee={actions.setDeliveryFee}
          />
        ) : (
          <ReviewStep
            order={order}
            state={state}
            breakdown={breakdown}
            errors={errors}
            onReasonChange={actions.setReason}
            onNoteChange={actions.setNote}
            onChannelChange={actions.setChannel}
            onIncludeDeliveryFee={() => actions.setDeliveryFee(true)}
            onRetryQuote={actions.retryQuote}
          />
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          gap: 2,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          bgcolor: 'background.default',
        }}
      >
        <Box aria-live="polite">
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Refund total
            {(itemCount > 0 || breakdown.deliveryFee > 0) &&
              ` · ${itemCount} ${itemCount === 1 ? 'item' : 'items'}${breakdown.deliveryFee > 0 ? ' + delivery' : ''}`}
          </Typography>
          <Money
            amount={footerAmount}
            currency={order.currency}
            variant="h2"
            component="p"
            color="primary"
            data-testid="refund-total"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          {step === 'select' ? (
            <>
              <Button color="inherit" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="contained" onClick={actions.goToReview} disabled={breakdown.isEmpty}>
                Next
              </Button>
            </>
          ) : (
            <>
              <Button color="inherit" onClick={actions.backToSelect} disabled={submitting}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={actions.openConfirm}
                disabled={quote.status !== 'success' || breakdown.isEmpty}
              >
                Confirm
              </Button>
            </>
          )}
        </Box>
      </DialogActions>

      {state.channel && quote.status === 'success' && (
        <ConfirmDialog
          open={state.confirmOpen}
          orderId={order.id}
          amount={quote.quote.total}
          currency={order.currency}
          channel={state.channel}
          itemCount={itemCount}
          includesDeliveryFee={breakdown.deliveryFee > 0}
          submit={submitState}
          onCancel={actions.closeConfirm}
          onConfirm={submit}
        />
      )}
    </Dialog>
  )
}
