import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Money } from '../../components/Money'
import { AddonStatusChip, StatusChip } from '../../components/StatusChip'
import { addonRefundState } from '../../domain/refundCalculation'
import type { Order } from '../../domain/types'

export function OrderItemsList({ order }: { order: Order }) {
  const { currency } = order
  return (
    <Stack
      component="ul"
      divider={<Divider component="li" aria-hidden />}
      sx={{ m: 0, p: 0, listStyle: 'none' }}
    >
      {order.lines.map((line) => (
        <Box component="li" key={line.id} sx={{ py: 2 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
          >
            <Typography variant="h3" component="h3" sx={{ overflowWrap: 'anywhere' }}>
              {line.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {line.units.length} × <Money amount={line.unitPrice} currency={currency} />
            </Typography>
          </Stack>

          <Stack component="ul" spacing={1} sx={{ m: 0, mt: 1.5, p: 0, listStyle: 'none' }}>
            {line.units.map((unit) => {
              const refunded = unit.status === 'refunded'
              return (
                <Box
                  component="li"
                  key={unit.id}
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderRadius: 2,
                    bgcolor: refunded ? 'grey.50' : 'primary.light',
                    // Mute text rather than the whole row, so status chips keep their colour.
                    color: refunded ? 'text.secondary' : 'text.primary',
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                      Unit {unit.index}
                      {line.units.length > 1 && (
                        <Typography component="span" variant="body2" color="text.secondary">
                          {' '}
                          of {line.units.length}
                        </Typography>
                      )}
                    </Typography>
                    <StatusChip status={unit.status} />
                    <Money
                      amount={unit.price}
                      currency={currency}
                      sx={{ minWidth: 72, textAlign: 'right' }}
                    />
                  </Stack>
                  {unit.addons.length > 0 && (
                    <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2, listStyle: 'none' }}>
                      {unit.addons.map((addon) => (
                        <Stack
                          component="li"
                          key={addon.id}
                          direction="row"
                          spacing={1.5}
                          sx={{ alignItems: 'center', py: 0.25 }}
                        >
                          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                            + {addon.name}
                          </Typography>
                          <AddonStatusChip
                            state={addonRefundState(unit, addon)}
                            lockedLabel="Not refunded"
                          />
                          <Money
                            amount={addon.price}
                            currency={currency}
                            color="text.secondary"
                            sx={{ minWidth: 72, textAlign: 'right' }}
                          />
                        </Stack>
                      ))}
                    </Box>
                  )}
                </Box>
              )
            })}
          </Stack>
        </Box>
      ))}
    </Stack>
  )
}
