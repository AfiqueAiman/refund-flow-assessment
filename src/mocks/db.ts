import type { CreateRefundResponse, OrderDto } from '../api/contracts'
import seed from './data/order.json'

const STORAGE_KEY = 'zus-refund-mock-db'

interface MockDb {
  orders: Record<string, OrderDto>
  /** Idempotency-Key -> stored response, so retries never refund twice. */
  refundsByKey: Record<string, CreateRefundResponse>
  conflictTriggered: boolean
}

const storage = typeof window !== 'undefined' ? window.sessionStorage : null

const seedDb = (): MockDb => ({
  orders: { [seed.order_id]: structuredClone(seed) as OrderDto },
  refundsByKey: {},
  conflictTriggered: false,
})

function load(): MockDb {
  const raw = storage?.getItem(STORAGE_KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as MockDb
    } catch {
      storage?.removeItem(STORAGE_KEY)
    }
  }
  return seedDb()
}

let db = load()

export const getDb = () => db

/** Persists changes so a page reload shows the refunded state, like a real backend. */
export function saveDb() {
  storage?.setItem(STORAGE_KEY, JSON.stringify(db))
}

export function resetMockDb() {
  db = seedDb()
  storage?.removeItem(STORAGE_KEY)
}
