import { useCallback, useEffect, useRef, useState } from 'react'
import { getOrder } from '../../api/orders'
import type { Order } from '../../domain/types'

export type OrderState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; order: Order; refreshing: boolean }

export function useOrder(orderId: string) {
  const [state, setState] = useState<OrderState>({ status: 'loading' })
  const latestRequest = useRef(0)

  const fetchOrder = useCallback(async (): Promise<Order> => {
    const requestId = ++latestRequest.current
    try {
      const order = await getOrder(orderId)
      if (requestId === latestRequest.current)
        setState({ status: 'success', order, refreshing: false })
      return order
    } catch (error) {
      if (requestId === latestRequest.current) {
        setState((s) =>
          s.status === 'success'
            ? { ...s, refreshing: false }
            : { status: 'error', error: error instanceof Error ? error : new Error(String(error)) },
        )
      }
      throw error
    }
  }, [orderId])

  /** Reloads the order; keeps the current data visible while refreshing. */
  const refresh = useCallback(() => {
    setState((s) => (s.status === 'success' ? { ...s, refreshing: true } : { status: 'loading' }))
    return fetchOrder()
  }, [fetchOrder])

  const replaceOrder = useCallback((order: Order) => {
    latestRequest.current++
    setState({ status: 'success', order, refreshing: false })
  }, [])

  useEffect(() => {
    fetchOrder().catch(() => {})
  }, [fetchOrder])

  return { state, refresh, replaceOrder }
}
