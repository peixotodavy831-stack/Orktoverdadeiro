import * as Sentry from "@sentry/node";
import { Resend } from "resend";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { z } from "zod";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

dotenv.config();

Sentry.init({
  dsn: "https://a6c3c309574f8be78c252ea79aec2294@o4511734416605184.ingest.us.sentry.io/4511734426042368",
  tracesSampleRate: 1.0,
  environment: process.env.VERCEL_ENV || "development",
  integrations: [Sentry.expressIntegration()],
});

const resend = new Resend(process.env.RESEND_API_KEY || "");

const app = express();

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "orkto" });
});
const PORT = 3000;

// Vercel encaminha o IP original pelos headers de proxy. Confiar apenas no
// primeiro proxy mantém o rate limiter correto sem aceitar uma cadeia arbitrária.
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));

const allowedOrigins = [
  'http://localhost:3000', 'http://localhost:4173', 'http://localhost:5173',
  'https://orktoverdeiro.vercel.app', 'https://orkto.co', 'https://www.orkto.co',
  'https://orkto.vercel.app', 'https://project-ao409.vercel.app',
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean),
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Não permitido por CORS'));
  }, credentials: true,
}));

app.use('/api', helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: 'draft-7', legacyHeaders: false,
  // Na Vercel usamos req.ip, já normalizado a partir de X-Forwarded-For.
  validate: { forwardedHeader: false },
});
app.use('/api/', globalLimiter);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Tipos auxiliares para corrigir lint estrito
declare global {
  namespace Express {
    interface Request { user?: { id: string; email?: string } }
  }
}

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;
const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }
  const token = authHeader.split(' ')[1];
  if (!supabaseClient) {
    return res.status(500).json({ error: 'Serviço de autenticação indisponível.' });
  }
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
  req.user = user;
  next();
}

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  photo_url: z.string().max(2_500_000).nullable().optional(),
  onboarding_completed: z.boolean().optional(),
  company_name: z.string().trim().min(1).max(160),
  tax_id: z.string().max(30).optional(),
  company_logo: z.string().max(2_500_000).optional(),
  whatsapp_number: z.string().max(40).optional(),
  whatsapp_template: z.string().max(4000).optional(),
  payment_info: z.string().max(1000).optional(),
  quote_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  address: z.string().max(300).optional(),
  profession: z.string().max(100).optional(),
  brand_name: z.string().max(160).optional(),
  brand_tone: z.enum(['formal', 'técnico', 'comercial', 'criativo']).optional(),
});

app.put('/api/profile', authenticate, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Banco de dados indisponível.' });
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados da empresa inválidos.' });
  }
  try {
    const payload = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined));
    const { data, error } = await supabase.from('profiles').upsert({
      id: req.user!.id,
      ...payload,
    }, { onConflict: 'id' }).select('id').single();
    if (error) throw error;
    return res.json({ success: true, id: data.id });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    return res.status(500).json({ error: 'Não foi possível salvar os dados da empresa.' });
  }
});

// ===== Protected quote routes =====
const ALLOWED_UPDATE_FIELDS = new Set([
  'client_name', 'client_phone', 'client_email', 'client_company',
  'client_vehicle_or_service', 'notes', 'items', 'subtotal',
  'discount_total', 'taxes', 'total', 'valid_value_days',
  'payment_instructions', 'status',
]);

const FIELD_MAP_CAMEL_TO_SNAKE = {
  quoteNumber: 'quote_number', clientName: 'client_name', clientPhone: 'client_phone',
  clientEmail: 'client_email', clientCompany: 'client_company', clientVehicleOrService: 'client_vehicle_or_service',
  notes: 'notes', items: 'items', subtotal: 'subtotal', discountTotal: 'discount_total',
  taxes: 'taxes', total: 'total', validValueDays: 'valid_value_days', paymentInstructions: 'payment_instructions',
  status: 'status',
};

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function calculateQuoteMoney(rawItems, rawTaxes = 0) {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
    throw new Error('Inclua entre 1 e 100 itens válidos no orçamento.');
  }

  let subtotal = 0;
  let discountTotal = 0;
  const items = rawItems.map((rawItem, index) => {
    const name = String(rawItem?.name || '').trim();
    const description = String(rawItem?.description || '').trim();
    const quantity = Number(rawItem?.quantity);
    const unitPrice = Number(rawItem?.unitPrice);
    const discount = Number(rawItem?.discount || 0);

    if (!name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(discount) || discount < 0 || discount > 100) {
      throw new Error(`Revise os dados do item ${index + 1}.`);
    }

    const itemSubtotal = roundMoney(quantity * unitPrice);
    const itemDiscount = roundMoney(itemSubtotal * discount / 100);
    subtotal += itemSubtotal;
    discountTotal += itemDiscount;

    return {
      id: String(rawItem?.id || crypto.randomUUID()),
      name: name.slice(0, 160),
      description: description.slice(0, 2000),
      quantity,
      unitPrice: roundMoney(unitPrice),
      discount: roundMoney(discount),
    };
  });

  const taxes = Number(rawTaxes || 0);
  if (!Number.isFinite(taxes) || taxes < 0) throw new Error('Taxas devem ser um valor positivo.');

  return {
    items,
    subtotal: roundMoney(subtotal),
    discount_total: roundMoney(discountTotal),
    taxes: roundMoney(taxes),
    total: roundMoney(subtotal - discountTotal + taxes),
  };
}

function makeQuoteNumber() {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${date}-${suffix}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
}

if (supabase && supabaseClient) {
  app.get("/api/quotes/list", authenticate, async (req, res) => {
    try {
      const offset = Math.max(0, Number.parseInt(String(req.query.offset || '0'), 10) || 0);
      const limit = Math.min(500, Math.max(1, Number.parseInt(String(req.query.limit || '250'), 10) || 250));
      const { data, error } = await supabase.from('quotes').select().eq('user_id', req.user.id).or(`retention_expires_at.is.null,retention_expires_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.post("/api/quotes", authenticate, async (req, res) => {
    try {
      const body = req.body;
      const userId = req.user.id;

      // Verificar limite do plano (Starter: 5 propostas ativas)
      const { data: profile } = await supabase.from('profiles').select('active_plan').eq('id', userId).maybeSingle();
      const plan = profile?.active_plan || 'free';
      const planLimits = { free: 5, starter: 5, pro: 50, business: 999 };
      const maxQuotes = planLimits[plan] || 5;

      const { count } = await supabase.from('quotes').select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('status', 'in', '(rejected,expired)');

      if (count && count >= maxQuotes) {
        return res.status(403).json({ error: `Limite de ${maxQuotes} propostas ativas atingido no plano ${plan}. Faça upgrade para criar mais.`, limitReached: true });
      }

      const clientName = String(body.clientName || body.client_name || '').trim();
      const clientPhone = String(body.clientPhone || body.client_phone || '').trim();
      if (!clientName || !clientPhone) return res.status(400).json({ error: 'Nome e telefone do cliente são obrigatórios.' });

      const money = calculateQuoteMoney(body.items, body.taxes);
      const insertData: Record<string, any> = {
        user_id: userId,
        quote_number: makeQuoteNumber(),
        client_name: clientName.slice(0, 160),
        client_phone: clientPhone.slice(0, 40),
        ...money,
      };
      for (const [camel, snake] of Object.entries(FIELD_MAP_CAMEL_TO_SNAKE)) {
        if (['quoteNumber', 'items', 'subtotal', 'discountTotal', 'taxes', 'total'].includes(camel)) continue;
        if (body[camel] !== undefined) insertData[snake] = body[camel];
      }
      insertData.created_at = new Date().toISOString();
      insertData.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('quotes').insert([insertData]).select().single();
      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      const message = error instanceof Error ? error.message : '';
      res.status(message.includes('item') || message.includes('Taxas') ? 400 : 500).json({ error: message || 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.get("/api/quotes/detail/:quoteId", authenticate, async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { data, error } = await supabase.from('quotes').select().eq('id', quoteId).eq('user_id', req.user.id).maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Orçamento não encontrado' });
      if (data.retention_expires_at && new Date(data.retention_expires_at).getTime() <= Date.now()) return res.status(410).json({ error: 'Orçamento expirado e indisponível.' });
      res.json(data);
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.put("/api/quotes/:quoteId", authenticate, async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { data: existing } = await supabase.from('quotes').select('user_id, items, taxes').eq('id', quoteId).eq('user_id', req.user.id).maybeSingle();
      if (!existing) return res.status(404).json({ error: 'Orçamento não encontrado' });
      const updates: Record<string, any> = {};
      const body = req.body;
      for (const [camel, snake] of Object.entries(FIELD_MAP_CAMEL_TO_SNAKE)) {
        if (body[camel] !== undefined) updates[snake] = body[camel];
      }
      for (const key of ALLOWED_UPDATE_FIELDS) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      delete updates.user_id; delete updates.id; delete updates.created_at;
      delete updates.quote_number; delete updates.sequence_number;
      if (body.items !== undefined || body.taxes !== undefined) {
        Object.assign(updates, calculateQuoteMoney(body.items ?? existing.items, body.taxes ?? existing.taxes));
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabase.from('quotes').update(updates).eq('id', quoteId).eq('user_id', req.user.id).select();
      if (error) throw error;
      res.json(data?.[0]);
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.delete("/api/quotes/:quoteId", authenticate, async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { data: existing } = await supabase.from('quotes').select('user_id').eq('id', quoteId).eq('user_id', req.user.id).maybeSingle();
      if (!existing) return res.status(404).json({ error: 'Orçamento não encontrado' });
      const { error } = await supabase.from('quotes').delete().eq('id', quoteId).eq('user_id', req.user.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });
}

app.get("/api/quote/next-number", authenticate, async (req, res) => {
  res.json({ quoteNumber: makeQuoteNumber() });
});

app.get("/api/quote/public/:id", (_req, res) => {
  res.status(410).json({ error: 'Link antigo desativado. Solicite um novo link seguro da proposta.' });
});

async function getActiveProposal(slug) {
  if (!supabase) return null;
  if (!/^[A-Za-z0-9]{8}$/.test(String(slug || ''))) return null;
  const { data } = await supabase.from('proposals')
    .select('id, quote_id, user_id, is_active, expires_at')
    .eq('slug', slug).maybeSingle();
  if (!data || !data.is_active || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

async function validateQuoteStatusTransition(id, newStatus, allowedFrom) {
  if (!supabase) return "Supabase not configured";
  const { data } = await supabase.from('quotes').select('status').eq('id', id).single();
  if (!data) return "Orçamento não encontrado";
  if (!allowedFrom.includes(data.status)) return `Orçamento já está como "${data.status}". Não é possível alterar para "${newStatus}".`;
  return null;
}

app.post("/api/proposal/:slug/approve", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const proposal = await getActiveProposal(req.params.slug);
    if (!proposal) return res.status(410).json({ error: 'Proposta inválida ou expirada.' });
    const id = proposal.quote_id;
    const { clientName } = req.body || {};
    const validationError = await validateQuoteStatusTransition(id, 'approved', ['sent', 'viewed', 'pending', 'draft']);
    if (validationError) return res.status(400).json({ error: validationError });

    // Buscar dados do quote + perfil para envio de email
    const { data: quote } = await supabase.from('quotes')
      .select('id, quote_number, client_name, client_email, total, profiles!inner(company_name, email)')
      .eq('id', id).single();

    const approvedAt = new Date().toISOString();
    const { data: transitioned, error } = await supabase.from('quotes').update({ status: 'approved', approved_at: approvedAt, updated_at: approvedAt }).eq('id', id).in('status', ['sent', 'viewed', 'pending', 'draft']).select('id');
    if (error) throw error;
    if (!transitioned?.length) return res.status(409).json({ error: 'A proposta já foi atualizada.' });
    await supabase.from('proposals').update({ approved_at: approvedAt }).eq('id', proposal.id);

    // Email de confirmação ao CLIENTE
    const quoteProfile = Array.isArray(quote?.profiles) ? quote.profiles[0] : quote?.profiles;
    if (process.env.RESEND_API_KEY && quote?.client_email) {
      const companyName = quoteProfile?.company_name || 'o profissional';
      resend.emails.send({
        from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
        to: [quote.client_email],
        subject: `Proposta #${quote.quote_number} aprovada com sucesso!`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:16px">
          <h2 style="color:#25D366;margin:0 0 12px">Proposta Aprovada!</h2>
          <p style="color:#aaa;font-size:14px;margin:0 0 8px">Sua proposta <strong style="color:#fff">#${quote.quote_number}</strong> foi aprovada com sucesso.</p>
          <p style="color:#aaa;font-size:14px;margin:0 0 16px">Profissional: <strong style="color:#fff">${companyName}</strong></p>
          <div style="background:#1a1a1a;border-radius:12px;padding:16px;margin:0 0 16px">
            <p style="color:#888;font-size:12px;margin:0 0 4px">Valor total</p>
            <p style="color:#FF9F1C;font-size:24px;font-weight:bold;margin:0">R$ ${Number(quote.total).toFixed(2).replace('.', ',')}</p>
          </div>
          <p style="color:#666;font-size:12px;margin:0">O profissional entrará em contato para prosseguir com o pagamento.</p>
          <p style="color:#555;font-size:11px;margin-top:20px">ORKTO — Sistema operacional de vendas</p>
        </div>`,
      }).catch(e => console.error('[ERRO] Resend cliente:', e));
    }

    // Notificar o DONO da proposta
    if (process.env.RESEND_API_KEY && quoteProfile?.email) {
      resend.emails.send({
        from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
        to: [quoteProfile.email],
        subject: `Orçamento aprovado por ${escapeHtml(clientName || quote?.client_name || 'cliente')}!`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:16px">
          <h2 style="color:#FF9F1C;margin:0 0 8px">Orçamento Aprovado!</h2>
          <p style="color:#aaa;font-size:14px;margin:0 0 16px"><strong style="color:#fff">${escapeHtml(clientName || quote?.client_name || 'Cliente')}</strong> acabou de aprovar o orçamento <strong style="color:#fff">#${escapeHtml(quote?.quote_number)}</strong>.</p>
          <p style="color:#555;font-size:11px;margin-top:20px">ORKTO — Sistema operacional de vendas</p>
        </div>`,
      }).catch(e => console.error('[ERRO] Resend dono:', e));
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.post("/api/proposal/:slug/reject", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const proposal = await getActiveProposal(req.params.slug);
    if (!proposal) return res.status(410).json({ error: 'Proposta inválida ou expirada.' });
    const id = proposal.quote_id;
    const validationError = await validateQuoteStatusTransition(id, 'rejected', ['sent', 'viewed', 'pending', 'draft']);
    if (validationError) return res.status(400).json({ error: validationError });
    const { data: transitioned, error } = await supabase.from('quotes').update({ status: 'rejected', rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).in('status', ['sent', 'viewed', 'pending', 'draft']).select('id');
    if (error) throw error;
    if (!transitioned?.length) return res.status(409).json({ error: 'A proposta já foi atualizada.' });
    await supabase.from('proposals').update({ is_active: false }).eq('id', proposal.id);
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.post("/api/auth/demo-login", async (req, res) => {
  if (process.env.VERCEL_ENV === 'production' || process.env.ASAAS_ENVIRONMENT === 'production') {
    return res.status(403).json({ error: 'Modo demo indisponível em produção. Crie uma conta.' });
  }
  if (!supabaseClient || !supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: 'demo@orkto.co', password: 'demo123456' });
    if (!error && data.session) {
      return res.json({ session: data.session });
    }
    // Create demo user with admin API (auto-confirms email, bypasses confirmation)
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: 'demo@orkto.co',
      password: 'demo123456',
      email_confirm: true,
      user_metadata: { full_name: 'Dono do Negócio' },
    });
    console.log('[DEMO] createUser result:', JSON.stringify({ createData: !!createData, createError: createError?.message }));
    if (createError && !createError.message?.includes('already been registered')) {
      throw createError;
    }
    // Now sign in
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({
      email: 'demo@orkto.co', password: 'demo123456',
    });
    if (sessionError) throw sessionError;
    res.json({ session: sessionData.session });
  } catch (error: any) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error?.message || error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

const waitlistSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().optional(), phone: z.string().optional(),
  source: z.string().default("landing_page"), referralCode: z.string().optional(),
});

app.post("/api/waitlist", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado" });
  const parsed = waitlistSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  try {
    const { email, name, phone, source, referralCode } = parsed.data;
    const { data: existing } = await supabase.from("waitlist").select("id, status").eq("email", email).single();
    if (existing) return res.json({ success: true, message: "Email já registrado na lista", alreadyRegistered: true });
    let referredBy = null;
    if (referralCode) {
      const { data: referrer } = await supabase.from("waitlist").select("id").eq("referral_code", referralCode).single();
      referredBy = referrer?.id || null;
    }
    const { data, error } = await supabase.from("waitlist").insert([{ email, name: name || null, phone: phone || null, source, referred_by: referredBy }]).select("id, referral_code").single();
    if (error) throw error;
    res.json({ success: true, referralCode: data.referral_code });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.get("/api/waitlist/count", async (_req, res) => {
  if (!supabase) return res.json({ count: 0 });
  try {
    const { count } = await supabase.from("waitlist").select("*", { count: "exact", head: true });
    res.json({ count: count || 0 });
  } catch { res.json({ count: 0 }); }
});

// ===== Asaas =====
const ASAAS_API_URL = process.env.ASAAS_ENVIRONMENT === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';

class AsaasApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = 'asaas_error') {
    super(message);
    this.name = 'AsaasApiError';
    this.status = status;
    this.code = code;
  }
}

function getAsaasApiKey() {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) throw new AsaasApiError('Asaas API key not configured', 503, 'missing_api_key');

  const environment = process.env.ASAAS_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const looksLikeProduction = key.includes('_prod_');
  const looksLikeSandbox = /_(hmlg|sandbox|homolog)/i.test(key);
  if ((environment === 'production' && looksLikeSandbox) || (environment === 'sandbox' && looksLikeProduction)) {
    throw new AsaasApiError('Asaas key does not match configured environment', 503, 'invalid_environment');
  }
  return key;
}

function sendAsaasError(res, error: unknown) {
  if (error instanceof AsaasApiError) {
    const configurationError = error.status === 401 || error.code === 'invalid_environment' || error.code === 'invalid_access_token' || error.code === 'missing_api_key';
    return res.status(configurationError ? 503 : error.status >= 400 && error.status < 500 ? 400 : 502).json({
      error: configurationError
        ? 'Pagamento temporariamente indisponível. A credencial segura do Asaas precisa ser atualizada.'
        : error.message,
      code: configurationError ? 'PAYMENT_PROVIDER_CONFIGURATION' : 'PAYMENT_PROVIDER_ERROR',
    });
  }
  return res.status(502).json({ error: 'Não foi possível conectar ao pagamento. Tente novamente.', code: 'PAYMENT_PROVIDER_UNAVAILABLE' });
}

function isMatchingWebhookToken(received: unknown, expected: string) {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

async function requestAsaas(method, path, body = null, apiKey) {
  const key = apiKey || getAsaasApiKey();
  let response;
  try {
    response = await fetch(`${ASAAS_API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'access_token': key, 'User-Agent': 'orkto/1.0' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AsaasApiError('Falha de conexão com o Asaas.', 502, 'network_error');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { throw new AsaasApiError('Resposta inválida do Asaas.', response.status || 502, 'invalid_response'); }
  }

  if (!response.ok) {
    const providerError = data?.errors?.[0];
    const code = String(providerError?.code || `http_${response.status}`);
    const description = String(providerError?.description || 'O Asaas recusou a solicitação.');
    console.error(`[ASAAS] ${method} ${path} status=${response.status} code=${code}`);
    throw new AsaasApiError(description, response.status, code);
  }
  return data;
}

function billingReference(userId: string, plan: string) {
  return `orkto-plan:${userId}:${plan}`;
}

function parseBillingReference(value: unknown) {
  if (typeof value !== 'string') return { userId: '', plan: '' };
  const match = /^orkto-plan:([^:]+):(pro|business)$/.exec(value);
  if (match) return { userId: match[1], plan: match[2] };
  return { userId: value, plan: '' };
}

function publicAppUrl(req) {
  const candidate = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
    return url.origin;
  } catch {
    return 'https://orkto.vercel.app';
  }
}

app.post("/api/asaas/checkout", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan } = req.body;
    if (!['pro', 'business'].includes(plan)) return res.status(400).json({ error: "Plano inválido" });
    const apiKey = getAsaasApiKey();
    const prices = { pro: 79, business: 299 };
    const names = { pro: 'ORKTO Pro', business: 'ORKTO Business' };
    const appUrl = publicAppUrl(req);
    const nextDueDate = `${new Date().toISOString().split('T')[0]} 12:00:00`;
    const checkout = await requestAsaas('POST', '/checkouts', {
      billingTypes: ['CREDIT_CARD'],
      chargeTypes: ['RECURRENT'],
      minutesToExpire: 60,
      externalReference: billingReference(userId, plan),
      callback: {
        successUrl: `${appUrl}/?checkout=success`,
        cancelUrl: `${appUrl}/?checkout=cancel`,
        expiredUrl: `${appUrl}/?checkout=expired`,
      },
      items: [{ name: names[plan], description: 'Assinatura mensal ORKTO', quantity: 1, value: prices[plan] }],
      subscription: { cycle: 'MONTHLY', nextDueDate },
    }, apiKey);
    if (!checkout?.id) throw new AsaasApiError('O Asaas não retornou o checkout.', 502, 'missing_checkout_id');
    const checkoutUrl = checkout.link || `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`;
    res.json({
      success: true,
      checkoutId: checkout.id,
      url: checkoutUrl,
      status: checkout.status || 'ACTIVE',
    });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    sendAsaasError(res, error);
  }
});

app.post("/api/asaas/webhook", async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'Banco indisponível.' });
    const asaasSecret = process.env.ASAAS_WEBHOOK_SECRET;
    if (!asaasSecret) {
      return res.status(503).json({ error: 'Webhook não configurado com segredo de validação.' });
    }
    if (!isMatchingWebhookToken(req.headers['asaas-access-token'], asaasSecret)) {
      return res.status(401).json({ error: 'Token de webhook inválido.' });
    }
    const { event, payment, checkout, subscription } = req.body;
    if (!event || (!payment && !checkout && !subscription)) return res.status(400).json({ error: "Invalid webhook" });
    const eventId = String(req.body?.id || '');
    if (!eventId) return res.status(400).json({ error: 'Webhook sem identificador de evento.' });
    const { data: processed, error: processedError } = await supabase.from('asaas_webhook_events').select('event_id').eq('event_id', eventId).maybeSingle();
    if (processedError) throw processedError;
    if (processed) return res.json({ received: true, duplicate: true });

    const confirmedAt = new Date().toISOString();
    if (event === 'CHECKOUT_PAID' && checkout) {
      const { userId, plan } = parseBillingReference(checkout.externalReference);
      if (userId && ['pro', 'business'].includes(plan)) {
        const { data: profile, error: profileError } = await supabase.from('profiles').update({ active_plan: plan }).eq('id', userId).select('id').maybeSingle();
        if (profileError) throw profileError;
        if (!profile) throw new Error('Perfil da assinatura não encontrado.');
        const amount = Array.isArray(checkout.items)
          ? checkout.items.reduce((sum, item) => sum + Number(item?.value || 0) * Number(item?.quantity || 1), 0)
          : Number(checkout.value || 0);
        const { error: recordError } = await supabase.from('payment_records').upsert({
          payment_id: `checkout:${checkout.id}`, user_id: userId, quote_id: null,
          amount, status: 'confirmed', confirmed_at: confirmedAt,
        }, { onConflict: 'payment_id' });
        if (recordError) throw recordError;
      }
    }
    if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && payment) {
      const ref = payment.externalReference;
      if (ref && !payment.subscription) {
        const { data: quote, error: quoteLookupError } = await supabase.from('quotes').select('id,user_id,total').eq('id', ref).maybeSingle();
        if (quoteLookupError) throw quoteLookupError;
        if (!quote) throw new Error('Orçamento do pagamento não encontrado.');
        const { error: quoteError } = await supabase.from('quotes').update({ status: 'approved', approved_at: confirmedAt, updated_at: confirmedAt }).eq('id', quote.id);
        if (quoteError) throw quoteError;
        const { error: recordError } = await supabase.from('payment_records').upsert({
          payment_id: payment.id, user_id: quote.user_id, quote_id: quote.id,
          amount: Number(payment.value || quote.total), status: 'confirmed', confirmed_at: confirmedAt,
        }, { onConflict: 'payment_id' });
        if (recordError) throw recordError;
      }
      const parsedReference = parseBillingReference(ref);
      const userId = parsedReference.userId;
      if (userId && payment.subscription) {
        let plan = parsedReference.plan || 'pro';
        try {
          const sub = await requestAsaas('GET', `/subscriptions/${payment.subscription}`, null, process.env.ASAAS_API_KEY);
          if (sub && Number(sub.value) >= 299) plan = 'business';
        } catch {}
        const { error: profileError } = await supabase.from('profiles').update({ active_plan: plan }).eq('id', userId);
        if (profileError) throw profileError;
        const { error: recordError } = await supabase.from('payment_records').upsert({
          payment_id: payment.id, user_id: userId, quote_id: null,
          amount: Number(payment.value || 0), status: 'confirmed', confirmed_at: confirmedAt,
        }, { onConflict: 'payment_id' });
        if (recordError) throw recordError;
      }
    }
    if ((event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_DELETED') && payment?.id) {
      const status = event === 'PAYMENT_OVERDUE' ? 'overdue' : 'deleted';
      const { error: recordError } = await supabase.from('payment_records').update({ status }).eq('payment_id', payment.id);
      if (recordError) throw recordError;
    }
    if (event === 'SUBSCRIPTION_CANCELED' && subscription) {
      const { userId } = parseBillingReference(subscription.externalReference);
      if (userId) {
        const { error: profileError } = await supabase.from('profiles').update({ active_plan: 'free' }).eq('id', userId);
        if (profileError) throw profileError;
      }
    }

    // The event is acknowledged only after every side effect succeeds. If anything
    // fails Asaas can retry without leaving a partially processed event behind.
    const { error: eventError } = await supabase.from('asaas_webhook_events').insert({ event_id: eventId, event_type: String(event) });
    if (eventError?.code === '23505') return res.json({ received: true, duplicate: true });
    if (eventError) throw eventError;
    res.json({ received: true });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

// ===== PIX para orçamentos =====
app.post("/api/proposal/:slug/pix", async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const proposal = await getActiveProposal(req.params.slug);
    if (!proposal) return res.status(410).json({ error: 'Proposta inválida ou expirada.' });
    const id = proposal.quote_id;
    const { data: quote, error } = await supabase.from('quotes').select('id, total, status, user_id').eq('id', id).single();
    if (error || !quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (quote.status !== 'approved' && quote.status !== 'pending') return res.status(400).json({ error: "Orçamento precisa estar aprovado para gerar PIX" });
    const apiKey = process.env.ASAAS_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'PIX indisponível: Asaas não configurado.' });
    let customerId = process.env.ASAAS_GLOBAL_CUSTOMER_ID;
    if (!customerId) {
      try {
        const existingCustomers = await requestAsaas('GET', `/customers?name=Orkto+Platform&limit=1`, null, apiKey);
        customerId = existingCustomers?.data?.[0]?.id;
      } catch {}
      if (!customerId) {
        const newCustomer = await requestAsaas('POST', '/customers', { name: 'Orkto Platform', email: 'pix@orkto.co', cpfCnpj: '000.000.000-00', notificationDisabled: true }, apiKey);
        customerId = newCustomer?.id;
      }
    }
    const payment = await requestAsaas('POST', '/payments', {
      customer: customerId, billingType: 'PIX', value: Number(quote.total),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      description: `Orçamento #${quote.id.substring(0, 8)}`, externalReference: quote.id,
    }, apiKey);
    if (!payment || !payment.id) return res.status(500).json({ error: "Falha ao gerar cobrança PIX" });
    const { error: recordError } = await supabase.from('payment_records').upsert({ payment_id: payment.id, user_id: quote.user_id, quote_id: quote.id, amount: Number(quote.total), status: payment.status || 'pending' }, { onConflict: 'payment_id' });
    if (recordError) throw recordError;
    let pixData = null;
    try {
      pixData = await requestAsaas('GET', `/payments/${payment.id}/pixQrCode`, null, apiKey);
    } catch (e) {
      const paymentDetails = await requestAsaas('GET', `/payments/${payment.id}`, null, apiKey);
      pixData = paymentDetails?.pixQrCode ? { encodedImage: paymentDetails.pixQrCode.encodedImage, payload: paymentDetails.pixQrCode.payload } : null;
    }
    res.json({
      success: true, paymentId: payment.id,
      pix: pixData ? { qrCode: pixData.encodedImage || null, key: pixData.payload || null } : null,
      value: Number(quote.total), status: payment.status,
    });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

// ===== Propostas (links compartilháveis) =====
const SLUG_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generateSlug(): string {
  let slug = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) slug += SLUG_CHARS[bytes[i] % SLUG_CHARS.length];
  return slug;
}

app.post('/api/quotes/:quoteId/extend', authenticate, async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Banco indisponível' });
  if (!z.string().datetime({ offset: true }).safeParse(req.body.expectedExpiry).success) return res.status(400).json({ error: 'Atualize o orçamento antes de prorrogar.' });
  const { data, error } = await supabase.rpc('extend_quote_retention', { p_quote_id: req.params.quoteId, p_user_id: req.user.id, p_expected_expiry: req.body.expectedExpiry });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ expiresAt: data });
});

app.post("/api/proposal/generate", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { quoteId } = req.body;
    if (!quoteId) return res.status(400).json({ error: "quoteId required" });
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data: quote, error: qErr } = await supabase.from('quotes').select('id, user_id').eq('id', quoteId).single();
    if (qErr || !quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (quote.user_id !== userId) return res.status(403).json({ error: "Acesso negado" });

    await supabase.from('proposals').update({ is_active: false }).eq('quote_id', quoteId).eq('user_id', userId);

    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase.from('proposals').select('id').eq('slug', slug).maybeSingle();
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    const { data: proposal, error: pErr } = await supabase.from('proposals').insert([{
      slug, quote_id: quoteId, user_id: userId,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      is_active: true,
    }]).select().single();

    if (pErr) throw pErr;

    await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', quoteId);

    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const baseUrl = process.env.VERCEL_ENV === 'production'
      ? (process.env.APP_URL || requestOrigin)
      : requestOrigin;
    const link = `${baseUrl}/p/${slug}`;

    res.json({ success: true, slug, link, expiresAt: proposal.expires_at, proposalId: proposal.id });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao gerar proposta. Tente novamente.' });
  }
});

const sendQuoteEmailSchema = z.object({
  quoteId: z.string().uuid(),
  to: z.string().email().max(320),
  subject: z.string().trim().min(1).max(180),
  message: z.string().trim().min(1).max(5000),
});

app.post("/api/quotes/:quoteId/email", authenticate, async (req, res) => {
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Envio de e-mail ainda não configurado.' });
  }
  if (!supabase) return res.status(500).json({ error: 'Supabase não configurado.' });

  const parsed = sendQuoteEmailSchema.safeParse({ ...req.body, quoteId: req.params.quoteId });
  if (!parsed.success) return res.status(400).json({ error: 'Revise o destinatário, assunto e mensagem.' });

  try {
    const { quoteId, to, subject, message } = parsed.data;
    const { data: quote, error: quoteError } = await supabase.from('quotes')
      .select('id, retention_expires_at, quote_number, client_name, client_vehicle_or_service, items, subtotal, discount_total, total, profiles!inner(company_name, company_logo, email, quote_color)')
      .eq('id', quoteId)
      .eq('user_id', req.user.id)
      .maybeSingle();
    if (quoteError || !quote) return res.status(404).json({ error: 'Orçamento não encontrado.' });

    await supabase.from('proposals').update({ is_active: false }).eq('quote_id', quoteId).eq('user_id', req.user.id);
    const slug = generateSlug();
    const expiresAt = quote.retention_expires_at || new Date(Date.now() + 14 * 86400000).toISOString();
    const { error: proposalError } = await supabase.from('proposals').insert([{
      slug,
      quote_id: quoteId,
      user_id: req.user.id,
      expires_at: expiresAt,
      is_active: true,
    }]);
    if (proposalError) throw proposalError;

    await supabase.from('quotes').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', quoteId).eq('user_id', req.user.id);

    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const baseUrl = process.env.VERCEL_ENV === 'production' ? (process.env.APP_URL || requestOrigin) : requestOrigin;
    const proposalLink = `${baseUrl}/p/${slug}`;
    const profile = Array.isArray(quote.profiles) ? quote.profiles[0] : quote.profiles;
    const color = /^#[0-9A-Fa-f]{6}$/.test(profile?.quote_color || '') ? profile.quote_color : '#FF9F1C';
    const items = Array.isArray(quote.items) ? quote.items : [];
    const itemRows = items.map(item => {
      const quantity = Number(item?.quantity || 0);
      const unitPrice = Number(item?.unitPrice || 0);
      const discount = Number(item?.discount || 0);
      const itemTotal = quantity * unitPrice * (1 - discount / 100);
      return `<tr><td style="padding:10px 6px;border-bottom:1px solid #eee"><strong>${escapeHtml(item?.name)}</strong></td><td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:center">${quantity}</td><td style="padding:10px 6px;border-bottom:1px solid #eee;text-align:right">${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemTotal)}</td></tr>`;
    }).join('');

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
      to: [to],
      replyTo: profile?.email || undefined,
      subject,
      html: `<div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:28px 12px;color:#18181b"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden"><div style="height:6px;background:${color}"></div><div style="padding:28px"><h1 style="font-size:20px;margin:0 0 6px">${escapeHtml(profile?.company_name || 'ORKTO')}</h1><p style="color:#71717a;margin:0 0 24px">Proposta #${escapeHtml(quote.quote_number)}</p><div style="white-space:pre-line;line-height:1.6;background:#fafafa;border-left:3px solid ${color};padding:16px;margin-bottom:24px">${escapeHtml(message)}</div><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:left;padding:8px 6px">Item</th><th style="text-align:center;padding:8px 6px">Qtd.</th><th style="text-align:right;padding:8px 6px">Total</th></tr></thead><tbody>${itemRows}</tbody></table><p style="font-size:20px;font-weight:bold;text-align:right;margin:22px 0">Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(quote.total))}</p><p style="text-align:center;margin:28px 0"><a href="${proposalLink}" style="display:inline-block;background:#10b981;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Visualizar e aprovar proposta</a></p><p style="font-size:11px;color:#a1a1aa;text-align:center">Enviado com segurança pela ORKTO.</p></div></div></div>`,
    });
    if (error) throw new Error(error.message);
    res.json({ success: true, id: data?.id, proposalLink, expiresAt });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(502).json({ error: 'Não foi possível enviar o e-mail agora.' });
  }
});

app.get("/api/proposal/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data: proposal, error: pErr } = await supabase.from('proposals')
      .select('id, slug, quote_id, is_active, expires_at, viewed_at, approved_at, created_at')
      .eq('slug', slug).maybeSingle();

    if (pErr || !proposal) return res.status(404).json({ error: "Proposta não encontrada" });
    if (!proposal.is_active || new Date(proposal.expires_at) < new Date()) {
      return res.status(410).json({ error: "Proposta expirada", expired: true });
    }

    // Buscar dados do orçamento + perfil do profissional
    const { data: quote, error: qErr } = await supabase.from('quotes')
      .select('id, quote_number, client_name, client_phone, client_email, client_vehicle_or_service, notes, items, subtotal, discount_total, taxes, total, valid_value_days, payment_instructions, status, profiles!inner(company_name, company_logo, address, whatsapp_number, quote_color, brand_name)')
      .eq('id', proposal.quote_id).single();

    if (qErr || !quote) return res.status(404).json({ error: "Orçamento não encontrado" });

    res.json({ proposal, quote });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao buscar proposta.' });
  }
});

app.post("/api/proposal/:slug/viewed", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data: proposal } = await supabase.from('proposals').select('id, quote_id, viewed_at, is_active, expires_at').eq('slug', slug).maybeSingle();
    if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });
    if (!proposal.is_active || new Date(proposal.expires_at).getTime() <= Date.now()) return res.status(410).json({ error: 'Proposta expirada' });

    if (!proposal.viewed_at) {
      const viewedAt = new Date().toISOString();
      await supabase.from('proposals').update({ viewed_at: viewedAt }).eq('id', proposal.id);
      await supabase.from('quotes').update({ status: 'viewed', viewed_at: viewedAt, updated_at: viewedAt })
        .eq('id', proposal.quote_id).eq('status', 'sent');
    }

    res.json({ success: true });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

app.post("/api/proposal/:slug/refresh", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { slug } = req.params;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

    const { data: proposal } = await supabase.from('proposals')
      .select('id, user_id, quote_id').eq('slug', slug).maybeSingle();
    if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });
    if (proposal.user_id !== userId) return res.status(403).json({ error: "Acesso negado" });

    // Invalidar antiga
    await supabase.from('proposals').update({ is_active: false }).eq('id', proposal.id);

    // Gerar novo slug
    let newSlug = generateSlug();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase.from('proposals').select('id').eq('slug', newSlug).maybeSingle();
      if (!existing) break;
      newSlug = generateSlug();
      attempts++;
    }

    const { data: newProposal, error: pErr } = await supabase.from('proposals').insert([{
      slug: newSlug, quote_id: proposal.quote_id, user_id: userId,
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      is_active: true,
    }]).select().single();

    if (pErr) throw pErr;

    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    res.json({ success: true, slug: newSlug, link: `${baseUrl}/p/${newSlug}`, expiresAt: newProposal.expires_at });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao regenerar proposta.' });
  }
});

Sentry.setupExpressErrorHandler(app);

export default app;
