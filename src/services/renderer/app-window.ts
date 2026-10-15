import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { once } from 'events'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * A browser window in app mode with a throwaway profile, so it shares no tabs, cookies or history with the browser of the user.
 */
export class AppWindow {
  /**
   * Resolves when the window exits, rejects when the browser can not be started.
   */
  public readonly closed: Promise<void>

  private constructor(
    private readonly process: ChildProcess,
    private readonly profile: string
  ) {
    this.closed = new Promise<void>((resolve, reject) => {
      process.once('exit', () => resolve())
      process.once('error', reject)
    })

    // an owner that never waits for the window must not crash the process when the browser fails to start
    this.closed.catch((): undefined => undefined)
  }

  public static async open(executable: string, url: string): Promise<AppWindow> {
    const profile = await mkdtemp(join(tmpdir(), 'md-printer-window-'))

    return new AppWindow(spawn(executable, [`--app=${url}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check'], { stdio: 'ignore' }), profile)
  }

  public async close(): Promise<void> {
    // the browser holds its profile open until it exits
    if (this.process.exitCode === null && this.process.signalCode === null && this.process.kill()) {
      await once(this.process, 'exit')
    }

    await rm(this.profile, { recursive: true, force: true })
  }
}
