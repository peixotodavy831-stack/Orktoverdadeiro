import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= max) return false;
    entry.count++;
    return true;
  };
}
const aiRateLimiter = createRateLimiter(60_000, 10);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': "aistudio-build",
    }
  }
});

const PLAN_LIMITS: Record<string, number> = { starter: 3, free: 3, pro: 30, business: 999999 };

async function checkAiUsageLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number; plan: string }> {
  if (!supabase) return { allowed: true, used: 0, limit: 999999, plan: 'free' };
  const month = new Date().toISOString().slice(0, 7);
  const { data: profile } = await supabase.from('profiles').select('active_plan').eq('id', userId).single();
  const plan = profile?.active_plan || 'free';
  const limit = PLAN_LIMITS[plan] || 3;
  const { data: usage } = await supabase
    .from('usage_limits')
    .select('ai_usage')
    .eq('user_id', userId)
    .eq('month', month)
    .single();
  const used = usage?.ai_usage || 0;
  return { allowed: used < limit, used, limit, plan };
}

const adaptQuoteSchema = z.object({
  profession: z.string().min(1, "Profissão é obrigatória"),
  tone: z.string().optional(),
  clientName: z.string().optional(),
  clientVehicleOrService: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.any()).optional(),
  paymentInstructions: z.string().optional(),
  userId: z.string().optional(),
});

app.post("/api/gemini/adapt-quote", async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!aiRateLimiter(ip)) {
      return res.status(429).json({ error: "Muitas requisições. Aguarde alguns segundos." });
    }

    const parsed = adaptQuoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(e => e.message).join(', ') });
    }
    const { profession, tone, clientName, clientVehicleOrService, notes, items, paymentInstructions, userId } = parsed.data;

    if (userId && supabase) {
      const check = await checkAiUsageLimit(userId);
      if (!check.allowed) {
        return res.status(403).json({
          error: `Você usou todos os ${check.limit} refinamentos de IA do seu plano este mês. Faça upgrade para continuar.`,
          used: check.used,
          limit: check.limit,
          plan: check.plan,
        });
      }
    }

    const systemInstruction = `Você é um assessor de redação comercial e design de propostas de vendas para a plataforma ORKTO. 
Seu trabalho é pegar um rascunho de orçamento técnico e melhorá-lo para que pareça altamente profissional, convincente e adaptado especificamente com estilo visual e textual para a profissão[...]

Diretrizes obrigatórias:
1. NUNCA mude valores numéricos (quantidade, preço unitário, desconto) inseridos pelo usuário. Apenas melhore as palavras, títulos de serviço e descrições.
2. Adapte a linguagem de acordo com a profissão:
- Advogado: linguajar formal, sóbrio, polido e confiável.
- Eletricista: termos diretos, com ênfase em segurança, normas técnicas e clareza objetiva.
- Designer: linguajar limpo, focado em conceito, criatividade e entrega estética.
- Oficina: objetivo, prático, destacando garantia e detalhes operacionais.
- Construção/Marcenaria: termos robustos, confiando em materialidade, estabilidade e durabilidade.
3. Adapte as frases de acordo com o tom desejado (formal, técnico, comercial ou criativo).
4. No campo "items", ajuste os nomes e descrições dos itens de forma que fiquem refinados, profissionais e claros para o cliente final. O campo "id" deve permanecer o mesmo de cada item fornecid[...]`;

    const promptText = `Por favor, reescreva e personalize este orçamento para as seguintes especificações:
- Profissão do Prestador: ${profession}
- Tom de Linguagem: ${tone || 'comercial'}
- Cliente: ${clientName || 'Cliente'}
- Contexto / Serviço Central: ${clientVehicleOrService || 'Prestação de Serviço'}
- Observações Originais: ${notes || ''}
- Instruções de Pagamento Originais: ${paymentInstructions || ''}

Lista de Itens Fornecidos para Revisar:
${JSON.stringify(items || [], null, 2)}

Por favor, retorne a resposta no formato estruturado especificado.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            notes: { 
              type: Type.STRING, 
              description: "Observações técnicas e comerciais polidas. Inclua detalhes sobre prazos, termos e garantias de forma envolvente e adequada à profissão." 
            },
            paymentInstructions: { 
              type: Type.STRING, 
              description: "Informações de pagamento adaptadas para ficar refinado de acordo com o tom selecionado." 
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING, description: "Título revisado e sofisticado do item (ex: de 'olhar cano' para 'Identificação de Patologias e Desobstrução Hidráulica' conforme a [...]" },
                  description: { type: Type.STRING, description: "Descrição que agrega valor e explica o que está incluso de maneira persuasiva." },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                  discount: { type: Type.NUMBER }
                },
                required: ["id", "name", "description", "quantity", "unitPrice", "discount"]
              }
            },
            aestheticAdvice: { 
              type: Type.STRING, 
              description: "Dica inteligente em 1 ou 2 parágrafos curtos explicando o porquê destas mudanças visuais/textuais melhorarem a taxa de conversão nesse nicho específico." 
            }
          },
          required: ["notes", "paymentInstructions", "items", "aestheticAdvice"]
        }
      }
    });

    const resultText = response.text.trim();
    const adaptedData = JSON.parse(resultText);

    if (supabase && userId) {
      try {
        await supabase.rpc('increment_ai_usage', { p_user_id: userId, p_month: new Date().toISOString().slice(0, 7) });
        adaptedData.usageLimit = await checkAiUsageLimit(userId);
      } catch (e) { console.error("Usage increment error:", e); }
    }

    res.json(adaptedData);

  } catch (error: any) {
    console.error("Gemini adaptation error:", error);
    res.status(500).json({ error: "Falha na comunicação com o assistente inteligente ORKTO: " + error.message });
  }
});

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

    const { data: existingCustomer, error: selectError } = await supabase!.from('profiles').select('asaas_customer_id, is_founder, founder_price').eq('id', userId).maybeSingle();

    if (selectError) {
      console.log("Profile select error:", selectError.message);
    }
    let customerId = existingCustomer?.asaas_customer_id;
    const isFounder = existingCustomer?.is_founder || false;
    const founderPrice = existingCustomer?.founder_price || null;

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
      }
    }

    const prices: Record<string, number> = { free: 49, pro: 79, business: 299 };
    const planPrice = isFounder && founderPrice ? founderPrice : prices[plan];

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

    if (!isFounder) {
      const updateResult = await supabase!.from('profiles').update({
        is_founder: true,
        founder_price: planPrice,
        active_plan: plan,
      }).eq('id', userId);

      if (updateResult.error) {
        console.log("Founder update skipped (user may not exist in profiles):", updateResult.error.message);
      }
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
