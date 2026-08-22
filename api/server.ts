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
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const allowedOrigins = [
  'http://localhost:3000', 'http://localhost:5173',
  'https://orktoverdeiro.vercel.app', 'https://orkto.co', 'https://www.orkto.co',
  'https://orkto.vercel.app', 'https://project-ao409.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Não permitido por CORS'));
  }, credentials: true,
}));

app.use(helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: 'draft-7', legacyHeaders: false,
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

if (supabase && supabaseClient) {
  app.get("/api/quotes/list", authenticate, async (req, res) => {
    try {
      const { data, error } = await supabaseClient.from('quotes').select().eq('user_id', req.user.id).order('created_at', { ascending: false });
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
      const { data: profile } = await supabaseClient.from('profiles').select('active_plan').eq('id', userId).maybeSingle();
      const plan = profile?.active_plan || 'free';
      const planLimits = { free: 5, starter: 5, pro: 50, business: 999 };
      const maxQuotes = planLimits[plan] || 5;

      const { count } = await supabaseClient.from('quotes').select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('status', 'in', '(rejected,expired)');

      if (count && count >= maxQuotes) {
        return res.status(403).json({ error: `Limite de ${maxQuotes} propostas ativas atingido no plano ${plan}. Faça upgrade para criar mais.`, limitReached: true });
      }

      const insertData = { user_id: userId };
      if (body.id) insertData.id = body.id;
      for (const [camel, snake] of Object.entries(FIELD_MAP_CAMEL_TO_SNAKE)) {
        if (body[camel] !== undefined) insertData[snake] = body[camel];
      }
      insertData.created_at = new Date().toISOString();
      insertData.updated_at = new Date().toISOString();
      const { data, error } = await supabaseClient.from('quotes').insert([insertData]).select().single();
      if (error) throw error;
      res.json(data);
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.get("/api/quotes/detail/:quoteId", authenticate, async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { data, error } = await supabaseClient.from('quotes').select().eq('id', quoteId).single();
      if (error || !data) return res.status(404).json({ error: 'Orçamento não encontrado' });
      if (data.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
      res.json(data);
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });

  app.put("/api/quotes/:quoteId", authenticate, async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { data: existing } = await supabaseClient.from('quotes').select('user_id').eq('id', quoteId).single();
      if (!existing) return res.status(404).json({ error: 'Orçamento não encontrado' });
      if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
      const updates = {};
      const body = req.body;
      for (const [camel, snake] of Object.entries(FIELD_MAP_CAMEL_TO_SNAKE)) {
        if (body[camel] !== undefined) updates[snake] = body[camel];
      }
      for (const key of ALLOWED_UPDATE_FIELDS) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      delete updates.user_id; delete updates.id; delete updates.created_at;
      delete updates.quote_number; delete updates.sequence_number;
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nenhum campo válido para atualização' });
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabaseClient.from('quotes').update(updates).eq('id', quoteId).select();
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
      const { data: existing } = await supabaseClient.from('quotes').select('user_id').eq('id', quoteId).single();
      if (!existing) return res.status(404).json({ error: 'Orçamento não encontrado' });
      if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });
      const { error } = await supabaseClient.from('quotes').delete().eq('id', quoteId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error(`[ERRO] ${req.method} ${req.path}:`, error);
      res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
    }
  });
}

app.get("/api/quote/next-number", authenticate, async (req, res) => {
  if (!supabaseClient) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { data, error } = await supabaseClient.from('quotes').select('sequence_number').eq('user_id', req.user.id).order('sequence_number', { ascending: false }).limit(1);
    if (error) throw error;
    const nextSeq = (data && data.length > 0) ? (data[0].sequence_number || 0) + 1 : 1001;
    res.json({ sequenceNumber: nextSeq, quoteNumber: nextSeq.toString().padStart(6, '0') });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.get("/api/quote/public/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('quotes').select('id, quote_number, client_name, client_phone, client_email, client_vehicle_or_service, notes, items, subtotal, discount_total, taxes, total, valid_value_days, payment_instructions, status, profiles!inner(company_name, company_logo, address, whatsapp_number, quote_color, brand_name)').eq('id', id).single();
    if (error || !data) return res.status(404).json({ error: "Orçamento não encontrado" });
    res.json(data);
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

async function validateQuoteStatusTransition(id, newStatus, allowedFrom) {
  if (!supabase) return "Supabase not configured";
  const { data } = await supabase.from('quotes').select('status').eq('id', id).single();
  if (!data) return "Orçamento não encontrado";
  if (!allowedFrom.includes(data.status)) return `Orçamento já está como "${data.status}". Não é possível alterar para "${newStatus}".`;
  return null;
}

app.post("/api/quote/:id/approve", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { id } = req.params;
    const { clientName } = req.body || {};
    const validationError = await validateQuoteStatusTransition(id, 'approved', ['sent', 'viewed', 'pending', 'draft']);
    if (validationError) return res.status(400).json({ error: validationError });

    // Buscar dados do quote + perfil para envio de email
    const { data: quote } = await supabase.from('quotes')
      .select('id, quote_number, client_name, client_email, total, profiles!inner(company_name, email)')
      .eq('id', id).single();

    const { error } = await supabase.from('quotes').update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;

    // Email de confirmação ao CLIENTE
    if (process.env.RESEND_API_KEY && quote?.client_email) {
      const companyName = quote.profiles?.company_name || 'o profissional';
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
            <p style="color:#FF9F1C;font-size:24px;font-weight:bold;margin:0">R$ ${(quote.total / 100).toFixed(2).replace('.', ',')}</p>
          </div>
          <p style="color:#666;font-size:12px;margin:0">O profissional entrará em contato para prosseguir com o pagamento.</p>
          <p style="color:#555;font-size:11px;margin-top:20px">ORKTO — Sistema operacional de vendas</p>
        </div>`,
      }).catch(e => console.error('[ERRO] Resend cliente:', e));
    }

    // Notificar o DONO da proposta
    if (process.env.RESEND_API_KEY && quote?.profiles?.email) {
      resend.emails.send({
        from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
        to: [quote.profiles.email],
        subject: `Orçamento aprovado por ${clientName || quote?.client_name || 'cliente'}!`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:16px">
          <h2 style="color:#FF9F1C;margin:0 0 8px">Orçamento Aprovado!</h2>
          <p style="color:#aaa;font-size:14px;margin:0 0 16px"><strong style="color:#fff">${clientName || quote?.client_name || 'Cliente'}</strong> acabou de aprovar o orçamento <strong style="color:#fff">#${quote?.quote_number}</strong>.</p>
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

app.post("/api/quote/:id/reject", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { id } = req.params;
    const validationError = await validateQuoteStatusTransition(id, 'rejected', ['sent', 'viewed', 'pending', 'draft']);
    if (validationError) return res.status(400).json({ error: validationError });
    const { error } = await supabase.from('quotes').update({ status: 'rejected', rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.post("/api/auth/demo-login", async (req, res) => {
  // Bloquear demo-login em produção
  if (process.env.VERCEL_ENV === 'production' || process.env.ASAAS_ENVIRONMENT === 'production') {
    return res.status(403).json({ error: 'Modo demo indisponível em produção. Crie uma conta.' });
  }
  if (!supabaseClient) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: 'demo@orkto.co', password: 'demo123456' });
    if (error) {
      await supabaseClient.auth.signUp({ email: 'demo@orkto.co', password: 'demo123456', options: { data: { full_name: 'Dono do Negócio' } } });
      const { data: sessionData, error: sessionError } = await supabaseClient.auth.signInWithPassword({ email: 'demo@orkto.co', password: 'demo123456' });
      if (sessionError) throw sessionError;
      return res.json({ session: sessionData.session });
    }
    res.json({ session: data.session });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
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
const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID || '';

const asaasPlanIds = { pro: process.env.ASAAS_PLAN_ID_PRO || 'pro_monthly', business: process.env.ASAAS_PLAN_ID_BUSINESS || 'business_monthly' };

function verifyAsaasSignature(payload, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function getAsaasApiKey(userId) {
  if (!supabase) return process.env.ASAAS_API_KEY || null;
  const { data } = await supabase.from('profiles').select('asaas_api_key').eq('id', userId).maybeSingle();
  return data?.asaas_api_key || process.env.ASAAS_API_KEY || null;
}

async function requestAsaas(method, path, body = null, apiKey) {
  const key = apiKey || process.env.ASAAS_API_KEY;
  if (!key) throw new Error('Asaas API key not configured');
  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'access_token': key, 'User-Agent': 'orkto/1.0' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    if (!res.ok) throw new Error(data.errors?.[0]?.description || `Asaas error ${res.status}`);
    return data;
  } catch (e) {
    if (e.message.includes('Asaas error')) throw e;
    throw new Error(`Asaas parse error: ${text.substring(0, 200)}`);
  }
}

app.post("/api/asaas/checkout", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { plan, email, name, phone, cpfCnpj } = req.body;
    if (!plan) return res.status(400).json({ error: "plan required" });
    const apiKey = await getAsaasApiKey(userId);
    if (!apiKey && !process.env.ASAAS_API_KEY) return res.status(400).json({ error: "Asaas não configurado." });
    const planId = asaasPlanIds[plan];
    if (plan !== 'free' && !planId) return res.status(400).json({ error: "Plano inválido" });
    const { data: existingCustomer } = await supabase.from('profiles').select('asaas_customer_id').eq('id', userId).maybeSingle();
    let customerId = existingCustomer?.asaas_customer_id;
    if (!customerId) {
      const customer = await requestAsaas('POST', '/customers', { name: name || 'Cliente Orkto', email: email || '', phone: phone?.replace(/\D/g, '') || '', cpfCnpj: cpfCnpj?.replace(/\D/g, '') || '', notificationDisabled: false }, apiKey || undefined);
      customerId = customer.id;
      if (existingCustomer) {
        await supabase.from('profiles').update({ asaas_customer_id: customerId }).eq('id', userId);
      } else {
        await supabase.from('profiles').upsert({ id: userId, asaas_customer_id: customerId, email: email || '' }, { onConflict: 'id' });
      }
    }
    const prices = { free: 4900, pro: 7900, business: 29900 };
    const subscription = await requestAsaas('POST', '/subscriptions', {
      customer: customerId, billingType: 'UNDEFINED', value: prices[plan] || 49,
      nextDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], cycle: 'MONTHLY',
      description: `Orkto ${plan}`, maxPayments: null, externalReference: userId,
      split: ASAAS_WALLET_ID ? [{ walletId: ASAAS_WALLET_ID, percent: 100 }] : undefined,
    }, apiKey || undefined);
    const invoiceUrl = subscription?.checkoutSession || subscription?.paymentLink || null;
    const upsertResult = await supabase.from('profiles').upsert({ id: userId, active_plan: plan, email: email || '' }, { onConflict: 'id' });
    res.json({
      success: true, subscriptionId: subscription.id, paymentId: subscription.nextPaymentId || null,
      url: invoiceUrl, pixQrCode: null, pixKey: null, status: subscription.status,
    });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: error?.message || 'Erro interno do servidor. Tente novamente.' });
  }
});

app.post("/api/asaas/webhook", async (req, res) => {
  try {
    const asaasSecret = process.env.ASAAS_WEBHOOK_SECRET;
    if (asaasSecret) {
      const signature = req.headers['asaas-signature'];
      if (!signature) return res.status(401).json({ error: 'Assinatura ausente' });
      const rawBody = JSON.stringify(req.body);
      if (!verifyAsaasSignature(rawBody, signature, asaasSecret)) return res.status(401).json({ error: 'Assinatura inválida' });
    }
    const { event, payment } = req.body;
    if (!event || !payment) return res.status(400).json({ error: "Invalid webhook" });
    if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && supabase) {
      const ref = payment.externalReference;
      if (ref && !payment.subscription) {
        await supabase.from('quotes').update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', ref);
      }
      const userId = ref;
      if (userId && payment.subscription) {
        let plan = 'pro';
        try {
          const sub = await requestAsaas('GET', `/subscriptions/${payment.subscription}`, null, process.env.ASAAS_API_KEY);
          if (sub && sub.value > 50) plan = 'business';
        } catch {}
        await supabase.from('profiles').update({ active_plan: plan }).eq('id', userId);
      }
    }
    if ((event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_DELETED' || event === 'SUBSCRIPTION_CANCELED') && supabase) {
      const userId = payment.externalReference;
      if (userId) await supabase.from('profiles').update({ active_plan: 'free' }).eq('id', userId);
    }
    res.json({ received: true });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.post("/api/asaas/generate-checkout", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subscriptionId, plan } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: "subscriptionId required" });
    const apiKey = await getAsaasApiKey(userId);
    const prices = { free: 4900, pro: 7900, business: 29900 };
    const payment = await requestAsaas('POST', '/payments', { subscription: subscriptionId, billingType: 'UNDEFINED', value: prices[plan || 'pro'] || 4900, description: 'Ativação do plano Orkto' }, apiKey || undefined);
    res.json({ success: true, checkoutUrl: payment?.checkoutUrl || payment?.invoiceUrl || null, paymentId: payment?.id });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: error?.message || 'Erro interno do servidor. Tente novamente.' });
  }
});

// ===== PIX para orçamentos =====
app.post("/api/quote/:id/pix", async (req, res) => {
  try {
    const { id } = req.params;
    if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
    const { data: quote, error } = await supabase.from('quotes').select('id, total, status, user_id').eq('id', id).single();
    if (error || !quote) return res.status(404).json({ error: "Orçamento não encontrado" });
    if (quote.status !== 'approved' && quote.status !== 'pending') return res.status(400).json({ error: "Orçamento precisa estar aprovado para gerar PIX" });
    const apiKey = await getAsaasApiKey(quote.user_id);
    let customerId = process.env.ASAAS_GLOBAL_CUSTOMER_ID;
    if (!customerId) {
      try {
        const existingCustomers = await requestAsaas('GET', `/customers?name=Orkto+Platform&limit=1`, null, apiKey || undefined);
        customerId = existingCustomers?.data?.[0]?.id;
      } catch {}
      if (!customerId) {
        const newCustomer = await requestAsaas('POST', '/customers', { name: 'Orkto Platform', email: 'pix@orkto.co', cpfCnpj: '000.000.000-00', notificationDisabled: true }, apiKey || undefined);
        customerId = newCustomer?.id;
      }
    }
    const payment = await requestAsaas('POST', '/payments', {
      customer: customerId, billingType: 'PIX', value: Number(quote.total),
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      description: `Orçamento #${quote.id.substring(0, 8)}`, externalReference: quote.id,
    }, apiKey || undefined);
    if (!payment || !payment.id) return res.status(500).json({ error: "Falha ao gerar cobrança PIX" });
    let pixData = null;
    try {
      pixData = await requestAsaas('GET', `/payments/${payment.id}/pixQrCode`, null, apiKey || undefined);
    } catch (e) {
      const paymentDetails = await requestAsaas('GET', `/payments/${payment.id}`, null, apiKey || undefined);
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
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      is_active: true,
    }]).select().single();

    if (pErr) throw pErr;

    await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', quoteId);

    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    const link = `${baseUrl}/p/${slug}`;

    res.json({ success: true, slug, link, expiresAt: proposal.expires_at, proposalId: proposal.id });
  } catch (error) {
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro ao gerar proposta. Tente novamente.' });
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

    const { data: proposal } = await supabase.from('proposals').select('id, viewed_at').eq('slug', slug).maybeSingle();
    if (!proposal) return res.status(404).json({ error: "Proposta não encontrada" });

    if (!proposal.viewed_at) {
      await supabase.from('proposals').update({ viewed_at: new Date().toISOString() }).eq('id', proposal.id);
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
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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

// ===== Notificações =====
app.post("/api/notify/quote-approved", async (req, res) => {
  try {
    const { quoteId, ownerEmail, clientName, quoteUrl } = req.body;
    if (!quoteId) return res.status(400).json({ error: "quoteId required" });
    if (process.env.RESEND_API_KEY && ownerEmail) {
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
        to: [ownerEmail],
        subject: `Orçamento aprovado por ${clientName || 'cliente'}!`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:16px"><h2 style="color:#FF9F1C;margin:0 0 8px">Orçamento Aprovado!</h2><p style="color:#aaa;font-size:14px;margin:0 0 16px"><strong style="color:#fff">${clientName || 'Cliente'}</strong> acabou de aprovar o orçamento.</p><a href="${quoteUrl || '#'}" style="display:inline-block;padding:12px 24px;background:#FF9F1C;color:#000;text-decoration:none;font-weight:bold;border-radius:12px;font-size:14px">Ver Orçamento</a><p style="color:#555;font-size:11px;margin-top:20px">ORKTO — Sistema operacional de vendas</p></div>`,
      });
      if (error) {
        Sentry.captureException(error);
        console.error(`[ERRO] Resend quote-approved:`, error);
      }
    } else {
      console.log(`[NOTIFICAÇÃO] Orçamento ${quoteId} aprovado por ${clientName}.`);
    }
    res.json({ notified: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

app.post("/api/notify/quote-paid", async (req, res) => {
  try {
    const { quoteId, ownerEmail, clientName, value } = req.body;
    if (!quoteId) return res.status(400).json({ error: "quoteId required" });
    if (process.env.RESEND_API_KEY && ownerEmail) {
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM || 'ORKTO <onboarding@resend.dev>',
        to: [ownerEmail],
        subject: `Pagamento PIX recebido — R$ ${value || '0'}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#111;color:#fff;border-radius:16px"><h2 style="color:#25D366;margin:0 0 8px">Pagamento Confirmado!</h2><p style="color:#aaa;font-size:14px;margin:0 0 4px"><strong style="color:#fff">R$ ${value || '0'}</strong> recebidos via PIX</p><p style="color:#666;font-size:13px;margin:0">Cliente: ${clientName || '—'}</p><p style="color:#555;font-size:11px;margin-top:20px">ORKTO — Sistema operacional de vendas</p></div>`,
      });
      if (error) {
        Sentry.captureException(error);
        console.error(`[ERRO] Resend quote-paid:`, error);
      }
    } else {
      console.log(`[NOTIFICAÇÃO] PIX recebido: ${quoteId}, valor: R$ ${value}`);
    }
    res.json({ notified: true });
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[ERRO] ${req.method} ${req.path}:`, error);
    res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
  }
});

Sentry.setupExpressErrorHandler(app);

export default app;
