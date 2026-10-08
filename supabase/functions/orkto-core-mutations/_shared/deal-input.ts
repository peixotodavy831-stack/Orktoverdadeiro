import { z } from 'zod';

export const dealInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).default(''),
  customerRef: z.string().trim().max(200).optional(),
  conversationRef: z.string().uuid().optional(),
  stage: z.enum(['new','qualification','proposal','negotiation','won','lost']).default('new'),
  valueCents: z.number().int().nonnegative().max(10_000_000_000).default(0),
  probabilityPercent: z.number().min(0).max(100).optional(),
  ownerUserId: z.string().uuid().optional(),
  expectedCloseOn: z.string().date().optional(),
  source: z.string().trim().max(80).default('manual'),
});

export const dealPatchInput = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  description: z.string().trim().max(4000).optional(),
  stage: z.enum(['new','qualification','proposal','negotiation','won','lost']).optional(),
  valueCents: z.number().int().nonnegative().max(10_000_000_000).optional(),
  probabilityPercent: z.number().min(0).max(100).nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  expectedCloseOn: z.string().date().nullable().optional(),
  lostReason: z.string().trim().max(500).optional(),
});
