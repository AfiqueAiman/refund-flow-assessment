import type { ApiErrorBody, ApiErrorCode } from './contracts'

export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode | 'NETWORK_ERROR'
  /** Server-calculated amount, present on AMOUNT_MISMATCH. */
  readonly amount?: number

  constructor(status: number, code: ApiError['code'], message: string, amount?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.amount = amount
  }

  /** Conflicts mean the order changed underneath us and must be reloaded. */
  get isConflict() {
    return this.status === 409
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Sends a request and returns the response. Rejects on network errors, like `fetch`. */
export type Transport = (request: Request) => Promise<Response>

let transport: Transport = (req) => fetch(req)
let logRequests = false

/**
 * Lets the demo answer requests in the page instead of over the network, and turns on
 * a console log of every call. Components and API functions are unaware of either.
 */
export function configureApiClient(options: { transport?: Transport; logRequests?: boolean }) {
  if (options.transport) transport = options.transport
  if (options.logRequests !== undefined) logRequests = options.logRequests
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const req = new Request(new URL(`${API_BASE}${path}`, window.location.origin), {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
  })
  const startedAt = performance.now()
  let response: Response
  try {
    response = await transport(req)
  } catch (error) {
    if (logRequests) logCall(req, init.body, startedAt, 'network error', error)
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Unable to reach the server. Check your connection and try again.',
    )
  }

  const body: unknown = await response.json().catch(() => null)
  if (logRequests) logCall(req, init.body, startedAt, response.status, body)
  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.amount,
    )
  }
  return body as T
}

function logCall(
  req: Request,
  requestBody: BodyInit | null | undefined,
  startedAt: number,
  status: number | 'network error',
  responseBody: unknown,
) {
  const path = new URL(req.url).pathname
  const ms = Math.round(performance.now() - startedAt)
  const ok = typeof status === 'number' && status < 400
  console.groupCollapsed(
    `%c[api] ${req.method} ${path} → ${status} (${ms} ms)`,
    `color: ${ok ? '#2B3A7E' : '#C62828'}`,
  )
  if (typeof requestBody === 'string') console.log('request', JSON.parse(requestBody))
  console.log(status === 'network error' ? 'error' : 'response', responseBody)
  console.groupEnd()
}
