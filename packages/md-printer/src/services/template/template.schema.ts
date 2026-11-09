import { z } from 'zod'

import { TemplateSourceType } from '@constants'

const PACKAGE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

export const TemplateSourceSchema = z.discriminatedUnion(
  'type',
  [
    z.strictObject({
      type: z.literal(TemplateSourceType.BUILTIN),
      name: z.string().regex(/^[^\\/]+$/, 'Built-in template names have no path separator.')
    }),
    z.strictObject({
      type: z.literal(TemplateSourceType.PACKAGE),
      name: z.string().regex(PACKAGE_NAME, 'Not an npm package name.'),
      directory: z.string().optional()
    }),
    z.strictObject({
      type: z.literal(TemplateSourceType.DIRECTORY),
      path: z.string().min(1)
    })
  ],
  { error: () => `Use a string or an object with a type of ${Object.values(TemplateSourceType).join(', ')}.` }
)

export const TemplateSettingsSchema = z.looseObject({
  files: z
    .strictObject({
      template: z.string().min(1).optional(),
      components: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
      extension: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional(),
      i18n: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]).optional()
    })
    .optional()
})

export function issues({ issues }: z.ZodError): string {
  return issues.map(({ path, message }) => [...path, message].join(': ')).join(', ')
}

export type TemplateSource = z.infer<typeof TemplateSourceSchema>
export type TemplatePackageSource = Extract<TemplateSource, { type: TemplateSourceType.PACKAGE }>
