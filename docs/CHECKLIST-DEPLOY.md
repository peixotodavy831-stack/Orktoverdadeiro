# ORKTO — Checklist de Deploy (um comando só)

## Pré-requisitos (fazer uma vez)

### 1. Supabase — rodar migrations
No [SQL Editor do Supabase](https://supabase.com/dashboard/project/_/sql):

```sql
-- 1) Schema base
-- Cole o conteúdo de supabase-schema.sql

-- 2) Propostas (links compartilháveis)
-- Cole o conteúdo de supabase/migrations/20260822_proposals.sql
```

### 2. Criar conta Asaas (produção)
1. Acesse https://www.asaas.com → Criar conta (CNPJ ou CPF)
2. Complete KYC e aguarde aprovação
3. Gere API Key de **produção**: Asaas → Minha Conta → Integrações → API
4. Copie o `ASAAS_API_KEY` e `ASAAS_WALLET_ID`

### 3. Configurar domínio
1. Compre domínio (ex: `orkto.com`) no Registro.br / Namecheap / GoDaddy
2. Na Vercel: Settings → Domains → Add → `orkto.com`
3. Aponte DNS conforme instruções da Vercel
4. Aguarde SSL automático

---

## Deploy — um comando

### Preparar env vars na Vercel
Vercel → Settings → Environment Variables → adicione:

| Key | Valor | Env |
|-----|-------|-----|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | All |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | All |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | All |
| `APP_URL` | `https://orkto.com` | Production |
| `ASAAS_ENVIRONMENT` | `production` | Production |
| `ASAAS_ENVIRONMENT` | `sandbox` | Preview |
| `ASAAS_API_KEY` | `$aact_...` (produção) | Production |
| `ASAAS_API_KEY` | `$aact_...` (sandbox) | Preview |
| `ASAAS_WALLET_ID` | `...` | All |
| `ASAAS_WEBHOOK_SECRET` | `...` | Production |
| `RESEND_API_KEY` | `re_...` | All |
| `RESEND_FROM` | `ORKTO <noreply@orkto.com>` | All |

### Configurar webhook Asaas
Asaas → Integrações → Webhooks → Adicionar:
- URL: `https://orkto.com/api/asaas/webhook`
- Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_CANCELED`
- Copie o secret para `ASAAS_WEBHOOK_SECRET`

### Subir para produção
```powershell
# Na pasta Orktoverdeiro
git push origin main

# Ou via Vercel CLI
vercel --prod
```

A Vercel faz deploy automático a cada push na `main`.

---

## Pós-deploy — testar em produção

Checklist manual (fazer uma vez após deploy):

- [ ] Landing page carrega em `https://orkto.com`
- [ ] Criar conta (signup) → confirmar email → login
- [ ] Criar orçamento → preencher itens → salvar
- [ ] Clicar "Gerar Link da Proposta" → copiar link `/p/XXXXXXXX`
- [ ] Abrir link em aba anônima (sem login) → proposta aparece
- [ ] Timer de 30 min visível no cliente
- [ ] Cliente aprova (digita nome) → status muda
- [ ] Email de confirmação chega no cliente
- [ ] Email de notificação chega no dono
- [ ] Cliente clica "Pagar com PIX" → QR Code aparece
- [ ] Pagar PIX real → webhook atualiza status → email de pagamento
- [ ] Testar em celular (responsivo)
- [ ] Verificar Sentry (erros), Resend (emails), Supabase (dados)
- [ ] Testar limite de plano (5 propostas no free)

---

## Rollback

```powershell
# Vercel → Deployments → selecionar deploy anterior → Promote to Production
```

Ou:

```powershell
git revert HEAD
git push origin main
```

---

## Local: rodar tudo antes de subir

```powershell
cd Orktoverdeiro
npm install          # se node_modules foi apagado
npm run build        # vite build + esbuild server
npm run lint         # tsc --noEmit (pode ter warnings)
npm run dev          # testar local em http://localhost:5173
```
