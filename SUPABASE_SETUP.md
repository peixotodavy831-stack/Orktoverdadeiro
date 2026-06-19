# Configuração Supabase para Orkto

## Passos para configurar o Supabase

### 1. Criar um projeto Supabase
- Acesse [supabase.com](https://supabase.com)
- Clique em "New Project"
- Preencha os dados do projeto
- Aguarde a inicialização do projeto

### 2. Obter as credenciais
No painel do Supabase, vá para **Settings > API** e copie:
- `Project URL` → `VITE_SUPABASE_URL`
- `anon public` key → `VITE_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Criar a tabela de quotes
No SQL Editor do Supabase, execute:

```sql
-- Create quotes table
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  profession TEXT NOT NULL,
  tone TEXT DEFAULT 'comercial',
  client_name TEXT,
  client_vehicle_or_service TEXT,
  notes TEXT,
  payment_instructions TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  aesthetic_advice TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_created_at ON quotes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see only their own quotes
CREATE POLICY "Users can view their own quotes"
  ON quotes FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own quotes"
  ON quotes FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own quotes"
  ON quotes FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own quotes"
  ON quotes FOR DELETE
  USING (auth.uid()::text = user_id);
```

### 4. Adicionar as variáveis de ambiente
Crie um arquivo `.env.local` (não faça commit deste arquivo):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Instalar dependências
```bash
npm install
```

### 6. Testar a integração
Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## Endpoints disponíveis

### Adaptar orçamento com IA (com salvamento automático)
```
POST /api/gemini/adapt-quote
Body: {
  profession: string,
  tone: string,
  clientName: string,
  clientVehicleOrService: string,
  notes: string,
  items: array,
  paymentInstructions: string,
  userId: string (opcional, para salvar no banco)
}
```

### Listar orçamentos do usuário
```
GET /api/quotes/:userId
```

### Obter detalhes de um orçamento
```
GET /api/quotes/detail/:quoteId
```

### Atualizar orçamento
```
PUT /api/quotes/:quoteId
Body: { campos a atualizar }
```

### Deletar orçamento
```
DELETE /api/quotes/:quoteId
```

## Usando Supabase no frontend

```typescript
import { supabase, supabaseQuotes } from './lib/supabase';

// Obter orçamentos do usuário
const quotes = await supabaseQuotes.getByUser(userId);

// Salvar novo orçamento
const newQuote = await supabaseQuotes.save({
  user_id: userId,
  profession: 'Advogado',
  tone: 'formal',
  // ... mais campos
});

// Atualizar status
await supabaseQuotes.update(quoteId, { status: 'sent' });
```

## Monitoramento e Debugging

No painel Supabase:
- **Realtime**: Veja as mudanças em tempo real
- **SQL Editor**: Execute queries customizadas
- **Auth**: Gerencie autenticação
- **Storage**: Para futuras adições de arquivos/imagens

## Segurança

- Nunca faça commit do arquivo `.env.local` com as credenciais
- Use `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor
- Use `VITE_SUPABASE_ANON_KEY` no frontend (com segurança via RLS)
- As políticas de Row Level Security (RLS) garantem que usuários acessem apenas seus dados
