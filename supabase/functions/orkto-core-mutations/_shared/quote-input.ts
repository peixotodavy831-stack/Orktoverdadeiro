import { z } from 'zod';

const money = z.number().finite().nonnegative().max(100_000_000);
export const quoteCreateInput = z.object({
  clientName: z.string().trim().min(1).max(160),
  clientPhone: z.string().trim().min(1).max(40),
  clientEmail: z.string().trim().max(254).optional(),
  clientCompany: z.string().trim().max(160).optional(),
  clientVehicleOrService: z.string().trim().max(500).optional(),
  customerId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  notes: z.string().max(4000).optional(),
  items: z.array(z.object({
    id: z.string().max(100).optional(),
    catalogItemId: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(2000).default(''),
    quantity: z.number().finite().positive().max(10_000),
    unitPrice: money,
    discount: z.number().finite().min(0).max(100).default(0),
  }).strict()).min(1).max(100),
  taxes: money.default(0),
  validValueDays: z.number().int().min(1).max(365).default(15),
  paymentInstructions: z.string().max(4000).optional(),
}).strict();

export const quotePatchInput = quoteCreateInput.partial().extend({
  clientEmail: z.string().trim().max(254).nullable().optional(),
  clientCompany: z.string().trim().max(160).nullable().optional(),
  clientVehicleOrService: z.string().trim().max(500).nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  dealId: z.string().uuid().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  paymentInstructions: z.string().max(4000).nullable().optional(),
}).strict();

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function calculateQuoteMoney(items: Array<{quantity:number;unitPrice:number;discount:number}>, taxes:number) {
  let subtotal = 0;
  let discountTotal = 0;
  for (const item of items) {
    const line = roundMoney(item.quantity * item.unitPrice);
    subtotal += line;
    discountTotal += roundMoney(line * item.discount / 100);
  }
  const result = { subtotal:roundMoney(subtotal),discount_total:roundMoney(discountTotal),taxes:roundMoney(taxes),total:roundMoney(subtotal-discountTotal+taxes) };
  if (Object.values(result).some(value=>!Number.isFinite(value) || value < 0 || value > 1_000_000_000)) throw new Error('QUOTE_MONEY_OUT_OF_RANGE');
  return result;
}

export function quoteCustomerMatchesDeal(dealCustomerRef: string | null, customerId: string | null, clientPhone: string): boolean {
  return !dealCustomerRef || dealCustomerRef === customerId || dealCustomerRef === clientPhone;
}
