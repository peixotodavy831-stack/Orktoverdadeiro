# ORKTO

A **ORKTO** é uma plataforma AI-native de **operação comercial conversacional**.

O produto parte de conversas e contexto comercial para ajudar empresas a organizar informações, entender situações, preparar decisões e transformar essas decisões em ações dentro da operação.

A direção do produto pode ser resumida como:

**conversa → entendimento → decisão → ação → acompanhamento**

A ORKTO não é somente um criador de orçamentos. Propostas e orçamentos são uma das capacidades da plataforma dentro de um fluxo comercial mais amplo.

## WIA

A **WIA** é a camada operacional inteligente integrada à ORKTO.

Ela não é tratada como um chatbot separado do produto. Sua função é trabalhar sobre o contexto e os dados disponíveis na própria ORKTO para ajudar o usuário a compreender situações comerciais e preparar próximos passos.

No estágio atual, a WIA opera em modelo **suggestion-first**: ela pode analisar contexto e gerar sugestões, mas ações sensíveis ou externas não devem ser consideradas autônomas.

A arquitetura da ORKTO também é **channel-agnostic**. O WhatsApp é um canal importante planejado para a operação comercial, mas o produto não deve depender estruturalmente de um único canal.

## O que existe hoje

A base atual da ORKTO inclui:

* autenticação e perfil de usuário;
* perfil e identidade da empresa;
* gestão de clientes;
* catálogo de produtos e serviços;
* criação e gestão de propostas;
* links públicos para propostas;
* acompanhamento de visualização e resposta de propostas;
* checkout e pagamentos com Asaas;
* e-mail transacional;
* dashboard e analytics básicos;
* interface inicial da WIA;
* WIA em modo suggestion-first;
* abstração inicial de provider de IA.

Essas capacidades formam a base sobre a qual a operação comercial AI-native está sendo construída.

## Em evolução

A arquitetura está sendo preparada progressivamente para suportar capacidades como:

* estado comercial unificado;
* ferramentas determinísticas operadas pela WIA;
* oportunidades, tarefas e follow-ups integrados;
* sistema de aprovações;
* automações comerciais;
* integração oficial com canais como WhatsApp Business;
* AI Router;
* Cost Governor;
* uso de múltiplos providers de IA;
* limites e governança por plano;
* multi-tenant, memberships e RBAC;
* maior observabilidade de ações, custo e resultados.

Esses itens fazem parte da evolução planejada e **não devem ser interpretados como funcionalidades já disponíveis em produção**.

## Princípios da arquitetura

A evolução da ORKTO segue alguns princípios centrais:

* IA integrada ao produto, não adicionada como uma camada isolada;
* regras críticas e cálculos permanecem determinísticos;
* dados estruturados e ferramentas devem ser usados antes de recorrer a LLMs;
* ações sensíveis devem respeitar permissões, políticas e aprovações;
* nenhuma integração externa deve ignorar autenticação ou contexto de tenant;
* providers de IA devem permanecer abstraídos para reduzir lock-in;
* a arquitetura deve continuar simples antes de adicionar distribuição ou complexidade desnecessária.

## Stack atual

A aplicação utiliza atualmente:

* **React 19**
* **Vite**
* **TypeScript**
* **Tailwind CSS**
* **Express**
* **Supabase / PostgreSQL**
* **Vercel**
* **Asaas**
* **Resend**

## Requisitos

- Node.js 22 ou superior
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

O endpoint `GET /api/health` deve responder com:

```json
{"status":"ok","service":"orkto"}
```

## Produção

O projeto está preparado para Railway e continua compatível com Vercel.

- Build: `npm run build`
- Start: `npm start`
- Healthcheck: `/api/health`

Cadastre as variáveis descritas em `.env.example` no painel do provedor.

Nunca envie arquivos `.env`, tokens ou chaves reais ao GitHub.

As migrações oficiais ficam em `supabase/migrations/` e devem ser executadas em ordem cronológica.

Consulte `docs/CHECKLIST-DEPLOY.md` para configuração e validação de produção.

Para conectar um domínio próprio, configurar os buscadores e seguir o plano de divulgação, consulte `docs/DOMINIO-E-SEO.md`.

O calendário editorial, os roteiros de vídeos sem rosto e as metas para buscar 1.000 cadastros orgânicos estão em `docs/PLANO-ORGANICO-20-SEMANAS.md`.

## Direção do produto

A ORKTO está evoluindo de um fluxo historicamente centrado em propostas para uma plataforma em que conversas e eventos alimentam um estado comercial estruturado.

A visão de longo prazo é permitir que o usuário opere seu processo comercial de duas formas complementares:

* pela interface visual tradicional da ORKTO;
* pela WIA, usando linguagem natural e contexto.

As duas interfaces devem operar sobre os mesmos dados, regras, permissões e ações.

A meta não é substituir toda interação por conversa com IA.

Quando um clique simples for melhor, a interface deve continuar simples.

Quando a WIA conseguir compreender contexto e reduzir trabalho operacional, ela deve atuar como parte nativa da experiência.
