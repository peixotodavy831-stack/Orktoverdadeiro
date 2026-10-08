import { z } from 'zod';

/** Owner-editable onboarding fields. Identity, workspace and system fields are excluded. */
export const onboardingInput = z.object({
  companyName: z.string().trim().min(1).max(160),
  taxId: z.string().trim().max(30).optional(),
  whatsappNumber: z.string().trim().min(3).max(40),
  whatsappTemplate: z.string().max(4000).optional(),
  companyLogo: z.string().max(2500).optional(),
  address: z.string().trim().max(300).optional(),
  paymentInfo: z.string().trim().max(1000).optional(),
  profession: z.string().trim().max(100).optional(),
  brandName: z.string().trim().max(160).optional(),
  brandTone: z.enum(['formal','técnico','comercial','criativo']).optional(),
  quoteColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();
