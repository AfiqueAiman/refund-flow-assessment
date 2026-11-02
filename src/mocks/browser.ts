import { setupWorker } from 'msw/browser'
import { configureApiClient } from '../api/client'
import { configureFromUrl } from './config'
import { handlers } from './handlers'
import { inPageTransport } from './inPageTransport'

export async function startMockApi() {
  configureFromUrl(window.location.search)
  configureApiClient({ logRequests: true })

  if (import.meta.env.DEV) {
    // Development: real network interception, so calls also appear in the Network tab.
    // If the worker goes idle, a normal refresh brings it back.
    await setupWorker(...handlers).start({
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      onUnhandledFrame: 'bypass',
      quiet: true,
    })
  } else {
    // Deployed demo: no service worker, so it keeps working after the tab sits idle.
    configureApiClient({ transport: inPageTransport })
  }
}
