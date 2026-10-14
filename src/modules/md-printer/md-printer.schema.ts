import { z } from 'zod'

import { InputFileType, OutputFileType, PreviewHost, SignatureProvider } from '@constants'

export const MdPrinterSchema = z
  .object({
    flags: z.object({
      stdin: z.boolean().default(false).describe('Read the input from stdin.'),
      ['input-filetype']: z.enum(InputFileType).optional().describe('Input file type. Detected from the file extension, markdown for stdin and unknown extensions.'),
      ['output-filetype']: z.enum(OutputFileType).optional().describe('Output file type, defaults to pdf. Overwrites the one defined in front-matter.'),
      stdout: z.boolean().default(false).describe('Write the output to stdout instead of a file.'),
      template: z.string().optional().describe('Built-in template name or path to a template directory, defaults to "default". Overwrites the one defined in front-matter.'),
      title: z.string().optional().describe('Document title. Overwrites the one defined in front-matter or the template.'),
      language: z.string().optional().describe('Language for template translations. Overwrites the one defined in front-matter and template settings.'),
      browser: z.string().optional().describe('Browser executable used for printing. Discovered automatically when omitted (Brave, Chrome, Chromium, Edge).'),
      continuous: z.boolean().default(false).describe('Render the PDF as a single continuous page without page breaks.'),
      preview: z
        .boolean()
        .default(false)
        .describe('Rebuild whenever the input, the template or its assets change, show the HTML and the PDF in a live preview and rewrite the output file when there is one.'),
      host: z
        .enum(PreviewHost)
        .default(PreviewHost.IPV4)
        .describe('Loopback host for the preview server, it serves the files next to the input and is never exposed to the network.'),
      port: z.number().int().min(0).max(65535).default(0).describe('Port for the preview server, random when 0.'),
      open: z.boolean().default(true).describe('Open the preview window, --no-open keeps rebuilding and writing without one.'),
      sign: z.boolean().default(false).describe('Sign the PDF with a qualified electronic signature through ID Austria (A-Trust).'),
      ['sign-provider']: z
        .enum(SignatureProvider)
        .optional()
        .describe('Signature provider, defaults to a-trust. Overwrites the one defined in front-matter and template settings.'),
      ['sign-certificate']: z.string().optional().describe('Signer certificate (DER or PEM) used for the visible signature block and to verify the returned signature.')
    }),
    args: z.object({
      file: z.string().optional().describe('Markdown or yaml file to render.'),
      output: z.string().optional().describe('Output file. Overwrites the one defined in front-matter.')
    })
  })
  .superRefine(({ flags, args }, ctx) => {
    if (!flags.stdin && !args.file) {
      ctx.addIssue({ code: 'custom', message: 'Either --stdin or file argument must be provided.' })
    }

    if (flags.stdin && args.output) {
      ctx.addIssue({ code: 'custom', message: 'Reading from --stdin takes only the output file argument.' })
    }

    if (flags.stdout && flags.preview) {
      ctx.addIssue({ code: 'custom', message: 'Writing to stdout is not supported with --preview.' })
    }
  })
  // with stdin there is no input file, so the only argument is the output
  .transform(({ flags, args }) => ({ flags, args: flags.stdin ? { file: undefined, output: args.file } : args }))
