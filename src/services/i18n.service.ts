import { Injectable } from '@nestjs/common'
import i18next from 'i18next'
import type { Resource, TFunction } from 'i18next'
import { basename, extname, join } from 'path'

import { ConfigService, FileSystemService } from '@cenk1cenk2/oclif-common'
import { DEFAULT_LANGUAGE, I18N_ACCEPTED_TYPES } from '@constants'
import type { MdPrinterI18nOptions } from '@interfaces'

@Injectable()
export class I18nService {
  constructor(
    private readonly fs: FileSystemService,
    private readonly cs: ConfigService
  ) {}

  public async load(directory: string, options: MdPrinterI18nOptions & { language: string }): Promise<TFunction | undefined> {
    if (!this.fs.exists(directory)) {
      return undefined
    }

    const instance = i18next.createInstance()

    await instance.init({
      lng: options.language,
      fallbackLng: options.fallback ?? options.language ?? DEFAULT_LANGUAGE,
      resources: await this.resources(directory),
      interpolation: { escapeValue: false }
    })

    return instance.getFixedT(options.language)
  }

  private async resources(directory: string): Promise<Resource> {
    const files = (await this.fs.extra.readdir(directory)).filter((file) => I18N_ACCEPTED_TYPES.includes(extname(file)))

    const resources: Resource = {}

    await Promise.all(
      files.map(async(file) => {
        resources[basename(file, extname(file))] = { translation: await this.cs.read(join(directory, file)) }
      })
    )

    return resources
  }
}
