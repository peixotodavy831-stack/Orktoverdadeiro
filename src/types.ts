export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  static now(): Timestamp {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }

  static fromMillis(milliseconds: number): Timestamp {
    return new Timestamp(Math.floor(milliseconds / 1000), (milliseconds % 1000) * 1000000);
  }

  static fromDate(date: Date): Timestamp {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000));
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1000000);
  }
}

export type QuoteStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  onboardingCompleted?: boolean;
  
  // Business Settings
  companyName?: string;
  taxID?: string;
  companyLogo?: string;
  whatsappNumber?: string;
  whatsappTemplate?: string;
  paymentInfo?: string;
  quoteColor?: string; // Hex color for custom branding
  address?: string;
  
  // ORKTO Brand Customization
  profession?: string;
  brandName?: string;
  brandTone?: 'formal' | 'técnico' | 'comercial' | 'criativo';

  // SaaS Subscription & Monetization states
  activePlan?: 'starter' | 'pro' | 'business';
  planPeriod?: 'monthly' | 'annual';
  trialExpirationDate?: string;
  checklistDismissed?: boolean;
}

export interface QuoteItem {
  id: string; // Dynamic client-side ID for list render and keys
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number; // In percentage or fixed currency (we'll do percentage discount)
}

export interface Quote {
  id: string;
  userId: string;
  quoteNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientCompany?: string;
  clientVehicleOrService: string; // Context (e.g., Honda Civic 2018 or Revisão Elétrica)
  notes?: string;
  
  // Money
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  taxes?: number;
  total: number;
  
  // Terms
  validValueDays: number; // validity, e.g. 5, 10, 15 days
  paymentInstructions?: string; // Pix key or invoice info
  status: QuoteStatus;
  
  // Timeline
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sentAt?: Timestamp | null;
  viewedAt?: Timestamp | null;
  approvedAt?: Timestamp | null;
  rejectedAt?: Timestamp | null;
}

export interface SavedClient {
  id: string;
  userId: string;
  name: string;
  phone: string;
  company?: string;
  vehicleOrService?: string; // Default vehicle or recurring service context
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // Derived metrics for UI analytics
  quoteCount?: number;
  totalRevenue?: number;
  lastContactDate?: Timestamp;
}

export interface SavedService {
  id: string;
  userId: string;
  name: string;
  description?: string;
  unitPrice: number;
  category: string; // e.g., Mecânica, Elétrica, Lanternagem, Limpeza, Suspensão, etc.
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const AUTO_SERVICE_CATEGORIES = [
  'Desenvolvimento & Software',
  'Design & Branding',
  'Consultoria & Mentoria',
  'Marketing & Tráfego Pago',
  'Suporte & Configurações',
  'Produção & Conteúdo',
  'Infraestrutura & Cloud',
  'Integrações & APIs',
  'Outros Serviços'
];
