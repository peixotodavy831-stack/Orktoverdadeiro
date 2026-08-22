---
description: FASE 1 — Correções de RLS no Supabase, limpeza de secrets expostos (.env, localStorage, Asaas key no client) e geração de .env.example. Executar PRIMEIRO.
mode: subagent
permission:
  edit: allow
  read: allow
  bash: allow
---

# FASE 1 — Segurança: RLS + Secrets (executar primeiro)

## Por que esta é a Fase 1

Antes de implementar auth middleware, precisamos:
1. Corrigir as políticas RLS no banco (senão dados ficam expostos mesmo com auth)
2. Remover secrets do client-side (Asaas key em localStorage é risco imediato)
3. Desligar `NODE_TLS_REJECT_UNAUTHORIZED` (MITM em todas as chamadas HTTP)

## Contexto da Marca ORKTO

- **Tom:** Assertivo, urgente, premium-casual. Tudo em português brasileiro.
- **Público:** Autônomos e PMEs brasileiras que precisam de orçamentos rápidos.
- **Cores:** Primary `#FF9F1C`, background `#111111` (dark mode padrão).
- **Mensagem central:** "O orçamento antes da concorrência."

---

## Problemas a resolver

### 1.1 — Service Role Key exposta + RLS bypass
- `server.ts:16-19` usa `SUPABASE_SERVICE_ROLE_KEY` que bypassa RLS
- Nenhuma política DELETE na tabela `profiles`
- Função `increment_ai_usage` sem verificação de ownership
- View `public_quotes` sem documentação de segurança

### 1.2 — Secrets no client-side
- `asaasApiKey` trafega do banco → React state → localStorage (`App.tsx:134-138`)
- `UserProfile.asaasApiKey` visível em todo bundle React (`types.ts:64`)
- SettingsPage mostra a key em campo de senha (mas仍 visível no DOM)

### 1.3 — TLS desabilitado
- `.env:1` — `NODE_TLS_REJECT_UNAUTHORIZED="0"` aceita qualquer certificado TLS
- Todas as chamadas HTTPS (Supabase, Asaas) vulneráveis a MITM

### 1.4 — Google token em localStorage
- `firebaseAuth.ts:1,4,13` — token OAuth salvo em `localStorage.getItem('google_access_token')`

---

## Arquivos para modificar

- `server.ts` — criar cliente anon-key separado, remover service role de user-facing
- `src/App.tsx` — remover `asaasApiKey` do profile + localStorage sanitizado
- `src/types.ts` — remover `asaasApiKey` do `UserProfile`
- `src/components/SettingsPage.tsx` — mascarar campo Asaas key, salvar via servidor
- `src/lib/firebaseAuth.ts` — remover token persistence
- `.env` — remover `NODE_TLS_REJECT_UNAUTHORIZED`, mover pra `.env.local` se necessário
- `supabase-schema.sql` — adicionar DELETE policy, fix `increment_ai_usage`
- `supabase-migration.sql` — migration com as correções RLS

## Passos

### 1. Corrigir RLS no Supabase
- Adicionar `CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = id)`
- Substituir `increment_ai_usage` por versão com `SECURITY DEFINER SET search_path = public` + verificação `IF auth.uid() != user_id THEN RAISE EXCEPTION 'Not authorized'`
- Adicionar comentário na view `public_quotes` documentando que é acessada só via server API

### 2. Criar cliente Supabase anon-key no servidor
Em `server.ts`: criar um segundo cliente Supabase usando `VITE_SUPABASE_ANON_KEY` (em vez do service role) para queries de user-facing. Manter service role só para operações internas (webhooks).

### 3. Remover Asaas key do client
- `types.ts`: deletar `asaasApiKey?: string` do `UserProfile`
- `App.tsx:134`: remover `asaasApiKey: data.asaas_api_key || ''`
- `App.tsx:138,235`: antes de `localStorage.setItem`, sanitizar perfil (deletar `asaasApiKey`, `asaasCustomerId`)
- `SettingsPage.tsx:605-607`: substituir input do Asaas key por campo mascarado (mostrar só últimos 4 caracteres), salvar via server endpoint

### 4. Desligar TLS bypass
- `.env`: remover linha `NODE_TLS_REJECT_UNAUTHORIZED="0"`

### 5. Limpar firebaseAuth.ts
- Remover `localStorage.getItem('google_access_token')`
- Manter função como stub se Google Sheets/Gmail está desabilitado

### 6. Gerar .env.example
- Criar com placeholders, **sem nenhum secret real**

## Critérios de sucesso

- `npx tsc --noEmit` passa sem erros
- `npx vite build` compila
- `asaasApiKey` não aparece em nenhum arquivo `src/` (só em `server.ts`)
- `NODE_TLS_REJECT_UNAUTHORIZED` não está em `.env`
- `.env.example` existe e não contém secrets reais
- Perfil no localStorage não contém `asaasApiKey`

## Rollback

Se algo quebrar:
1. `git checkout -- server.ts src/App.tsx src/types.ts src/components/SettingsPage.tsx src/lib/firebaseAuth.ts .env supabase-schema.sql supabase-migration.sql`
2. Reverter migration no Supabase SQL Editor
