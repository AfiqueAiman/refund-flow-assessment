import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { type ReactNode, useCallback, useState } from 'react'
import type { RefundResult } from '../api/orders'
import { Money } from '../components/Money'
import { OrderRefundChip, StatusChip } from '../components/StatusChip'
import { formatMoney } from '../domain/money'
import { calculateOrderTotals, hasRefundableItems } from '../domain/refundCalculation'
import { channelLabel, type Order } from '../domain/types'
import { OrderItemsList } from '../features/order/OrderItemsList'
import { useOrder } from '../features/order/useOrder'
import { RefundModal } from '../features/refund/RefundModal'
import { statusColors } from '../theme'

export function OrderPage({ orderId }: { orderId: string }) {
  const { state, refresh, replaceOrder } = useOrder(orderId)
  const [refundOpen, setRefundOpen] = useState(false)
  // A new key per opening gives every refund a fresh state while keeping the close animation.
  const [refundSession, setRefundSession] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const handleRefunded = useCallback(
    (result: RefundResult) => {
      replaceOrder(result.order)
      setRefundOpen(false)
      setToast(
        `Refunded ${formatMoney(result.amount, result.order.currency)} to ${channelLabel(result.channel).toLowerCase()} (${result.refundId}).`,
      )
    },
    [replaceOrder],
  )

  if (state.status === 'loading') return <OrderPageSkeleton />
  if (state.status === 'error') {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => refresh().catch(() => {})}>
            Retry
          </Button>
        }
      >
        We couldn't load order {orderId}. {state.error.message}
      </Alert>
    )
  }

  const { order, refreshing } = state

  return (
    <Stack spacing={3}>
      <OrderHeader
        order={order}
        refreshing={refreshing}
        onRefund={() => {
          setRefundSession((s) => s + 1)
          setRefundOpen(true)
        }}
      />

      <Paper
        elevation={1}
        sx={{ p: { xs: 2, sm: 3 } }}
        component="section"
        aria-labelledby="items-title"
      >
        <Typography id="items-title" variant="h2" component="h2">
          Items
        </Typography>
        <OrderItemsList order={order} />
        <OrderTotals order={order} />
      </Paper>

      <RefundModal
        key={refundSession}
        open={refundOpen}
        order={order}
        onClose={() => setRefundOpen(false)}
        onRefunded={handleRefunded}
        onOrderStale={refresh}
      />

      <Snackbar
        open={toast !== null}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ width: '100%' }}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Stack>
  )
}

function OrderHeader({
  order,
  refreshing,
  onRefund,
}: {
  order: Order
  refreshing: boolean
  onRefund: () => void
}) {
  const canRefund = hasRefundableItems(order)
  const { refundableRemaining, refundedAmount, orderTotal, refundStatus, lockedAmount } =
    calculateOrderTotals(order)
  const nothingLeftReason =
    lockedAmount > 0
      ? "Nothing left to refund. Some add-ons were left out of earlier refunds and can't be refunded."
      : 'Everything on this order has already been refunded.'

  return (
    <Paper elevation={1} sx={{ p: { xs: 2, sm: 3 }, position: 'relative', overflow: 'hidden' }}>
      {refreshing && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <Box>
          <Typography variant="overline" color="text.secondary">
            Order
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography variant="h1" sx={{ mr: 0.5 }}>
              {order.id}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              color="primary"
              label={capitalize(order.status)}
              aria-description="Order status"
            />
            <OrderRefundChip status={refundStatus} />
          </Stack>
        </Box>
        <Tooltip title={canRefund ? '' : nothingLeftReason}>
          <span>
            <Button
              variant="contained"
              size="large"
              onClick={onRefund}
              disabled={!canRefund || refreshing}
            >
              Refund
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Stack
        direction="row"
        spacing={4}
        sx={{ mt: 2.5 }}
        divider={<Divider orientation="vertical" flexItem />}
      >
        <Stat
          label="Order total"
          value={<Money amount={orderTotal} currency={order.currency} variant="h3" />}
        />
        <Stat
          label="Refunded"
          value={<Money amount={refundedAmount} currency={order.currency} variant="h3" />}
        />
        <Stat
          label="Refundable"
          value={<Money amount={refundableRemaining} currency={order.currency} variant="h3" />}
        />
      </Stack>

      {lockedAmount > 0 && (
        <Alert
          severity="warning"
          sx={{
            mt: 2,
            py: 0.25,
            bgcolor: statusColors.locked.bg,
            color: statusColors.locked.fg,
            border: 1,
            borderColor: statusColors.locked.border,
            '& .MuiAlert-icon': { color: 'inherit' },
          }}
        >
          <strong className="tabular-nums">{formatMoney(lockedAmount, order.currency)}</strong> in
          add-ons can't be refunded: their drinks were refunded without them.
        </Alert>
      )}
    </Paper>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      {value}
    </Box>
  )
}

function OrderTotals({ order }: { order: Order }) {
  const { itemsTotal, orderTotal } = calculateOrderTotals(order)
  return (
    <Box sx={{ mt: 1, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Stack spacing={1} sx={{ maxWidth: 360, ml: 'auto' }}>
        <TotalRow label="Items">
          <Money amount={itemsTotal} currency={order.currency} />
        </TotalRow>
        {order.deliveryFee && (
          <TotalRow label="Delivery fee">
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {order.deliveryFee.status === 'refunded' && <StatusChip status="refunded" />}
              <Money amount={order.deliveryFee.amount} currency={order.currency} />
            </Stack>
          </TotalRow>
        )}
        <TotalRow label={<strong>Total paid</strong>}>
          <Money amount={orderTotal} currency={order.currency} sx={{ fontWeight: 700 }} />
        </TotalRow>
      </Stack>
    </Box>
  )
}

function TotalRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Stack>
  )
}

function OrderPageSkeleton() {
  return (
    <Stack spacing={3} aria-busy="true" aria-label="Loading order">
      <Paper elevation={1} sx={{ p: 3 }}>
        <Skeleton width={80} />
        <Skeleton width={220} height={40} />
        <Skeleton width={320} />
      </Paper>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Skeleton width={100} height={32} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={72} sx={{ mt: 2 }} />
        ))}
      </Paper>
    </Stack>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
