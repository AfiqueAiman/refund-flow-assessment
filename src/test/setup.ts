import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetMockDb } from '../mocks/db'
import { mockConfig } from '../mocks/config'
import { server } from '../mocks/server'

const disableMockChaos = () =>
  Object.assign(mockConfig, {
    minLatencyMs: 0,
    maxLatencyMs: 0,
    failureRate: 0,
    readFailureRate: 0,
    scenario: null,
  })

beforeAll(() => {
  disableMockChaos()
  server.listen({ onUnhandledFrame: 'error' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetMockDb()
  disableMockChaos()
})

afterAll(() => server.close())
