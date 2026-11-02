import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
import { formatList } from '../../components/format'
import { Money } from '../../components/Money'
import { AddonStatusChip } from '../../components/StatusChip'
import {
  addonKey,
  addonRefundState,
  isDeliveryFeeRefundable,
  isUnitRefundable,
  type RefundBreakdown,
} from '../../domain/refundCalculation'
import type { Order, RefundSelection } from '../../domain/types'

interface Props {
  order: Order
  selection: RefundSelection
  breakdown: RefundBreakdown
  allSelectableCount: number
  onToggleUnit: (unitId: string) => void
  onToggleAddon: (unitId: string, addonId: string) => void
  onToggleAll: () => void
  onToggleDeliveryFee: (include: boolean) => void
}

export function SelectItemsStep({
  order,
  selection,
  breakdown,
  allSelectableCount,
  onToggleUnit,
  onToggleAddon,
  onToggleAll,
  onToggleDeliveryFee,
}: Props) {
  const { currency } = order
  const selectedCount = selection.unitIds.size
  const feeRefundable = isDeliveryFeeRefundable(order)
  const excludedByUnit = new Map(breakdown.items.map((i) => [i.unitId, i.excludedAddons]))

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Select the items to refund. Add-ons can only be refunded together with their drink.
      </Typography>

      <SelectableRow
        checked={breakdown.isFullRefund}
        indeterminate={selectedCount > 0 && !breakdown.isFullRefund}
        disabled={allSelectableCount === 0}
        onChange={onToggleAll}
        ariaLabel="Select all refundable items"
        sx={{ bgcolor: 'background.default' }}
        label={
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Select all refundable items
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}
              ({allSelectableCount})
            </Typography>
          </Typography>
        }
        trailing={
          breakdown.isFullRefund && <Chip size="small" color="primary" label="Full refund" />
        }
      />

      {order.lines.map((line) => (
        <Box key={line.id} component="section" aria-labelledby={`line-${line.id}`}>
          <Typography
            id={`line-${line.id}`}
            variant="h3"
            component="h3"
            sx={{ mb: 1, overflowWrap: 'anywhere' }}
          >
            {line.name}
          </Typography>
          <Stack spacing={1}>
            {line.units.map((unit) => {
              const unitRefundable = isUnitRefundable(unit)
              const unitSelected = selection.unitIds.has(unit.id)
              const excludedAddons = excludedByUnit.get(unit.id) ?? []
              const unitLabel =
                line.units.length > 1 ? `Unit ${unit.index} of ${line.units.length}` : 'Unit 1'
              return (
                <Box
                  key={unit.id}
                  sx={{
                    border: 1,
                    borderColor: unitSelected ? 'primary.main' : 'divider',
                    borderRadius: 2,
                    bgcolor: unitSelected ? 'primary.light' : 'background.paper',
                    transition: 'background-color 120ms, border-color 120ms',
                  }}
                >
                  <SelectableRow
                    checked={unitSelected}
                    disabled={!unitRefundable}
                    onChange={() => onToggleUnit(unit.id)}
                    ariaLabel={`${line.name}, ${unitLabel.toLowerCase()}`}
                    label={
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {unitLabel}
                      </Typography>
                    }
                    trailing={
                      <>
                        {!unitRefundable && <RefundedChip />}
                        <Money
                          amount={unit.price}
                          currency={currency}
                          sx={{ minWidth: 72, textAlign: 'right' }}
                        />
                      </>
                    }
                  />
                  {unit.addons.length > 0 && (
                    <Stack sx={{ pl: 4, pb: 0.5 }}>
                      {unit.addons.map((addon) => {
                        const addonState = addonRefundState(unit, addon)
                        const addonRefundable = addonState === 'refundable'
                        const checked = selection.addonKeys.has(addonKey(unit.id, addon.id))
                        return (
                          <SelectableRow
                            key={addon.id}
                            dense
                            checked={checked}
                            disabled={!addonRefundable || !unitSelected}
                            onChange={() => onToggleAddon(unit.id, addon.id)}
                            ariaLabel={`${addon.name} add-on for ${line.name}, ${unitLabel.toLowerCase()}`}
                            label={
                              <Typography variant="body2" color="text.secondary">
                                + {addon.name}
                              </Typography>
                            }
                            trailing={
                              <>
                                <AddonStatusChip state={addonState} lockedLabel="Not refundable" />
                                <Money
                                  amount={addon.price}
                                  currency={currency}
                                  color="text.secondary"
                                  sx={{ minWidth: 72, textAlign: 'right' }}
                                />
                              </>
                            }
                          />
                        )
                      })}
                    </Stack>
                  )}
                  {excludedAddons.length > 0 && (
                    <Alert severity="warning" sx={{ mx: 1.5, mb: 1.5, py: 0 }}>
                      {formatList(excludedAddons.map((a) => a.name))} won't be refunded, and can't
                      be refunded later once this drink is refunded.
                    </Alert>
                  )}
                </Box>
              )
            })}
          </Stack>
        </Box>
      ))}

      {order.deliveryFee && (
        <>
          <Divider />
          <Box
            sx={{
              border: 1,
              borderColor: selection.includeDeliveryFee ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: selection.includeDeliveryFee ? 'primary.light' : 'background.paper',
            }}
          >
            <SelectableRow
              checked={selection.includeDeliveryFee}
              disabled={!feeRefundable}
              onChange={() => onToggleDeliveryFee(!selection.includeDeliveryFee)}
              ariaLabel="Refund delivery fee"
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Delivery fee
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Optional
                  </Typography>
                </Box>
              }
              trailing={
                <>
                  {!feeRefundable && <RefundedChip />}
                  <Money
                    amount={order.deliveryFee.amount}
                    currency={currency}
                    sx={{ minWidth: 72, textAlign: 'right' }}
                  />
                </>
              }
            />
          </Box>
        </>
      )}
    </Stack>
  )
}

function RefundedChip({ label = 'Refunded' }: { label?: string }) {
  return <Chip size="small" label={label} sx={{ bgcolor: 'grey.200', color: 'text.secondary' }} />
}

interface RowProps {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  dense?: boolean
  onChange: () => void
  ariaLabel: string
  label: ReactNode
  trailing?: ReactNode
  sx?: object
}

/** A full-width clickable row: large touch target for tablets, price aligned right. */
function SelectableRow({
  checked,
  indeterminate,
  disabled,
  dense,
  onChange,
  ariaLabel,
  label,
  trailing,
  sx,
}: RowProps) {
  return (
    <Box
      component="label"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pr: 2,
        minHeight: dense ? 40 : 48,
        borderRadius: 2,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        ...sx,
      }}
    >
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        onChange={onChange}
        size={dense ? 'small' : 'medium'}
        slotProps={{ input: { 'aria-label': ariaLabel } }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>{label}</Box>
      {trailing && (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {trailing}
        </Stack>
      )}
    </Box>
  )
}
