# ORKTO

Plataforma SaaS para criar, enviar e acompanhar orçamentos profissionais. O frontend é React/Vite, a API é Express e os dados e a autenticação ficam no Supabase.

## Requisitos

- Node.js 20 ou superior
- Projeto Supabase configurado
- Credenciais do Resend para e-mails
- Credenciais do Asaas para pagamentos (opcional em desenvolvimento)

## Desenvolvimento local

1. Copie `.env.example` para `.env` e preencha as variáveis.
2. Instale as dependências com `npm install`.
3. Execute `npm run dev`.
4. Abra `http://localhost:3000`.

## Verificação

```bash
npm run lint
npm run build
npm start
```

O endpoint `GET /api/health` deve responder com `{"status":"ok","service":"orkto"}`.

## Produção

O projeto está preparado para Railway e continua compatível com Vercel.

- Build: `npm run build`
- Start: `npm start`
- Healthcheck: `/api/health`

Cadastre as variáveis descritas em `.env.example` no painel do provedor. Nunca envie arquivos `.env` ou chaves reais ao GitHub.

As migrações oficiais ficam em `supabase/migrations/` e devem ser executadas em ordem cronológica.

Consulte `docs/CHECKLIST-DEPLOY.md` para configuração e validação de produção.
