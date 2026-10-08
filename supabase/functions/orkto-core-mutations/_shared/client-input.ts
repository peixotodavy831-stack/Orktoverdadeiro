import { z } from 'zod';

/** The same command payload is validated by Express and the Edge executor. */
export const clientInput = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(3).max(80),
  company: z.string().trim().max(200).nullable().optional(),
  vehicleOrService: z.string().trim().max(240).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
}).strict();
