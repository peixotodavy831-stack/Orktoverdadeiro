---
description: FASE 3 — Webhook HMSC verification, rate limiting, CORS, Helmet, sanitização de erros, IDs criptográficos e segurança de endpoints públicos. Pode rodar paralelo à Fase 2.
mode: subagent
permission:
  edit: allow
  read: allow
  bash: allow
---

# FASE 3 — Segurança: Hardening do Servidor (pode rodar paralelo à Fase 2)

## Dependência

**Base:** Fase 1 concluída (secrets limpos, RLS corrigido). Pode rodar **em paralelo** com Fase 2.

## Contexto da Marca ORKTO

- **Produto:** Orçamentos digitais com pagamento integrado (Asaas)
- **Webhook Asaas:** Gerencia assinaturas e pagamentos — se falsificado, usuários ganham acesso pago sem pagar
- **IDs públicos:** Orçamentos são compartilhados via link — IDs previsíveis = vazamento de dados

---

## Problemas a resolver

### 3.1 — Webhook Asaas sem verificação (CRÍTICO)
- `server.ts:398-430` — qualquer requisição POST com `event` + `payment` altera planos
- Sem HMAC, sem IP allowlist, sem verificação de payload
- Atacante pode forjar eventos `PAYMENT_RECEIVED` para ativar planos pagos de graça

### 3.2 — Zero rate limiting (ALTO)
- Nenhum endpoint tem limite de requisições
- `/api/quote/public/:id` pode ser varrido (brute force de UUIDs)
- Webhook pode ser inundado (DoS)

### 3.3 — Sem CORS (ALTO)
- Nenhuma configuração de origens permitidas
- Comportamento inconsistente entre dev e production

### 3.4 — Sem security headers (ALTO)
- Sem Helmet: sem CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Site pode ser iframado (clickjacking)

### 3.5 — Error messages vazam detalhes internos (ALTO)
- `server.ts:37,71,88,107,...` — `res.status(500).json({ error: error.message })`
- Vaza stack traces, nomes de tabelas, erros do Asaas

### 3.6 — Math.random() pra IDs públicos (MÉDIO)
- `CreateQuote.tsx:292` — `Math.random().toString(36).substring(2, 11)` (~48 bits)
- Previsível — atacante pode enumerar orçamentos públicos

### 3.7 — JSON.parse sem try/catch (BAIXO)
- `App.tsx:173,314` — `JSON.parse(q.items || '[]')` pode crashar se dado corrompido

---

## Arquivos para modificar

- `server.ts` — webhook HMAC, rate limit, CORS, Helmet, sanitizar erros
- `package.json` — adicionar `express-rate-limit`, `cors`, `helmet`
- `src/components/CreateQuote.tsx` — fix `Math.random()` → `crypto.randomUUID()`
- `src/App.tsx` — fix `JSON.parse` com try/catch

## Passos

### 1. Adicionar dependências

```bash
npm install express-rate-limit cors helmet
npm install -D @types/cors
```

### 2. Adicionar CORS

```typescript
import cors from 'cors';

const allowedOrigins = process.env.VERCEL
  ? ['https://project-ao409.vercel.app']
  : ['http://localhost:5173', 'http://localhost:3001'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
```

### 3. Adicionar Helmet (security headers)

```typescript
import helmet from 'helmet';
app.use(helmet());
```

### 4. Adicionar rate limiting global + específico

```typescript
import rateLimit from 'express-rate-limit';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api/', globalLimiter);

// Rate limit mais restritivo para endpoints públicos
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api/quote/public', publicLimiter);
app.use('/api/quote/:id/approve', publicLimiter);
app.use('/api/quote/:id/reject', publicLimiter);

// Webhook: máximo 10 req/min (Asaas não envia muitas)
app.use('/api/asaas/webhook', rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Muitas requisições de webhook.' },
}));
```

### 5. Adicionar verificação HMAC no webhook Asaas

```typescript
import crypto from 'crypto';

function verifyAsaasSignature(payload: any, signature: string, secret: string): boolean {
  try {
    const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawPayload)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// Aplicar no handler:
app.post("/api/asaas/webhook", async (req, res) => {
  const signature = req.headers['asaas-signature'] as string;
  if (!signature || !verifyAsaasSignature(req.body, signature, process.env.ASAAS_API_KEY || '')) {
    console.error('[WEBHOOK] Invalid signature received');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // ... resto do handler
});
```

### 6. Sanitizar error messages

Substituir **todas** as ocorrências de:
```typescript
res.status(500).json({ error: error.message });
```
Por:
```typescript
console.error(`[ERRO] ${req.method} ${req.path}:`, error);
res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
```

Manter erros de validação (400, 404) com mensagens específicas, mas nunca vazar stack traces.

### 7. Fix Math.random() → crypto.randomUUID()

```typescript
// CreateQuote.tsx ~292
// ANTES:
const quoteId = editQuoteSource ? editQuoteSource.id : 'q_' + Math.random().toString(36).substring(2, 11);
// DEPOIS:
const quoteId = editQuoteSource
  ? editQuoteSource.id
  : 'q_' + crypto.randomUUID().replace(/-/g, '').substring(0, 9);
```

### 8. Fix JSON.parse com try/catch

```typescript
// App.tsx ~173 e ~314
function parseItems(items: any): any[] {
  if (Array.isArray(items)) return items;
  try { return JSON.parse(items || '[]'); } catch { return []; }
}
// Uso: items: parseItems(q.items),
```

## Critérios de sucesso

- `npx tsc --noEmit` passa sem erros
- `npx vite build` compila
- Webhook sem signature → 401
- >30 requisições a `/api/quote/public/...` em 15 min → 429
- Headers de segurança presentes (CSP, X-Frame-Options, etc.)
- Erro 500 retorna `"Erro interno do servidor"` (não stack trace)
- Quote IDs usam `crypto.randomUUID()`

## Rollback

```bash
git checkout -- server.ts package.json src/components/CreateQuote.tsx src/App.tsx
npm install # volta versão anterior
```
