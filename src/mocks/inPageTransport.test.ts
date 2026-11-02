import { afterEach, describe, expect, it, vi } from 'vitest'
import { configureApiClient } from '../api/client'
import { getOrder } from '../api/orders'
import { mockConfig } from './config'
import { inPageTransport } from './inPageTransport'

describe('in-page mock transport', () => {
  afterEach(() => configureApiClient({ transport: (req) => fetch(req) }))

  it('answers API calls from the mock handlers without the network', async () => {
    configureApiClient({ transport: inPageTransport })
    const order = await getOrder('ORD-10482')
    expect(order.id).toBe('ORD-10482')
  })

  it('surfaces mock errors as API errors', async () => {
    configureApiClient({ transport: inPageTransport })
    await expect(getOrder('ORD-404')).rejects.toMatchObject({
      status: 404,
      code: 'ORDER_NOT_FOUND',
    })
  })

  it('turns simulated failures into network and server errors', async () => {
    configureApiClient({ transport: inPageTransport })
    mockConfig.readFailureRate = 1
    const random = vi.spyOn(Math, 'random')

    // The mock picks a network error for random values below 0.5, otherwise a 500.
    random.mockReturnValue(0.1)
    await expect(getOrder('ORD-10482')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
    random.mockReturnValue(0.9)
    await expect(getOrder('ORD-10482')).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    })
  })
})
