import Typography, { type TypographyProps } from '@mui/material/Typography'
import { formatMoney } from '../domain/money'
import type { Minor } from '../domain/types'

type Props = Omit<TypographyProps, 'children'> & {
  amount: Minor
  currency: string
  /** Renders a leading minus, e.g. for refunds in a summary. */
  negative?: boolean
}

export function Money({ amount, currency, negative, sx, ...props }: Props) {
  return (
    <Typography
      component="span"
      variant="body2"
      {...props}
      sx={[
        { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {negative && amount > 0 ? '−' : ''}
      {formatMoney(amount, currency)}
    </Typography>
  )
}
