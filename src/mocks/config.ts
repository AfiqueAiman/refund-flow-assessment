export type MockScenario = 'conflict' | null

export interface MockConfig {
  minLatencyMs: number
  maxLatencyMs: number
  /** Probability (0-1) that a quote/refund request fails with a 500 or a network error. */
  failureRate: number
  /** Same for loading the order. Off by default so the demo opens reliably. */
  readFailureRate: number
  /** `conflict`: the first refund attempt finds an item already refunded by someone else. */
  scenario: MockScenario
}

export const mockConfig: MockConfig = {
  minLatencyMs: 400,
  maxLatencyMs: 1200,
  failureRate: 0.1,
  readFailureRate: 0,
  scenario: null,
}

/**
 * Lets reviewers exercise slow and failing paths from the URL, e.g.
 * `?latency=3000&failureRate=1` or `?scenario=conflict`.
 */
export function configureFromUrl(search: string) {
  const params = new URLSearchParams(search)
  const latency = params.get('latency')
  const failureRate = params.get('failureRate')
  if (latency !== null && !Number.isNaN(Number(latency))) {
    mockConfig.minLatencyMs = mockConfig.maxLatencyMs = Math.max(0, Number(latency))
  }
  if (failureRate !== null && !Number.isNaN(Number(failureRate))) {
    mockConfig.failureRate = mockConfig.readFailureRate = Math.min(
      1,
      Math.max(0, Number(failureRate)),
    )
  }
  if (params.get('scenario') === 'conflict') mockConfig.scenario = 'conflict'
}
