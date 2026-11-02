import type { Minor } from './types'

const digitsCache = new Map<string, number>()

/** Number of minor-unit digits for a currency (MYR: 2, JPY: 0, BHD: 3). */
export function currencyDigits(currency: string): number {
  let digits = digitsCache.get(currency)
  if (digits === undefined) {
    digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits as number
    digitsCache.set(currency, digits)
  }
  return digits
}

/** Converts a decimal major amount (as sent by the API) to integer minor units. */
export function toMinor(amount: number, currency: string): Minor {
  // Shifting via the exponent avoids cases like 1.005 * 100 = 100.49999999999999.
  return Math.round(Number(`${amount}e${currencyDigits(currency)}`))
}

/** Converts integer minor units back to a decimal major amount for the API. */
export function toMajor(amount: Minor, currency: string): number {
  return amount / 10 ** currencyDigits(currency)
}

export function formatMoney(amount: Minor, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    toMajor(amount, currency),
  )
}
