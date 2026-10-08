import { z } from 'zod';

/** Shared operator-editable catalog fields for Express and the Edge executor. */
export const serviceInput = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  unitPrice: z.number().finite().min(0).max(100_000_000).default(0),
  category: z.string().trim().min(1).max(120).default('Outros Serviços'),
}).strict();
