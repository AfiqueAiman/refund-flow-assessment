import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import type { AddonRefundState } from '../domain/refundCalculation'
import type { PaymentStatus } from '../domain/types'

interface Props {
  status: PaymentStatus
  label?: string
}

export function StatusChip({ status, label }: Props) {
  return status === 'refunded' ? (
    <Chip
      size="small"
      label={label ?? 'Refunded'}
      sx={{ bgcolor: 'grey.200', color: 'text.secondary' }}
    />
  ) : (
    <Chip size="small" variant="outlined" color="primary" label={label ?? 'Paid'} />
  )
}

export const LOCKED_ADDON_HINT =
  "Its drink was already refunded without this add-on, and add-ons can't be refunded on their own."

/** Only non-refundable add-ons get a chip; refundable ones follow their drink's status. */
export function AddonStatusChip({
  state,
  lockedLabel,
}: {
  state: AddonRefundState
  lockedLabel: string
}) {
  if (state === 'refunded') return <StatusChip status="refunded" />
  if (state === 'refundable') return null
  return (
    <Tooltip title={LOCKED_ADDON_HINT}>
      <Chip
        size="small"
        variant="outlined"
        label={lockedLabel}
        aria-description={LOCKED_ADDON_HINT}
        sx={{ color: 'text.secondary', borderColor: 'grey.400' }}
      />
    </Tooltip>
  )
}
