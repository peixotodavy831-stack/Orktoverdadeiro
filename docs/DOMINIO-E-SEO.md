# Domínio próprio e SEO da ORKTO

## Domínio recomendado

- Brasil: `orkto.com.br`, comprado diretamente no Registro.br.
- Internacional: `orkto.com`, preferencialmente no Cloudflare Registrar pelo custo de renovação sem margem.
- Antes do pagamento, confirme disponibilidade e conflitos de marca. Domínios são registrados por ano; “um mês grátis” normalmente é de e-mail ou hospedagem.

## Onde colocar a URL

Use a mesma URL pública, com `https://` e sem barra no final, nestes pontos:

1. **Railway → serviço ORKTO → Settings → Networking → Custom Domain**: adicione o domínio e copie o registro DNS fornecido para o registrador.
2. **Railway → Variables**: defina `APP_URL` e `PUBLIC_SITE_URL`; inclua a origem em `ALLOWED_ORIGINS`.
3. **Supabase → Authentication → URL Configuration**: altere `Site URL` e adicione `https://dominio/**` em `Redirect URLs`.
4. **Google Cloud → APIs e serviços → Credenciais → cliente OAuth**: adicione a URL em “Origens JavaScript autorizadas”. O redirecionamento continua sendo o callback do Supabase.
5. **Asaas**: use `https://dominio/api/webhooks/asaas` como URL do webhook.
6. **Resend**: valide o domínio de envio e publique os registros SPF/DKIM fornecidos.
7. **Google Search Console**: crie uma propriedade de domínio, valide por DNS e envie `https://dominio/sitemap.xml`.

O build substitui automaticamente a URL provisória nos metadados, sitemap, robots.txt, llms.txt e páginas públicas quando `PUBLIC_SITE_URL` ou `APP_URL` estiver configurada.

## Palavras-chave prioritárias

- sistema de orçamento online
- criar orçamento online
- orçamento pelo WhatsApp
- orçamento para MEI
- orçamento para autônomo
- proposta comercial online
- aplicativo de orçamento
- orçamento para prestador de serviço

## Plano de divulgação de 90 dias

1. **Semana 1:** Search Console, Bing Webmaster Tools, sitemap e perfis oficiais com a mesma identidade.
2. **Semanas 2–4:** duas demonstrações curtas por semana mostrando criação, envio, aprovação e acompanhamento.
3. **Mês 2:** convidar 10 prestadores por segmento, coletar depoimentos autorizados e transformar dúvidas reais em páginas úteis.
4. **Mês 3:** parcerias com contadores, consultores de MEI, associações e criadores pequenos, usando links rastreáveis.
5. **Contínuo:** responder dúvidas sem spam, medir cadastros por canal e repetir apenas o que gerar usuários ativos.

Não compre seguidores nem links. Autoridade vem de conteúdo útil, menções reais, avaliações e páginas que resolvem a dúvida pesquisada.
