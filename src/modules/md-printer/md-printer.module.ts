import { Module } from '@nestjs/common'

import { MdPrinterHandler } from './md-printer.handler.js'
import type MDPrinter from '../../commands/index.js'
import { CommandContext, LoggerModule, LogLevels, LogoModule } from '@cenk1cenk2/oclif-common'
import { PrinterModule } from '@services'

@Module({
  imports: [
    // stdout carries the document with --stdout, so the logs and the logo go to stderr
    LoggerModule.forRoot({ stderr: Object.values(LogLevels) }),
    LogoModule.forRoot(),
    PrinterModule.forRootAsync({
      inject: [CommandContext],
      useFactory: ({ flags }: CommandContext<typeof MDPrinter>) => ({ browser: flags.browser })
    })
  ],
  providers: [MdPrinterHandler]
})
export class MdPrinterModule {}
