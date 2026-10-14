import type { IncomingMessage } from 'http'

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]']

/**
 * Accepts only requests addressed to a loopback host and, when a page sent them, coming from one: another site can then reach the local
 * servers neither through DNS rebinding nor through a cross-site form post.
 */
export function isLoopbackRequest({ headers }: IncomingMessage): boolean {
  const hostname = (value: string): string => value.replace(/^https?:\/\//, '').replace(/:\d+$/, '')

  return LOOPBACK.includes(hostname(headers.host ?? '')) && (!headers.origin || LOOPBACK.includes(hostname(headers.origin)))
}
