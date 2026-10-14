import { Injectable } from '@nestjs/common'

/**
 * Process-level concerns of long running sessions.
 */
@Injectable()
export class ProcessService {
  /**
   * Resolves on the first SIGINT or SIGTERM. Replaces the default handlers, which exit immediately and would skip closing the browser, the preview
   * server and the watcher.
   */
  public terminated(): Promise<void> {
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')

    return new Promise((resolve) => {
      process.once('SIGINT', () => resolve())
      process.once('SIGTERM', () => resolve())
    })
  }
}
