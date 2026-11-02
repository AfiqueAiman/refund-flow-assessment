import { getResponse } from 'msw'
import type { Transport } from '../api/client'
import { handlers } from './handlers'

/**
 * Answers API requests inside the page using the same MSW handlers.
 * The service worker's list of mocked pages lives in memory, so when the browser
 * stops an idle worker (e.g. the tab sat in the background) requests silently fall
 * through to the network. The deployed demo must not depend on that.
 */
export const inPageTransport: Transport = async (request) => {
  const response = await getResponse(handlers, request)
  if (request.signal.aborted) throw new DOMException('The request was aborted.', 'AbortError')
  if (!response) return fetch(request)
  // `HttpResponse.error()` stands for a network failure, which `fetch` reports by rejecting.
  if (response.type === 'error') throw new TypeError('Failed to fetch')
  return response
}
