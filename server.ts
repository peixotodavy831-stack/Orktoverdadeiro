import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Supabase API endpoints for quote management
if (supabase) {
  // Get user quotes
  app.get("/api/quotes/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const { data, error } = await supabase
        .from('quotes')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create quote
  app.post("/api/quotes", async (req, res) => {
    try {
      const body = req.body;
      if (!body.userId) return res.status(400).json({ error: "userId required" });

      const insertData: any = { user_id: body.userId };
      if (body.id) insertData.id = body.id;
      const fieldMap: Record<string, string> = {
        quoteNumber: 'quote_number', clientName: 'client_name', clientPhone: 'client_phone',
        clientEmail: 'client_email', clientCompany: 'client_company', clientVehicleOrService: 'client_vehicle_or_service',
        notes: 'notes', items: 'items', subtotal: 'subtotal', discountTotal: 'discount_total',
        taxes: 'taxes', total: 'total', validValueDays: 'valid_value_days', paymentInstructions: 'payment_instructions',
        status: 'status',
      };
      for (const [camel, snake] of Object.entries(fieldMap)) {
        if (body[camel] !== undefined) insertData[snake] = body[camel];
      }
      insertData.created_at = new Date().toISOString();
      insertData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('quotes')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single quote
  app.get("/api/quotes/detail/:quoteId", async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { data, error } = await supabase
        .from('quotes')
        .select()
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update quote
  app.put("/api/quotes/:quoteId", async (req, res) => {
    try {
      const { quoteId } = req.params;
      const updates = req.body;

      const { data, error } = await supabase
        .from('quotes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', quoteId)
        .select();

      if (error) throw error;
      res.json(data?.[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete quote
  app.delete("/api/quotes/:quoteId", async (req, res) => {
    try {
      const { quoteId } = req.params;
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

app.get("/api/quote/next-number", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: "userId required" });
    const { data, error } = await supabase
      .from('quotes')
      .select('sequence_number')
      .eq('user_id', userId)
      .order('sequence_number', { ascending: false })
      .limit(1);
    if (error) throw error;
    const nextSeq = (data && data.length > 0) ? (data[0].sequence_number || 0) + 1 : 1001;
    const quoteNumber = nextSeq.toString().padStart(6, '0');
    res.json({ sequenceNumber: nextSeq, quoteNumber });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function validateQuoteStatusTransition(id: string, newStatus: string, allowedFrom: string[]): Promise<string | null> {
  if (!supabase) return "Supabase not configured";
  const { data } = await supabase.from('quotes').select('status').eq('id', id).single();
  if (!data) return "Orçamento não encontrado";
  if (!allowedFrom.includes(data.status)) {
    return `Orçamento já está como "${data.status}". Não é possível alterar para "${newStatus}".`;
  }
  return null;
}

app.get("/api/quote/public/:id", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('quotes')
      .select(`id, quote_number, client_name, client_phone, client_email, client_vehicle_or_service, notes, items, subtotal, discount_total, taxes, total, valid_value_days, payment_instructions, status, profiles!inner(company_name, company_logo, address, whatsapp_number, quote_color, brand_name)`)
      .eq('id', id)
      .single();
    if (error || !data) return res.status(404).json({ error: "Orçamento não encontrado" });

    if (data.status === 'draft' || data.status === 'sent') {
      await supabase.from('quotes').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', id);
      data.status = 'viewed';
    }

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/quote/:id/approve", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { id } = req.params;
    const validationError = await validateQuoteStatusTransition(id, 'approved', ['sent', 'viewed', 'pending', 'draft']);
    if (validationError) return res.status(400).json({ error: validationError });
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/quote/:id/reject", async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
  try {
    const { id } = req.params;
    const validationError = await validateQuoteStatusTransition(id, 'rejected', ['sent', 'viewed', 'pending', 'draft']);
    if (validationError) return res.status(400).json({ error: validationError });
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'rejected', rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const waitlistSchema = z.object({
  email: z.string().email("Email inválido"),
  name: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().default("landing_page"),
  referralCode: z.string().optional(),
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/waitlist/count", async (_req, res) => {
  if (!supabase) return res.json({ count: 0 });
  try {
    const { count } = await supabase.from("waitlist").select("*", { count: "exact", head: true });
    res.json({ count: count || 0 });
  } catch { res.json({ count: 0 }); }
});

const ASAAS_API_URL = process.env.ASAAS_ENVIRONMENT === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://api-sandbox.asaas.com/v3';

const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID || '';

const asaasPlanIds: Record<string, string> = {
  pro: process.env.ASAAS_PLAN_ID_PRO || 'pro_monthly',
  business: process.env.ASAAS_PLAN_ID_BUSINESS || 'business_monthly',
};

async function getAsaasApiKey(userId: string): Promise<string | null> {
  if (!supabase) return process.env.ASAAS_API_KEY || null;
  const { data } = await supabase.from('profiles').select('asaas_api_key').eq('id', userId).single();
  return data?.asaas_api_key || process.env.ASAAS_API_KEY || null;
}

async function requestAsaas(method: string, path: string, body: any = null, apiKey?: string) {
  const key = apiKey || process.env.ASAAS_API_KEY;
  if (!key) throw new Error('Asaas API key not configured');
  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': key,
      'User-Agent': 'orkto/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!text) return null;
  try {
    const data = JSON.parse(text);
    if (!res.ok) throw new Error(data.errors?.[0]?.description || `Asaas error ${res.status}`);
    return data;
  } catch (e: any) {
    if (e.message.includes('Asaas error')) throw e;
    throw new Error(`Asaas parse error: ${text.substring(0, 200)}`);
  }
}

app.post("/api/asaas/checkout", async (req, res) => {
  try {
    const { userId, plan, email, name, phone, cpfCnpj, returnUrl } = req.body;
    if (!userId || !plan) return res.status(400).json({ error: "userId and plan required" });

    const apiKey = await getAsaasApiKey(userId);
    if (!apiKey) {
      if (!process.env.ASAAS_API_KEY) {
        return res.status(400).json({ error: "Asaas não configurado. Adicione sua API Key nas Configurações." });
      }
    }

    if (plan === 'free') {
      return res.json({ success: true, plan: 'free' });
    }

    const planId = asaasPlanIds[plan];
    if (!planId) return res.status(400).json({ error: "Plano inválido" });

    const { data: existingCustomer, error: selectError } = await supabase!.from('profiles').select('asaas_customer_id').eq('id', userId).maybeSingle();

    if (selectError) {
      console.log("Profile select error:", selectError.message);
    }
    let customerId = existingCustomer?.asaas_customer_id;

    if (!customerId) {
      const customer = await requestAsaas('POST', '/customers', {
        name: name || 'Cliente Orkto',
        email: email || '',
        phone: phone?.replace(/\D/g, '') || '',
        cpfCnpj: cpfCnpj?.replace(/\D/g, '') || '',
        notificationDisabled: false,
      }, apiKey || undefined);
      customerId = customer.id;

      if (existingCustomer) {
        await supabase!.from('profiles').update({ asaas_customer_id: customerId }).eq('id', userId);
      } else {
        await supabase!.from('profiles').upsert({
          id: userId,
          asaas_customer_id: customerId,
          email: email || '',
        }, { onConflict: 'id' });
      }
    }

    const prices: Record<string, number> = { free: 4900, pro: 7900, business: 29900 };
    const planPrice = prices[plan] || 49;

    const subscription = await requestAsaas('POST', '/subscriptions', {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: planPrice,
      nextDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      cycle: 'MONTHLY',
      description: `Orkto ${plan === 'pro' ? 'Pro' : plan === 'business' ? 'Business' : 'Fundador'}`,
      maxPayments: null,
      externalReference: userId,
      split: ASAAS_WALLET_ID ? [{ walletId: ASAAS_WALLET_ID, percent: 100 }] : undefined,
    }, apiKey || undefined);

    console.log("Subscription created:", JSON.stringify(subscription));

    const paymentLink = subscription?.paymentLink || null;
    const checkoutSession = subscription?.checkoutSession || null;

    const paymentId = subscription?.nextPaymentId;
    let invoiceUrl = checkoutSession || paymentLink || null;

    if (paymentId) {
      const payment = await requestAsaas('GET', `/payments/${paymentId}`, null, apiKey || undefined);
      invoiceUrl = invoiceUrl || payment?.invoiceUrl || null;
    }

    const pixQrCode = null;
    const pixKey = null;

    const upsertResult = await supabase!.from('profiles').upsert({
      id: userId,
      active_plan: plan,
      email: email || '',
    }, { onConflict: 'id' });

    if (upsertResult.error) {
      console.log("Profile upsert error:", upsertResult.error.message);
    }

    res.json({
      success: true,
      subscriptionId: subscription.id,
      paymentId: subscription.nextPaymentId || null,
      url: invoiceUrl,
      pixQrCode,
      pixKey,
      status: subscription.status,
    });

  } catch (error: any) {
    console.error("Asaas checkout FULL error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

app.post("/api/asaas/webhook", async (req, res) => {
  try {
    const { event, payment } = req.body;
    if (!event || !payment) return res.status(400).json({ error: "Invalid webhook" });

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const userId = payment.externalReference;
      if (userId && supabase) {
        const subscription = payment.subscription;
        let plan: string = 'pro';
        if (subscription) {
          const { data: sub } = await requestAsaas('GET', `/subscriptions/${subscription}`, null, process.env.ASAAS_API_KEY);
          if (sub) {
            if (sub.value > 50) plan = 'business';
          }
        }
        await supabase.from('profiles').update({ active_plan: plan }).eq('id', userId);
      }
    }

    if (event === 'PAYMENT_OVERDUE' || event === 'PAYMENT_DELETED' || event === 'SUBSCRIPTION_CANCELED') {
      const userId = payment.externalReference;
      if (userId && supabase) {
        await supabase.from('profiles').update({ active_plan: 'free' }).eq('id', userId);
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error("Asaas webhook error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/asaas/generate-checkout", async (req, res) => {
  try {
    const { userId, subscriptionId } = req.body;
    if (!userId || !subscriptionId) return res.status(400).json({ error: "userId and subscriptionId required" });

    const apiKey = await getAsaasApiKey(userId);

    const payment = await requestAsaas('POST', '/payments', {
      subscription: subscriptionId,
      billingType: 'CREDIT_CARD',
      value: 0,
      description: 'Ativação do plano Orkto',
    }, apiKey || undefined);

    const checkoutUrl = payment?.checkoutUrl || payment?.invoiceUrl || null;

    res.json({ success: true, checkoutUrl, paymentId: payment?.id });
  } catch (error: any) {
    console.error("Asaas generate-checkout error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  // Vite middleware development setup or fallback to dist in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to host 0.0.0.0 and port 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
