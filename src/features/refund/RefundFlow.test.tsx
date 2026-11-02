import { ThemeProvider } from '@mui/material/styles'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { mockConfig } from '../../mocks/config'
import { server } from '../../mocks/server'
import { OrderPage } from '../../pages/OrderPage'
import { theme } from '../../theme'

function renderOrderPage() {
  const user = userEvent.setup()
  render(
    <ThemeProvider theme={theme}>
      <OrderPage orderId="ORD-10482" />
    </ThemeProvider>,
  )
  return user
}

async function openRefundModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Refund' }))
  return screen.findByRole('dialog', { name: /refund order/i })
}

const total = () => screen.getByTestId('refund-total').textContent

async function fillDetailsAndConfirm(user: ReturnType<typeof userEvent.setup>, modal: HTMLElement) {
  await user.click(within(modal).getByRole('combobox', { name: /reason/i }))
  await user.click(await screen.findByRole('option', { name: 'Quality issue' }))
  await user.click(within(modal).getByRole('radio', { name: /in-app credit/i }))
  await waitFor(() => expect(within(modal).getByRole('button', { name: 'Confirm' })).toBeEnabled())
  await user.click(within(modal).getByRole('button', { name: 'Confirm' }))
  return screen.findByRole('alertdialog', { name: /confirm refund/i })
}

describe('refund flow', () => {
  it('shows the order and its items', async () => {
    renderOrderPage()
    expect(await screen.findByRole('heading', { name: 'ORD-10482' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /hazelnut americano/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refund' })).toBeEnabled()
  })

  it('shows the order refund status and disables Refund when nothing is left', async () => {
    const user = renderOrderPage()
    expect(await screen.findByText('Partially refunded')).toBeInTheDocument()

    const modal = await openRefundModal(user)
    await user.click(within(modal).getByRole('checkbox', { name: 'Select all refundable items' }))
    await user.click(within(modal).getByRole('checkbox', { name: 'Refund delivery fee' }))
    await user.click(within(modal).getByRole('button', { name: 'Next' }))
    const confirm = await fillDetailsAndConfirm(user, modal)
    await user.click(within(confirm).getByRole('button', { name: 'Confirm refund' }))
    await screen.findByText(/refunded .*59\.00/i)

    // L2-2's add-ons were never refunded, so the order is not fully refunded,
    // but there is nothing left that can be refunded.
    expect(screen.getByText('Partially refunded')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Refund' })).toBeDisabled()
  })

  it('updates the total live and enforces selection rules', async () => {
    const user = renderOrderPage()
    const modal = await openRefundModal(user)

    expect(within(modal).getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(
      within(modal).getByRole('checkbox', { name: /^iced spanish latte, unit 1 of 2$/i }),
    ).toBeDisabled()

    const addon = within(modal).getByRole('checkbox', {
      name: /extra shot add-on for iced spanish latte, unit 2/i,
    })
    expect(addon).toBeDisabled()

    await user.click(
      within(modal).getByRole('checkbox', { name: /^iced spanish latte, unit 2 of 2$/i }),
    )
    expect(addon).toBeEnabled()
    expect(addon).toBeChecked()
    expect(total()).toMatch(/15\.90/)

    await user.click(addon)
    expect(total()).toMatch(/13\.90/)

    // L2-2's drink was refunded without its add-ons, so they are paid but can no longer be refunded.
    expect(
      within(modal).getByRole('checkbox', { name: /oat milk add-on for hazelnut .*unit 2 of 2/i }),
    ).toBeDisabled()

    await user.click(within(modal).getByRole('checkbox', { name: 'Refund delivery fee' }))
    expect(total()).toMatch(/18\.90/)
    expect(within(modal).getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('selects all remaining refundable items as a full refund', async () => {
    const user = renderOrderPage()
    const modal = await openRefundModal(user)
    await user.click(within(modal).getByRole('checkbox', { name: 'Select all refundable items' }))
    expect(within(modal).getByText('Full refund')).toBeInTheDocument()
    expect(total()).toMatch(/54\.00/)
  })

  it('submits a refund, closes all dialogs and updates the order', async () => {
    const user = renderOrderPage()
    const modal = await openRefundModal(user)
    await user.click(
      within(modal).getByRole('checkbox', { name: /butter croissant, unit 1 of 3/i }),
    )
    await user.click(within(modal).getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(screen.getByTestId('review-total').textContent).toMatch(/7\.90/))
    const confirm = await fillDetailsAndConfirm(user, modal)
    expect(confirm).toHaveTextContent(/7\.90/)
    expect(confirm).toHaveTextContent(/in-app credit/i)

    await user.click(within(confirm).getByRole('button', { name: 'Confirm refund' }))

    expect(await screen.findByText(/refunded .*7\.90 to in-app credit/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /refund order/i })).not.toBeInTheDocument(),
    )
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Refund' }))
    const reopened = await screen.findByRole('dialog', { name: /refund order/i })
    expect(
      within(reopened).getByRole('checkbox', { name: /butter croissant, unit 1 of 3/i }),
    ).toBeDisabled()
  })

  it('warns when an add-on is left out of a drink refund, then labels it not refundable', async () => {
    const user = renderOrderPage()
    const modal = await openRefundModal(user)
    await user.click(
      within(modal).getByRole('checkbox', { name: /^iced spanish latte, unit 2 of 2$/i }),
    )
    expect(within(modal).queryByText(/can't be refunded later/i)).not.toBeInTheDocument()
    await user.click(
      within(modal).getByRole('checkbox', {
        name: /extra shot add-on for iced spanish latte, unit 2/i,
      }),
    )
    expect(within(modal).getByRole('alert')).toHaveTextContent(
      /extra shot won't be refunded, and can't be refunded later/i,
    )

    await user.click(within(modal).getByRole('button', { name: 'Next' }))
    expect(within(modal).getByText('Not refunded')).toBeInTheDocument()
    expect(within(modal).getByText(/1 add-on is not included/i)).toBeInTheDocument()
    const confirm = await fillDetailsAndConfirm(user, modal)
    await user.click(within(confirm).getByRole('button', { name: 'Confirm refund' }))
    await screen.findByText(/refunded .*13\.90/i)

    const reopened = await openRefundModal(user)
    const addon = within(reopened).getByRole('checkbox', {
      name: /extra shot add-on for iced spanish latte, unit 2/i,
    })
    expect(addon).toBeDisabled()
    const addonRow = addon.closest('label')!
    expect(within(addonRow).getByText('Not refundable')).toBeInTheDocument()
    expect(within(addonRow).queryByText(/^refunded/i)).not.toBeInTheDocument()
  })

  it('keeps the refund modal and its state when the confirmation is cancelled', async () => {
    const user = renderOrderPage()
    const modal = await openRefundModal(user)
    await user.click(
      within(modal).getByRole('checkbox', { name: /butter croissant, unit 2 of 3/i }),
    )
    await user.click(within(modal).getByRole('button', { name: 'Next' }))
    const confirm = await fillDetailsAndConfirm(user, modal)

    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: /refund order/i, hidden: true })).toBeInTheDocument()
    expect(within(modal).getByRole('combobox', { name: /reason/i })).toHaveTextContent(
      'Quality issue',
    )

    await user.click(within(modal).getByRole('button', { name: 'Back' }))
    expect(
      within(modal).getByRole('checkbox', { name: /butter croissant, unit 2 of 3/i }),
    ).toBeChecked()
  })

  it('shows an error and lets staff retry when the refund request fails', async () => {
    server.use(
      http.post(
        '*/api/orders/:orderId/refunds',
        () =>
          HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Payment provider unavailable.' } },
            { status: 503 },
          ),
        { once: true },
      ),
    )
    const user = renderOrderPage()
    const modal = await openRefundModal(user)
    await user.click(
      within(modal).getByRole('checkbox', { name: /butter croissant, unit 3 of 3/i }),
    )
    await user.click(within(modal).getByRole('button', { name: 'Next' }))
    const confirm = await fillDetailsAndConfirm(user, modal)

    await user.click(within(confirm).getByRole('button', { name: 'Confirm refund' }))
    expect(await within(confirm).findByText(/payment provider unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: /refund order/i, hidden: true })).toBeInTheDocument()

    await user.click(within(confirm).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/refunded .*7\.90/i)).toBeInTheDocument()
  })

  it('removes items refunded by someone else and asks staff to review again', async () => {
    mockConfig.scenario = 'conflict'
    const user = renderOrderPage()
    const modal = await openRefundModal(user)
    await user.click(
      within(modal).getByRole('checkbox', { name: /butter croissant, unit 1 of 3/i }),
    )
    await user.click(
      within(modal).getByRole('checkbox', { name: /butter croissant, unit 2 of 3/i }),
    )
    await user.click(within(modal).getByRole('button', { name: 'Next' }))
    const confirm = await fillDetailsAndConfirm(user, modal)
    await user.click(within(confirm).getByRole('button', { name: 'Confirm refund' }))

    expect(await within(modal).findByText(/refunded by someone else/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('review-total').textContent).toMatch(/7\.90/))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
