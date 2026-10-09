import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

/** Only human-editable fields. Workspace, actor, source and import IDs are server-owned. */
export const contactInput = z.object({
  fullName: z.string().trim().min(1).max(200),
  phone: optionalText(80),
  email: z.string().trim().email().max(254).nullable().optional(),
  company: optionalText(200),
  role: optionalText(120),
  customerId: z.string().uuid().nullable().optional(),
}).strict().refine(value => Boolean(value.phone?.trim() || value.email?.trim()), {
  message: 'Informe telefone ou email.',
});

export const contactPatchInput = contactInput.innerType().partial().strict().refine(
  value => Object.keys(value).length > 0,
  { message: 'Informe ao menos um campo.' },
);
