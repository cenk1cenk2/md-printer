import type { Hook } from '@oclif/core'

/**
 * The logger and the logo write to stdout, so they are silenced before the command starts when the output itself goes to stdout.
 */
const hook: Hook<'init'> = async({ argv }) => {
  if (argv.some((arg) => arg === '--stdout' || /^-[a-zA-Z]*O[a-zA-Z]*$/.test(arg))) {
    process.env.LOG_LEVEL ??= 'silent'
  }
}

export default hook
