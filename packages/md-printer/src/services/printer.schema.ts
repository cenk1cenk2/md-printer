import { z } from 'zod'

export const DestSchema = z.strictObject(
  {
    directory: z.string().min(1).optional(),
    filename: z.string().min(1).optional()
  },
  { error: (issue) => (issue.code === 'invalid_type' ? 'Use a string or an object with a directory and a filename.' : undefined) }
)
