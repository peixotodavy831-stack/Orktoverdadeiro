import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up body parsing middleware before API routes
app.use(express.json({ limit: '10mb' }));

// Initialize Supabase client with service role key for server-side operations
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Shared Gemini client utility
// Note: We set the User-Agent to 'aistudio-build' in httpOptions for telemetry.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': "aistudio-build",
    }
  }
});

// Server-side API endpoint for adapting/enhancing quotes with AI
app.post("/api/gemini/adapt-quote", async (req, res) => {
  try {
    const { profession, tone, clientName, clientVehicleOrService, notes, items, paymentInstructions, userId } = req.body;

    if (!profession) {
      return res.status(400).json({ error: "O campo 'profissão' é obrigatório." });
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

    // Save quote to Supabase if configured and userId provided
    if (supabase && userId) {
      try {
        const quoteData = {
          user_id: userId,
          profession,
          tone: tone || 'comercial',
          client_name: clientName || 'Cliente',
          client_vehicle_or_service: clientVehicleOrService || '',
          notes: adaptedData.notes,
          payment_instructions: adaptedData.paymentInstructions,
          items: adaptedData.items,
          aesthetic_advice: adaptedData.aestheticAdvice,
          status: 'draft'
        };

        const { data, error } = await supabase
          .from('quotes')
          .insert([quoteData])
          .select();

        if (error) {
          console.error("Supabase save error:", error);
        } else {
          adaptedData.quoteId = data?.[0]?.id;
        }
      } catch (supabaseError) {
        console.error("Supabase integration error:", supabaseError);
        // Continue without saving to database
      }
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
