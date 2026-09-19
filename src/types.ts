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

export type PlanType = 'free' | 'pro' | 'business';

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'pending' | 'approved' | 'rejected' | 'expired';

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

  activePlan?: PlanType;
  planPeriod?: 'monthly' | 'annual';
  trialExpirationDate?: string;
  checklistDismissed?: boolean;
  isFounder?: boolean;
  founderPrice?: number;
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
  retentionExpiresAt?: string | null;
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

// ORKTO Swarm - Conversation & Inbox types (Onda 0/1)
export type BotName = 'hunter' | 'farmer' | 'recovery' | 'collection' | 'risk' | 'report' | 'growth' | 'price_auditor' | 'hermes';
export type TrustLevel = 'observing' | 'suggesting' | 'limited' | 'extended';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'edited' | 'scheduled';
export type MessageRole = 'contact' | 'operator' | 'bot' | 'system';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'system';
export type ConversationStatus = 'open' | 'paused' | 'closed';
export type SourceChannel = 'whatsapp' | 'manual' | 'instagram' | 'web';
export type MoodState = 'green' | 'yellow' | 'red' | 'blue' | 'neutral';

export interface Conversation {
  id: string;
  userId: string;
  contactName: string;
  contactPhone: string;
  contactAvatar?: string;
  status: ConversationStatus;
  sourceChannel: SourceChannel;
  quoteId?: string;
  quoteTotal?: number;
  priorityScore?: number;
  mood?: MoodState;
  lastMessageAt?: Timestamp;
  lastMessagePreview?: string;
  unreadCount?: number;
  messageCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Campos retornados pelo backend ORKTO Swarm (snake_case via API)
  phone?: string;
  name?: string | null;
  contact_name?: string;
  contact_phone?: string;
  source_channel?: string;
  last_message?: string;
  unread_count?: number;
  message_count?: number;
  messages_24h?: number;
  last_message_at?: string;
  last_message_by?: string;
  risk_score?: number | null;
  priority_score?: number | null;
  mood_state?: string;
  mood_confidence?: number;
  priority_reason?: string | null;
  recent_messages?: Array<{ content?: string }>;
  messages?: ConversationMessage[];
  approval_tasks?: ApprovalTask[];
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderRole: MessageRole;
  role?: MessageRole;
  content: string;
  messageType: MessageType;
  senderName?: string;
  senderAvatar?: string | null;
  botName?: BotName | null;
  botActionId?: string | null;
  approvalTaskId?: string | null;
  sentAt: Timestamp;
  timestamp?: Timestamp;
  direction: 'incoming' | 'outgoing' | 'internal';
  readAt?: Timestamp;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: Record<string, unknown>;
}

export interface ApprovalTask {
  id: string;
  conversationId: string;
  taskType: 'response_suggestion' | 'action_execution' | 'discount_approval' | 'strategy_change';
  botName: BotName;
  botAvatar?: string;
  proposedContent: string;
  proposedAction?: string;
  reason: string;
  justification?: string;
  policyApplied: string;
  signals?: string[];
  status: ApprovalStatus;
  trustLevel?: TrustLevel;
  title?: string;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  decidedAt?: Timestamp;
  decidedBy?: string;
  decisionReason?: string;
}

export interface ApprovalTaskFormData {
  taskId: string;
  action: 'approve' | 'reject' | 'edit';
  reason?: string;
  editedContent?: string;
}

// ==================== TYPES DE CONVERSA / INBOX (SWARM) ====================
