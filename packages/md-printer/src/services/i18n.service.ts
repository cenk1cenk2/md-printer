import { Injectable } from '@nestjs/common'
import { readdir } from 'fs/promises'
import i18next from 'i18next'
import type { Resource, TFunction } from 'i18next'
import { basename, extname, join } from 'path'

import { FileSystemService, ParserService } from '@cenk1cenk2/oclif-common'
import { DEFAULT_LANGUAGE, I18N_ACCEPTED_TYPES } from '@constants'
import type { I18nLoadOptions } from '@interfaces'

@Injectable()
export class I18nService {
  constructor(
    private readonly fs: FileSystemService,
    private readonly parser: ParserService
  ) {}

  public async load(directory: string, options: I18nLoadOptions): Promise<TFunction> {
    const instance = i18next.createInstance()

    await instance.init({
      lng: options.language,
      fallbackLng: options.fallback ?? options.language ?? DEFAULT_LANGUAGE,
      resources: this.fs.exists(directory) ? await this.resources(directory) : {},
      interpolation: { escapeValue: false }
    })

    return instance.getFixedT(options.language)
  }

  private async resources(directory: string): Promise<Resource> {
    const resources: Resource = {}

    await Promise.all(
      (await readdir(directory))
        .filter((file) => I18N_ACCEPTED_TYPES.includes(extname(file)))
        .map(async(file) => {
          resources[basename(file, extname(file))] = { translation: await this.parser.read(join(directory, file)) }
        })
    )

    return resources
  }
}
