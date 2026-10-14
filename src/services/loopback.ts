import type { IncomingMessage } from 'http'

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]']

/**
 * Accepts only requests addressed to a loopback host and, when a page sent them, coming from one: another site can then reach the local
 * servers neither through DNS rebinding nor through a cross-site form post. With an expected `origin`, the request must come from exactly
 * that origin, which also shuts out other local servers.
 */
export function isLoopbackRequest({ headers }: IncomingMessage, origin?: string): boolean {
  if (!LOOPBACK.includes(URL.parse(`http://${headers.host}`)?.hostname)) {
    return false
  }

  if (origin) {
    return headers.origin === origin
  }

  return !headers.origin || LOOPBACK.includes(URL.parse(headers.origin)?.hostname)
}
