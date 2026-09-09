import type { PlanType } from '../types';

// Prices in cents, shared by public and authenticated plan selectors.
export const PLAN_CATALOG: { id: PlanType; name: string; price: number; features: string[]; popular?: boolean }[] = [
  { id: 'free', name: 'Standard', price: 0, features: ['Até 5 propostas ativas', '14 dias após envio, sem prorrogação', 'Baixe antes da exclusão', 'Envio por WhatsApp', '4 tons de comunicação sem IA'] },
  { id: 'pro', name: 'Pro', price: 7900, popular: true, features: ['Tudo do Standard', 'Até 50 propostas ativas', 'Prorrogação por mais 14 dias', 'Download antes da exclusão', 'Analytics básico'] },
  { id: 'business', name: 'Business', price: 29900, features: ['Tudo do Pro', 'Até 999 propostas ativas', 'PDF sem marca d’água', 'Analytics avançado', 'Suporte prioritário'] },
];
