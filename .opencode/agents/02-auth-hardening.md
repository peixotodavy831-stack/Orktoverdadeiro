---
description: FASE 2 — Adicionar middleware JWT em todas as rotas do server.ts, remover IDOR, corrigir auto-signup e remover credenciais demo hardcoded. Depende da Fase 1.
mode: subagent
permission:
  edit: allow
  read: allow
  bash: allow
---

# FASE 2 — Segurança: Auth Middleware + IDOR (executar após Fase 1)

## Dependência

**Necessário:** Fase 1 concluída (cliente Supabase anon-key criado, service role restrito).

## Contexto da Marca ORKTO

- **Tom:** Assertivo, urgente, premium-casual. Tudo em português brasileiro.
- **Produto:** Plataforma de orçamentos digitais. Dados dos usuários são **sigilosos** (orçamentos, clientes, preços).
- **Risco de IDOR:** Se User A acessar orçamentos do User B, a confiança na plataforma é destruída.

---

## Problemas a resolver

### 2.1 — Zero autenticação no servidor (CRÍTICO)
- `server.ts:25-125,128-146,158-211,292-396,432-453`
- **Todas as 12 rotas aceitam `userId` vindo do client sem verificação**
- Atacante pode ler/criar/editar/deletar qualquer dado de qualquer usuário

### 2.2 — Mass assignment no PUT (CRÍTICO)
- `server.ts:95-100` — `req.body` inteiro é passado pro `update()` do Supabase
- Atacante pode mudar `user_id`, `id`, `created_at` via PUT

### 2.3 — Auto-signup em falha de login (ALTO)
- `App.tsx:469-483` — se login falha, cria conta automaticamente
- Permite criação ilimitada de contas, DB pollution

### 2.4 — Credenciais demo hardcoded (ALTO)
- `App.tsx:442-443` — `demo@orkto.co` / `demo123456` visível no bundle JS
- Qualquer um que inspecionar o site consegue logar como demo

### 2.5 — Status quote modificado sem auth (ALTO)
- `GET /api/quote/public/:id` muda status de `draft`/`sent` para `viewed` (server.ts:169-171)
- Qualquer requisição a um link público altera o estado do orçamento

---

## Arquivos para modificar

- `server.ts` — middleware JWT + aplicar em todas as rotas
- `src/App.tsx` — remover auto-signup + remover demo hardcoded + enviar token Bearer
- `src/lib/supabaseClient.ts` — exportar função `getSessionToken()`

## Passos

### 1. Criar middleware `authenticate`

```typescript
// NOVO: src/lib/authMiddleware.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
  req.user = user;
  next();
}
```

### 2. Aplicar middleware em TODAS as rotas protegidas

| Rota | O que mudar |
|---|---|
| `GET /api/quotes/:userId` | Validar `req.params.userId === req.user.id` |
| `POST /api/quotes` | Usar `req.user.id` em vez de `body.userId` |
| `GET /api/quotes/detail/:quoteId` | Buscar quote, verificar `user_id === req.user.id` |
| `PUT /api/quotes/:quoteId` | Verificar ownership + allowlist de campos |
| `DELETE /api/quotes/:quoteId` | Verificar ownership |
| `GET /api/quote/next-number` | Usar `req.user.id` em vez de query param |
| `POST /api/asaas/checkout` | Usar `req.user.id` em vez de `body.userId` |
| `POST /api/asaas/generate-checkout` | Usar `req.user.id` em vez de `body.userId` |

**Rotas públicas (NÃO aplicar middleware):**
- `GET /api/quote/public/:id` (público)
- `POST /api/quote/:id/approve` (público — add rate limit)
- `POST /api/quote/:id/reject` (público — add rate limit)
- `POST /api/asaas/webhook` (público — usa verificação HMAC)

### 3. Fix mass assignment no PUT

```typescript
const ALLOWED_UPDATE_FIELDS = [
  'client_name', 'notes', 'items', 'valid_until',
  'status', 'template_style', 'discount', 'payment_conditions'
];
const updates: Record<string, any> = {};
for (const key of ALLOWED_UPDATE_FIELDS) {
  if (req.body[key] !== undefined) updates[key] = req.body[key];
}
// NUNCA permitir: user_id, id, created_at, created_by
```

### 4. Remover auto-signup (App.tsx ~469-483)

Substituir por:
```typescript
if (error) {
  setAuthError('Email ou senha inválidos. Verifique suas credenciais.');
  return;
}
```
Remover o bloco `supabase.auth.signUp()` no catch do login.

### 5. Remover demo credentials hardcoded (App.tsx ~442-443)

Criar botão "Entrar como Demo" que chama endpoint server-side com rate limit:
```typescript
const handleDemoLogin = async () => {
  const res = await fetch('/api/auth/demo-login', { method: 'POST' });
  const data = await res.json();
  if (data.token) {
    await supabase.auth.setSession(data.session);
  }
};
```

### 6. Remover side effect do GET público

Em `server.ts:169-171`, remover o `update({ status: 'viewed' })` do GET. Se precisar tracking, criar endpoint separado `POST /api/quote/:id/view` com rate limit.

## Atualização do client (App.tsx)

Toda chamada `fetch()` para `/api/*` precisa incluir o header:
```typescript
const token = (await supabase.auth.getSession()).data.session?.access_token;
fetch('/api/quotes/' + uid, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Critérios de sucesso

- `npx tsc --noEmit` passa sem erros
- `npx vite build` compila
- Requisição sem token → 401
- User A acessar `/api/quotes/USER_B_ID` → 401 ou 403
- PUT não permite alterar `user_id`, `id`, `created_at`
- Login com credenciais inválidas → erro (não cria conta)
- Demo credentials não estão hardcoded no bundle JS

## Rollback

```bash
git checkout -- server.ts src/App.tsx src/lib/authMiddleware.ts src/lib/supabaseClient.ts
```
