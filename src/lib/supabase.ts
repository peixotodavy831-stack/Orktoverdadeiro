import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase environment variables not configured");
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

// Types for Orkto data
export interface OrktoQuote {
  id: string;
  user_id: string;
  profession: string;
  tone: string;
  client_name: string;
  client_vehicle_or_service: string;
  notes: string;
  payment_instructions: string;
  items: QuoteItem[];
  aesthetic_advice: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "sent" | "accepted" | "rejected";
}

export interface QuoteItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

// Database functions
export const supabaseQuotes = {
  // Save a new quote
  async save(quote: Omit<OrktoQuote, "id" | "created_at" | "updated_at">) {
    const { data, error } = await supabase.from("quotes").insert([quote]).select();
    if (error) throw error;
    return data?.[0];
  },

  // Get quote by ID
  async getById(id: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select()
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  // Get all quotes for a user
  async getByUser(userId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select()
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  // Update a quote
  async update(id: string, updates: Partial<OrktoQuote>) {
    const { data, error } = await supabase
      .from("quotes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select();
    if (error) throw error;
    return data?.[0];
  },

  // Delete a quote
  async delete(id: string) {
    const { error } = await supabase.from("quotes").delete().eq("id", id);
    if (error) throw error;
  },
};
