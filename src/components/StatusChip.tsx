import Chip from '@mui/material/Chip'
import SvgIcon from '@mui/material/SvgIcon'
import Tooltip from '@mui/material/Tooltip'
import type { ComponentProps, ReactNode } from 'react'
import type { AddonRefundState, OrderRefundStatus } from '../domain/refundCalculation'
import type { PaymentStatus } from '../domain/types'
import { statusColors } from '../theme'

/** Each status has its own colour and icon, so it never relies on colour alone. */
const ICON_PATHS = {
  paid: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  partial:
    'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10m1-17.93c3.94.49 7 3.86 7 7.93s-3.06 7.44-7 7.93z',
  refunded:
    'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8',
  locked: 'M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z',
} as const

type Tone = keyof typeof statusColors

/** Forwards remaining props (and `ref`) so it can be wrapped in a Tooltip. */
function ToneChip({
  tone,
  label,
  ...rest
}: { tone: Tone; label: ReactNode } & Omit<ComponentProps<typeof Chip>, 'label' | 'icon' | 'sx'>) {
  const colors = statusColors[tone]
  return (
    <Chip
      size="small"
      label={label}
      icon={
        <SvgIcon>
          <path d={ICON_PATHS[tone]} />
        </SvgIcon>
      }
      {...rest}
      sx={{
        bgcolor: colors.bg,
        color: colors.fg,
        border: 1,
        borderColor: 'border' in colors ? colors.border : 'transparent',
        '& .MuiChip-icon': { color: 'inherit', fontSize: 14, ml: '6px' },
      }}
    />
  )
}

interface Props {
  status: PaymentStatus
  label?: string
}

export function StatusChip({ status, label }: Props) {
  return status === 'refunded' ? (
    <ToneChip tone="refunded" label={label ?? 'Refunded'} />
  ) : (
    <ToneChip tone="paid" label={label ?? 'Paid'} />
  )
}

const ORDER_REFUND_CHIPS = {
  none: { tone: 'paid', label: 'No refunds' },
  partial: { tone: 'partial', label: 'Partially refunded' },
  full: { tone: 'refunded', label: 'Fully refunded' },
} as const

export function OrderRefundChip({ status }: { status: OrderRefundStatus }) {
  const { tone, label } = ORDER_REFUND_CHIPS[status]
  return <ToneChip tone={tone} label={label} />
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
      <ToneChip tone="locked" label={lockedLabel} aria-description={LOCKED_ADDON_HINT} />
    </Tooltip>
  )
}
