import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Phone, 
  History, 
  UserPlus, 
  Car, 
  FileText, 
  TrendingUp,
  Mail,
  ChevronRight,
  Plus,
  ArrowRight,
  MoreVertical,
  X,
  Download,
  Briefcase,
  Trash2,
  Pencil,
  Upload,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { SavedClient, Quote, Timestamp } from '../types';
import { formatBRL, formatPhone } from '../utils/format';
import WiaInline from './wia/WiaInline';
import { supabase } from '../lib/supabase';
import { parseCsv } from '../utils/csv-import';

const OPTIONAL_CUSTOMER_OPERATIONS_ENABLED = import.meta.env.VITE_ENABLE_ADVANCED_CUSTOMER_OPERATIONS === 'true';

interface ClientsPageProps {
  clients: SavedClient[];
  quotes: Quote[];
  userId: string;
  onClientAdded: (client: SavedClient) => Promise<void> | void;
  onClientUpdated?: (client: SavedClient) => Promise<void> | void;
  onClientDeleted?: (clientId: string) => Promise<void> | void;
  onSelectQuote: (quoteId: string) => void;
  onClientsImported?: () => Promise<void> | void;
  initialClientId?: string | null;
  onInitialClientOpened?: () => void;
  initialCreate?: boolean;
  onInitialCreateOpened?: () => void;
}

interface ClientIntelligence {
  mood: { state: 'ENGAGED' | 'NEUTRAL' | 'STUCK' | 'LOYAL'; explanation: string; signals: string[] };
  operationalSignals: { score: number; signals: string[] };
  risk: { score: number; confidence: number; reasons: string[]; recommended_action: string } | null;
  note: string;
}

interface ImportPreviewRow {
  rowNumber: number;
  status: 'valid' | 'duplicate' | 'error';
  normalized: Record<string, unknown>;
  errors: string[];
  duplicateMatches: Array<{ clientId: string | null; rowNumber?: number | null; name: string; status: 'MATCH' | 'POSSIBLE_MATCH'; score: number; signals: string[] }>;
}

interface ClientImportPreview {
  job: { id: string; status: string };
  rows: ImportPreviewRow[];
}

type ImportEntityType = 'customers' | 'contacts' | 'proposals' | 'commercial_records';
const importFields: Record<ImportEntityType, Array<[string,string,string[]]>> = {
  customers:[['name','Nome do cliente *',['nome','name','cliente']],['phone','Telefone *',['telefone','celular','whatsapp','phone']],['company','Empresa',['empresa','company']],['vehicleOrService','Serviço / projeto',['servico','projeto','veiculo','vehicle']],['notes','Notas',['observacao','anotacao','notes','notas']]],
  contacts:[['fullName','Nome do contato *',['nome','name','contato']],['phone','Telefone',['telefone','celular','whatsapp','phone']],['email','E-mail',['email','e-mail']],['company','Empresa',['empresa','company']],['role','Cargo',['cargo','funcao','role']],['customerRef','ID ou telefone do cliente',['cliente','customer','customerref']]],
  proposals:[['customerRef','ID ou telefone do cliente *',['cliente','customer','customerref','telefone']],['dealRef','ID do negócio',['negocio','deal','dealref']],['items','Itens JSON (catalogItemId + quantity) *',['itens','items','produtos']],['quoteNumber','Número da proposta',['numero','proposta','quote']],['validDays','Validade em dias',['validade','validdays']],['notes','Notas',['observacao','notas','notes']]],
  commercial_records:[['title','Título do negócio *',['titulo','negocio','deal','title']],['customerRef','ID ou telefone do cliente *',['cliente','customer','customerref','telefone']],['stage','Estágio *',['estagio','stage']],['valueCents','Valor em centavos *',['valorcentavos','valuecents','centavos']],['ownerUserId','ID do responsável',['responsavel','owner','owneruserid']],['conversationRef','ID da conversa',['conversa','conversation']],['description','Descrição',['descricao','description']],['externalRef','Referência externa',['referencia','externalref','external_id']]],
};

function suggestImportMapping(entityType:ImportEntityType,headers:string[]) {
  return Object.fromEntries(importFields[entityType].map(([target,,aliases])=>[target,headers.find(header=>{
    const normalized=header.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return aliases.some(alias=>normalized.includes(alias));
  }) || '']));
}

interface CustomerMemory {
  id: string;
  memory_type: 'raw_event' | 'fact' | 'preference' | 'summary' | 'commercial_pattern' | 'inference';
  content: Record<string, unknown>;
  provenance: { source?: string; sourceRef?: string; correction_reason?: string };
  confidence: number | null;
  expires_at: string | null;
  created_at: string;
}

interface RepurchaseView {
  data: { eligible: boolean; estimatedAt: string | null; confidence: number; intervalDays: number | null; reason: string };
  jobs: Array<{ id: string; step_key: string; due_at: string; status: string }>;
}

interface ContactRecord {
  id: string;
  customer_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
}

export default function ClientsPage({ 
  clients, 
  quotes, 
  userId, 
  onClientAdded,
  onClientUpdated,
  onClientDeleted,
  onSelectQuote,
  onClientsImported,
  initialClientId,
  onInitialClientOpened,
  initialCreate,
  onInitialCreateOpened,
}: ClientsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedClientHistory, setSelectedClientHistory] = useState<SavedClient | null>(null);

  // Form states (Add Client)
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [writeError, setWriteError] = useState('');

  // Form states (Edit Client)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editVehicle, setEditVehicle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [clientIntelligence, setClientIntelligence] = useState<ClientIntelligence | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [intelligenceError, setIntelligenceError] = useState('');
  const [intelligenceNotice, setIntelligenceNotice] = useState('');
  const [intelligenceRefresh, setIntelligenceRefresh] = useState(0);
  const [customerMemories, setCustomerMemories] = useState<CustomerMemory[]>([]);
  const [repurchaseView, setRepurchaseView] = useState<RepurchaseView | null>(null);
  const [customerContextLoading, setCustomerContextLoading] = useState(false);
  const [customerContextSaving, setCustomerContextSaving] = useState(false);
  const [customerContextError, setCustomerContextError] = useState('');
  const [customerContextNotice, setCustomerContextNotice] = useState('');
  const [customerContextRefresh, setCustomerContextRefresh] = useState(0);
  const [memoryType, setMemoryType] = useState<'fact' | 'preference' | 'summary' | 'commercial_pattern'>('preference');
  const [memoryText, setMemoryText] = useState('');
  const [purchaseProductName, setPurchaseProductName] = useState('');
  const [purchaseProductRef, setPurchaseProductRef] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importEntityType,setImportEntityType]=useState<ImportEntityType>('customers');
  const [importFileName, setImportFileName] = useState('');
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importPreview, setImportPreview] = useState<ClientImportPreview | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [importCompleted, setImportCompleted] = useState(false);
  const [importRolledBack, setImportRolledBack] = useState(false);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactError, setContactError] = useState('');
  const [contactEditingId, setContactEditingId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactSaving, setContactSaving] = useState(false);
  const [contactRefresh, setContactRefresh] = useState(0);

  const suggestColumn = (headers: string[], aliases: string[]) => headers.find(header => {
    const normalized = header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return aliases.some(alias => normalized.includes(alias));
  }) || '';

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setImportError(''); setImportNotice(''); setImportPreview(null); setImportCompleted(false); setImportRolledBack(false);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('O limite é 5 MB por arquivo CSV.');
      const parsed = parseCsv(await file.text());
      setImportFileName(file.name);
      setImportHeaders(parsed.headers);
      setImportRows(parsed.rows);
      setImportMapping(suggestImportMapping(importEntityType,parsed.headers));
    } catch (cause) {
      setImportFileName(file.name); setImportHeaders([]); setImportRows([]);
      setImportError(cause instanceof Error ? cause.message : 'Não foi possível ler esse CSV.');
    }
  };

  const requestImport = async (path: string, body?: Record<string, unknown>, method = 'POST') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente para importar clientes.');
    const response = await fetch(path, { method, headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'A operação de importação falhou.');
    return payload;
  };

  const previewImport = async () => {
    const required=importEntityType==='customers' ? ['name','phone'] : importEntityType==='contacts' ? ['fullName'] : importEntityType==='proposals' ? ['customerRef','items'] : ['title','customerRef','stage','valueCents'];
    if(required.some(field=>!importMapping[field]) || (importEntityType==='contacts'&&!importMapping.phone&&!importMapping.email)) { setImportError('Mapeie todos os campos obrigatórios antes de gerar a prévia.'); return; }
    setImportLoading(true); setImportError(''); setImportNotice('');
    try {
      const payload = await requestImport('/api/imports/preview', { source: `csv:${importFileName}`, entityType:importEntityType, rows: importRows, mapping: importMapping });
      setImportPreview(payload.data as ClientImportPreview);
      setImportNotice('Prévia concluída. Possíveis duplicados e linhas inválidas ficarão fora da gravação.');
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : 'Não foi possível validar o arquivo.'); }
    finally { setImportLoading(false); }
  };

  const commitImport = async () => {
    if (!importPreview?.job?.id) return;
    const validCount = importPreview.rows.filter(row => row.status === 'valid').length;
    if (!validCount || !window.confirm(`Importar ${validCount} cliente(s) válido(s)? Duplicados e linhas com erro não serão gravados.`)) return;
    setImportLoading(true); setImportError(''); setImportNotice('');
    try {
      const payload = await requestImport(`/api/imports/${encodeURIComponent(importPreview.job.id)}/commit`);
      setImportCompleted(true);
      setImportNotice(`${payload.imported} registro(s) importado(s). A importação ficou registrada e pode ser compensada sem remover alterações posteriores.`);
      try { await onClientsImported?.(); }
      catch { setImportError('A importação foi gravada, mas não foi possível atualizar a lista agora. Atualize a página para carregar os clientes.'); }
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : 'A gravação falhou.'); }
    finally { setImportLoading(false); }
  };

  const rollbackImport = async () => {
    if (!importPreview?.job?.id || !window.confirm('Compensar somente registros importados que ainda não foram alterados? Propostas e negócios serão arquivados para preservar histórico.')) return;
    setImportLoading(true); setImportError(''); setImportNotice('');
    try {
      const payload = await requestImport(`/api/imports/${encodeURIComponent(importPreview.job.id)}/rollback`);
      setImportNotice(`${payload.removed} registro(s) compensado(s). ${payload.conflicts?.length ? `${payload.conflicts.length} registro(s) foram preservados porque mudaram ou já têm uso comercial.` : 'Nenhum conflito encontrado.'}`);
      setImportRolledBack(true);
      try { await onClientsImported?.(); }
      catch { setImportError('A compensação foi processada, mas não foi possível atualizar a lista agora. Atualize a página para carregar os dados atuais.'); }
    } catch (cause) { setImportError(cause instanceof Error ? cause.message : 'Não foi possível compensar a importação.'); }
    finally { setImportLoading(false); }
  };

  const closeImport = () => {
    if (importLoading) return;
    setIsImportOpen(false); setImportFileName(''); setImportHeaders([]); setImportRows([]); setImportMapping({}); setImportPreview(null); setImportError(''); setImportNotice(''); setImportCompleted(false); setImportRolledBack(false);
  };

  useEffect(() => {
    const clientId = selectedClientHistory?.id;
    if (!clientId) { setClientIntelligence(null); setIntelligenceError(''); return; }
    let active = true;
    setIntelligenceLoading(true); setIntelligenceError('');
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Entre novamente para consultar os sinais comerciais.');
        const response = await fetch(`/api/customers/${encodeURIComponent(clientId)}/mood`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível recuperar os sinais comerciais.');
        if (active) setClientIntelligence(payload);
      } catch (cause) {
        if (active) setIntelligenceError(cause instanceof Error ? cause.message : 'Não foi possível recuperar os sinais comerciais.');
      } finally { if (active) setIntelligenceLoading(false); }
    })();
    return () => { active = false; };
  }, [selectedClientHistory?.id, intelligenceRefresh]);

  useEffect(() => {
    const customerId = selectedClientHistory?.id;
    if (!customerId) { setContacts([]); setContactError(''); return; }
    let active = true;
    setContactsLoading(true); setContactError('');
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Entre novamente para consultar os contatos.');
        const response = await fetch(`/api/contacts?customerId=${encodeURIComponent(customerId)}`, {
          headers:{ Authorization:`Bearer ${session.access_token}` },
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os contatos.');
        if (active) setContacts(payload?.data || []);
      } catch (cause) {
        if (active) setContactError(cause instanceof Error ? cause.message : 'Não foi possível carregar os contatos.');
      } finally { if (active) setContactsLoading(false); }
    })();
    return () => { active=false; };
  }, [selectedClientHistory?.id,contactRefresh]);

  const resetContactForm = () => {
    setContactEditingId(null); setContactName(''); setContactPhone(''); setContactEmail(''); setContactRole('');
  };

  const saveContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClientHistory || !contactName.trim() || (!contactPhone.trim() && !contactEmail.trim())) return;
    setContactSaving(true); setContactError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Entre novamente para salvar o contato.');
      const response = await fetch(contactEditingId ? `/api/contacts/${encodeURIComponent(contactEditingId)}` : '/api/contacts', {
        method:contactEditingId ? 'PATCH' : 'POST',
        headers:{ Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json','x-idempotency-key':crypto.randomUUID() },
        body:JSON.stringify({fullName:contactName.trim(),phone:contactPhone.trim() || null,email:contactEmail.trim() || null,
          role:contactRole.trim() || null,customerId:selectedClientHistory.id}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar o contato.');
      resetContactForm(); setContactRefresh(value=>value+1);
    } catch (cause) { setContactError(cause instanceof Error ? cause.message : 'Não foi possível salvar o contato.'); }
    finally { setContactSaving(false); }
  };

  useEffect(() => {
    const customerId = selectedClientHistory?.id;
    if (!customerId) { setCustomerMemories([]); setRepurchaseView(null); setCustomerContextError(''); return; }
    let active = true;
    setCustomerContextLoading(true); setCustomerContextError('');
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Entre novamente para consultar a memória e a recompra.');
        const headers = { Authorization: `Bearer ${session.access_token}` };
        const [memoryResponse, repurchaseResponse] = await Promise.all([
          fetch(`/api/customers/${encodeURIComponent(customerId)}/memories`, { headers }),
          fetch(`/api/customers/${encodeURIComponent(customerId)}/repurchase`, { headers }),
        ]);
        const [memoryPayload, repurchasePayload] = await Promise.all([memoryResponse.json().catch(() => null), repurchaseResponse.json().catch(() => null)]);
        if (!memoryResponse.ok) throw new Error(memoryPayload?.error || 'Não foi possível carregar as memórias deste cliente.');
        if (!repurchaseResponse.ok) throw new Error(repurchasePayload?.error || 'Não foi possível consultar o ciclo de recompra.');
        if (!active) return;
        setCustomerMemories(memoryPayload.data || []);
        setRepurchaseView({ data:repurchasePayload.data, jobs:repurchasePayload.jobs || [] });
      } catch (cause) {
        if (active) setCustomerContextError(cause instanceof Error ? cause.message : 'Não foi possível carregar o contexto comercial.');
      } finally { if (active) setCustomerContextLoading(false); }
    })();
    return () => { active = false; };
  }, [selectedClientHistory?.id, customerContextRefresh]);

  const saveCustomerMemory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClientHistory || !memoryText.trim()) return;
    setCustomerContextSaving(true); setCustomerContextError(''); setCustomerContextNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Entre novamente para registrar a memória.');
      const response = await fetch('/api/memories', { method:'POST', headers:{ Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ type:memoryType, entityType:'customer', entityRef:selectedClientHistory.id, content:{ note:memoryText.trim() }, provenance:{ source:'operator_confirmed', sourceRef:selectedClientHistory.id }, confidence:1, explicitlyConfirmed:true }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar a memória.');
      setMemoryText(''); setCustomerContextNotice('Memória registrada com origem e confirmação humana.'); setCustomerMemories(current => [payload.data, ...current]);
    } catch (cause) { setCustomerContextError(cause instanceof Error ? cause.message : 'Não foi possível salvar a memória.'); }
    finally { setCustomerContextSaving(false); }
  };

  const correctCustomerMemory = async (memory: CustomerMemory) => {
    if (!selectedClientHistory || memory.memory_type === 'raw_event') return;
    const correction = window.prompt('Qual é a informação corrigida?');
    if (!correction?.trim()) return;
    setCustomerContextSaving(true); setCustomerContextError(''); setCustomerContextNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Entre novamente para corrigir a memória.');
      const response = await fetch(`/api/memories/${encodeURIComponent(memory.id)}/correct`, { method:'POST', headers:{ Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ content:{ note:correction.trim() }, provenance:{ source:'operator_correction', sourceRef:selectedClientHistory.id }, confidence:1, reason:'Correção confirmada pelo operador' }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível corrigir a memória.');
      setCustomerContextNotice('Correção salva como nova versão; a anterior foi preservada como superseded.'); setCustomerContextRefresh(value => value + 1);
    } catch (cause) { setCustomerContextError(cause instanceof Error ? cause.message : 'Não foi possível corrigir a memória.'); }
    finally { setCustomerContextSaving(false); }
  };

  const recordCustomerPurchase = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedClientHistory) return;
    setCustomerContextSaving(true); setCustomerContextError(''); setCustomerContextNotice('');
    try {
      const amountCents = Math.round(Number(purchaseAmount.replace(',', '.')) * 100);
      if (!Number.isFinite(amountCents) || amountCents < 0 || !purchaseProductName.trim()) throw new Error('Informe o produto/serviço e um valor válido.');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Entre novamente para registrar a compra.');
      const response = await fetch('/api/purchases', { method:'POST', headers:{ Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ customerRef:selectedClientHistory.id, productRef:purchaseProductRef.trim() || undefined, productName:purchaseProductName.trim(), quantity:1, amountCents, purchasedAt:new Date(`${purchaseDate}T12:00:00`).toISOString(), source:'operator_recorded', idempotencyKey:crypto.randomUUID() }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível registrar a compra.');
      setPurchaseProductName(''); setPurchaseProductRef(''); setPurchaseAmount(''); setCustomerContextNotice('Compra registrada no histórico do workspace; o ciclo será recalculado com os dados disponíveis.'); setCustomerContextRefresh(value => value + 1);
    } catch (cause) { setCustomerContextError(cause instanceof Error ? cause.message : 'Não foi possível registrar a compra.'); }
    finally { setCustomerContextSaving(false); }
  };

  const scheduleCustomerRepurchase = async () => {
    if (!selectedClientHistory || !repurchaseView?.data.eligible) return;
    setCustomerContextSaving(true); setCustomerContextError(''); setCustomerContextNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Entre novamente para programar a recompra.');
      const response = await fetch(`/api/automations/repurchase/${encodeURIComponent(selectedClientHistory.id)}/schedule`, { method:'POST', headers:{ Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({ confirm:true }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível programar a recompra.');
      setCustomerContextNotice('Programação salva para revisão humana. Nenhum contato foi enviado.'); setCustomerContextRefresh(value => value + 1);
    } catch (cause) { setCustomerContextError(cause instanceof Error ? cause.message : 'Não foi possível programar a recompra.'); }
    finally { setCustomerContextSaving(false); }
  };

  const cancelCustomerRepurchase = async () => {
    if (!selectedClientHistory || !window.confirm('Cancelar programações pendentes e rascunhos de recompra deste cliente?')) return;
    setCustomerContextSaving(true); setCustomerContextError(''); setCustomerContextNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Entre novamente para cancelar a recompra.');
      const response = await fetch(`/api/automations/repurchase/${encodeURIComponent(selectedClientHistory.id)}/cancel`, { method:'POST', headers:{ Authorization:`Bearer ${session.access_token}`, 'Content-Type':'application/json' }, body:JSON.stringify({}) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível cancelar a recompra.');
      setCustomerContextNotice(`Programações canceladas: ${payload.cancelled || 0}; rascunhos pendentes cancelados: ${payload.cancelledActions || 0}.`); setCustomerContextRefresh(value => value + 1);
    } catch (cause) { setCustomerContextError(cause instanceof Error ? cause.message : 'Não foi possível cancelar a recompra.'); }
    finally { setCustomerContextSaving(false); }
  };

  const assessClientRisk = async () => {
    if (!selectedClientHistory) return;
    setIntelligenceLoading(true); setIntelligenceError(''); setIntelligenceNotice('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Entre novamente para avaliar o risco.');
      const response = await fetch(`/api/customers/${encodeURIComponent(selectedClientHistory.id)}/risk/assess`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível avaliar o risco.');
      setIntelligenceNotice('Avaliação registrada. Nenhuma decisão comercial ou financeira foi bloqueada automaticamente.');
      setIntelligenceRefresh(value => value + 1);
    } catch (cause) { setIntelligenceError(cause instanceof Error ? cause.message : 'Não foi possível avaliar o risco.'); }
    finally { setIntelligenceLoading(false); }
  };

  useEffect(() => {
    if (!initialClientId) return;
    const client = clients.find(item => item.id === initialClientId);
    if (client) { setSelectedClientHistory(client); onInitialClientOpened?.(); }
  }, [clients, initialClientId, onInitialClientOpened]);

  useEffect(() => {
    if (!initialCreate) return;
    setIsAddOpen(true);
    onInitialCreateOpened?.();
  }, [initialCreate, onInitialCreateOpened]);

  // Safe Date parser
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'n/a';
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toLocaleDateString('pt-BR');
    }
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  const getMillis = (dateObj: any): number => {
    if (!dateObj) return 0;
    if (typeof dateObj.toMillis === 'function') return dateObj.toMillis();
    if (typeof dateObj.toDate === 'function') return dateObj.toDate().getTime();
    const d = new Date(dateObj);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Cross-reference client metrics dynamically
  const getClientMetrics = (client: SavedClient) => {
    // Math client quotes by name (case-insensitive) or by digits in phone number
    const clientPhoneClean = client.phone.replace(/\D/g, '');
    
    const clientQuotes = quotes.filter(q => {
      const qPhoneClean = q.clientPhone.replace(/\D/g, '');
      return q.clientName.toLowerCase() === client.name.toLowerCase() || 
             (clientPhoneClean && qPhoneClean === clientPhoneClean);
    });

    const approvedQuotes = clientQuotes.filter(q => q.status === 'approved');
    const totalAmount = approvedQuotes.reduce((sum, q) => sum + q.total, 0);
    
    // Sort quotes by date to find last contact
    let lastContact = client.createdAt;
    if (clientQuotes.length > 0) {
      const sorted = [...clientQuotes].sort((a, b) => {
        return getMillis(b.createdAt) - getMillis(a.createdAt);
      });
      lastContact = sorted[0].createdAt;
    }

    return {
      quoteCount: clientQuotes.length,
      totalRevenue: totalAmount,
      revenueBRL: formatBRL(totalAmount),
      lastContact,
      quoteHistory: clientQuotes
    };
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    setIsSubmitting(true);
    setWriteError('');
    try {
      const clientId = 'cl_' + Math.random().toString(36).substring(2, 9);
      const newClient: SavedClient = {
        id: clientId,
        userId,
        name: newName,
        phone: newPhone,
        vehicleOrService: newVehicle,
        notes: newNotes,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await onClientAdded(newClient);
      setIsAddOpen(false);
      // Reset
      setNewName('');
      setNewPhone('');
      setNewVehicle('');
      setNewNotes('');
    } catch (err) {
      setWriteError(err instanceof Error ? err.message : 'Não foi possível salvar o cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportClientToCSV = (client: SavedClient) => {
    const metrics = getClientMetrics(client);
    const quoteHistory = metrics.quoteHistory;
    
    // Header with UTF-8 BOM to support accented chars on Windows (Excel) & Mobile browsers
    let csvContent = '\uFEFF'; 
    csvContent += 'Orçamento,Data,Status,Serviço/Item,Descrição,Quantidade,Preço Unitário,Desconto (%),Total do Item\n';
    
    quoteHistory.forEach(q => {
      const dateStr = formatDate(q.createdAt);
      q.items.forEach(item => {
        const itemTotal = (item.quantity * item.unitPrice) * (1 - (item.discount || 0) / 100);
        
        const escapeCSV = (text: string) => {
          if (!text) return '';
          const escaped = text.replace(/"/g, '""');
          return `"${escaped}"`;
        };
        
        const row = [
          `#${q.quoteNumber}`,
          dateStr,
          q.status === 'approved' ? 'Aprovado' : q.status === 'pending' ? 'Pendente' : q.status === 'rejected' ? 'Rejeitado' : 'Expirado',
          escapeCSV(item.name),
          escapeCSV(item.description || ''),
          item.quantity,
          item.unitPrice.toFixed(2),
          (item.discount || 0).toFixed(0),
          itemTotal.toFixed(2)
        ].join(',');
        
        csvContent += row + '\n';
      });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = `servicos_${client.name.toLowerCase().replace(/\s+/g, '_')}.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    (c.vehicleOrService && c.vehicleOrService.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Search and Action Bar */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Base de Clientes
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Gerencie o histórico de vendas, carros contratados e aprovações de cada cliente.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {OPTIONAL_CUSTOMER_OPERATIONS_ENABLED && <button type="button" onClick={() => { setIsImportOpen(true); setImportError(''); setImportNotice(''); }} className="flex items-center justify-center gap-2 px-4 py-3 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-orange-400 rounded-2xl text-sm font-bold transition-all min-h-11">
            <Upload className="w-4 h-4" /> Importar CSV
          </button>}
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-orange-505/10 active:scale-95 text-center"
          >
            <UserPlus className="w-5 h-5" />
            Novo Cliente
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isImportOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="client-import-title">
          <motion.button type="button" aria-label="Fechar importação" className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm" onClick={closeImport} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.section initial={{ opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:p-7">
            <header className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-500">Grande Transfusão · operação comercial</p><h2 id="client-import-title" className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">Importar dados de um CSV</h2><p className="mt-1 text-xs text-zinc-500">Pré-visualize, mapeie e valide antes de gravar. O arquivo não é enviado a serviços externos.</p></div>
              <button type="button" onClick={closeImport} disabled={importLoading} className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800" aria-label="Fechar"><X className="h-5 w-5" /></button>
            </header>

            {!importCompleted && <div className="mt-5 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <label htmlFor="client-import-type" className="mb-2 block text-xs font-semibold text-zinc-800 dark:text-zinc-100">Tipo de registro</label>
              <select id="client-import-type" value={importEntityType} disabled={importLoading || Boolean(importPreview)} onChange={event=>{const next=event.target.value as ImportEntityType;setImportEntityType(next);setImportMapping(suggestImportMapping(next,importHeaders));setImportPreview(null);setImportError('');setImportNotice('');}} className="mb-3 block min-h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-800 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
                <option value="customers">Clientes</option><option value="contacts">Contatos</option><option value="proposals">Propostas (rascunhos)</option><option value="commercial_records">Negócios</option>
              </select>
              <label htmlFor="client-import-file" className="mb-2 block text-xs font-semibold text-zinc-800 dark:text-zinc-100">Arquivo CSV (até 1.000 linhas)</label>
              <input id="client-import-file" type="file" accept=".csv,text/csv" disabled={importLoading} onChange={event => void handleImportFile(event.target.files?.[0])} className="block w-full text-xs text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white dark:text-zinc-300" />
              {importFileName && <p className="mt-2 text-[11px] text-zinc-500">{importFileName} · {importRows.length} linhas reconhecidas</p>}
              <p className="mt-2 text-[10px] text-zinc-500">Formatos separados por vírgula, ponto e vírgula ou tabulação. Cabeçalhos podem estar em português.</p>
            </div>}

            {importHeaders.length > 0 && !importCompleted && <div className="mt-4">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Mapeie as colunas</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {importFields[importEntityType].map(([target,label]) => <label key={target} className="text-[10px] font-semibold text-zinc-500">{label}<select value={importMapping[target] || ''} onChange={event => { setImportMapping(current => ({ ...current, [target]: event.target.value })); setImportPreview(null); }} className="mt-1 block min-h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs text-zinc-800 outline-none focus:border-orange-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"><option value="">— Não importar —</option>{importHeaders.map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}
              </div>
              <div className="mt-3 flex justify-end"><button type="button" onClick={() => void previewImport()} disabled={importLoading || importRows.length === 0 || (importEntityType==='customers' ? !importMapping.name || !importMapping.phone : importEntityType==='contacts' ? !importMapping.fullName || (!importMapping.phone&&!importMapping.email) : importEntityType==='proposals' ? !importMapping.customerRef || !importMapping.items : !importMapping.title || !importMapping.customerRef || !importMapping.stage || !importMapping.valueCents)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">{importLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Validar e gerar prévia</button></div>
            </div>}

            {importPreview && <section className="mt-5 rounded-2xl border border-zinc-200 dark:border-zinc-800" aria-label="Prévia da importação">
              <div className="grid grid-cols-3 divide-x divide-zinc-200 border-b border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {[
                  ['Válidos', importPreview.rows.filter(row => row.status === 'valid').length, 'text-emerald-600'],
                  ['Possíveis duplicados', importPreview.rows.filter(row => row.status === 'duplicate').length, 'text-amber-600'],
                  ['Com erro', importPreview.rows.filter(row => row.status === 'error').length, 'text-red-600'],
                ].map(([label, value, color]) => <div key={String(label)} className="p-3 text-center"><p className={`text-lg font-bold ${color}`}>{value}</p><p className="text-[9px] text-zinc-500">{label}</p></div>)}
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-zinc-50 text-zinc-500 dark:bg-zinc-900"><tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">{importFields[importEntityType][0]?.[1]?.replace(' *','') || 'Registro'}</th><th className="px-3 py-2">{importEntityType==='customers'||importEntityType==='contacts'?'Telefone / e-mail':'Referência'}</th><th className="px-3 py-2">Resultado</th></tr></thead><tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">{importPreview.rows.slice(0, 50).map(row => { const primary=importFields[importEntityType][0]?.[0]; const secondary=importEntityType==='customers'||importEntityType==='contacts' ? (importEntityType==='customers'?'phone':'phone') : importEntityType==='proposals'?'customerRef':'externalRef'; return <tr key={row.rowNumber} className="text-zinc-700 dark:text-zinc-300"><td className="px-3 py-2">{row.rowNumber}</td><td className="px-3 py-2">{String(row.normalized?.[primary] || '—')}</td><td className="px-3 py-2">{String(row.normalized?.[secondary] || row.normalized?.email || '—')}</td><td className="px-3 py-2">{row.status === 'valid' ? <span className="text-emerald-600">Pronto</span> : row.status === 'duplicate' ? <span className="text-amber-600">Revisar duplicidade</span> : <span className="text-red-600">{row.errors?.join(', ') || 'Linha inválida'}</span>}{row.duplicateMatches?.[0] && <p className="mt-0.5 text-[9px] text-zinc-500">Possível correspondência: {row.duplicateMatches[0].rowNumber ? `linha ${row.duplicateMatches[0].rowNumber} deste arquivo` : row.duplicateMatches[0].name} ({row.duplicateMatches[0].status === 'MATCH' ? 'forte' : 'possível'})</p>}</td></tr>; })}</tbody></table>
                {importPreview.rows.length > 50 && <p className="p-2 text-center text-[9px] text-zinc-500">Exibindo 50 de {importPreview.rows.length} linhas da prévia.</p>}
              </div>
            </section>}

            {importError && <p role="alert" className="mt-4 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">{importError}</p>}
            {importNotice && <p role="status" className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">{importNotice}</p>}
            <footer className="mt-5 flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:justify-between">
              {importCompleted && !importRolledBack ? <button type="button" disabled={importLoading} onClick={() => void rollbackImport()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-500/40 px-4 text-xs font-semibold text-amber-700 hover:bg-amber-500/5 disabled:opacity-40 dark:text-amber-300"><RotateCcw className="h-3.5 w-3.5" />Compensar importação</button> : importRolledBack ? <span className="text-[10px] leading-4 text-zinc-500">Compensação desta importação já foi processada.</span> : <span className="text-[10px] leading-4 text-zinc-500 sm:max-w-xs">Somente linhas válidas serão gravadas. Duplicados permanecem fora para revisão manual.</span>}
              <div className="flex gap-2"><button type="button" onClick={closeImport} disabled={importLoading} className="min-h-10 rounded-xl px-4 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-900">Fechar</button>{!importCompleted && <button type="button" onClick={() => void commitImport()} disabled={importLoading || !importPreview || importPreview.rows.every(row => row.status !== 'valid')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-xs font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40">{importLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Confirmar importação</button>}</div>
            </footer>
          </motion.section>
        </div>}
      </AnimatePresence>

      <div className="mb-6">
        <WiaInline
          eyebrow="WIA · memória comercial"
          title={`${clients.length} cliente${clients.length === 1 ? '' : 's'} com histórico organizado`}
          description="A WIA usará contexto, recorrência e negociações anteriores para reduzir perguntas repetidas e sugerir a próxima ação adequada."
          actions={['histórico', 'recorrência', 'valor', 'próxima ação']}
        />
      </div>

      {/* Grid search filters */}
      <div className="mb-6 relative">
        <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar cliente por nome, telefone ou área de projeto..."
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium dark:text-white"
        />
      </div>

      {/* Clients list table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        {filteredClients.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-zinc-300 dark:text-zinc-650" />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 font-bold mb-2">Sem Clientes Cadastrados</p>
            <p className="text-zinc-400 text-xs max-w-sm mx-auto mb-6">Cadastre novos clientes clicando no botão acima ou eles serão adicionados automaticamente ao criar orçamentos.</p>
          </div>
        ) : (
          <div className="w-full">
            {/* Mobile Card Grid View for small viewports (< md) */}
            <div className="block md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredClients.map(client => {
                const metrics = getClientMetrics(client);
                return (
                  <div key={`m_cli_${client.id}`} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white">{client.name}</h4>
                        {client.vehicleOrService && (
                          <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1 font-bold">
                            <Car className="w-3.5 h-3.5 text-zinc-300" />
                            {client.vehicleOrService}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedClientHistory(client)}
                        className="px-2.5 py-1.5 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold rounded-xl hover:bg-orange-100 transition-colors flex items-center gap-1 shrink-0"
                      >
                        <History className="w-3 h-3" />
                        Histórico
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                      <div>
                        <p className="text-zinc-400 uppercase tracking-wider text-[9px] font-bold mb-0.5">Telefone</p>
                        <p className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">{formatPhone(client.phone)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 uppercase tracking-wider text-[9px] font-bold mb-0.5">Orçamentos</p>
                        <p className="text-zinc-700 dark:text-zinc-300 font-bold">{metrics.quoteCount}</p>
                      </div>
                      <div>
                        <p className="text-zinc-400 uppercase tracking-wider text-[9px] font-bold mb-0.5">Último Contato</p>
                        <p className="font-mono text-zinc-500 font-bold">{formatDate(metrics.lastContact)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-400 uppercase tracking-wider text-[9px] font-bold mb-0.5 text-right">Aprovado</p>
                        <p className="font-display font-extrabold text-emerald-600">{metrics.revenueBRL}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View for medium screens and above (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 font-bold text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-widest text-[10px]">
                    <th className="p-4 pl-6">Cliente</th>
                    <th className="p-4">WhatsApp / Celular</th>
                    <th className="p-4">Orçamentos</th>
                    <th className="p-4 text-right">Faturamento Aprovado</th>
                    <th className="p-4">Último Contato</th>
                    <th className="p-4 text-center">Histórico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredClients.map(client => {
                    const metrics = getClientMetrics(client);
                    return (
                      <tr 
                        key={client.id}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-all group"
                      >
                        {/* Name / Vehicle info */}
                        <td className="p-4 pl-6">
                          <div>
                            <p className="font-extrabold text-zinc-900 dark:text-white">{client.name}</p>
                            {client.vehicleOrService && (
                              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-bold">
                                <Car className="w-3.5 h-3.5 text-zinc-300" />
                                {client.vehicleOrService}
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="p-4">
                          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 font-mono font-bold">
                            <Phone className="w-3.5 h-3.5 text-zinc-400" />
                            {formatPhone(client.phone)}
                          </div>
                        </td>

                        <td className="p-4 font-bold text-zinc-650 dark:text-zinc-300">
                          {metrics.quoteCount} {metrics.quoteCount === 1 ? 'orçamento' : 'orçamentos'}
                        </td>

                        <td className="p-4 text-right font-display font-extrabold text-emerald-600">
                          {metrics.revenueBRL}
                        </td>

                        <td className="p-4 font-mono text-zinc-500 font-bold">
                          {formatDate(metrics.lastContact)}
                        </td>

                        <td className="p-4 text-center">
                          <button
                            onClick={() => setSelectedClientHistory(client)}
                            className="px-3 py-1.5 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-xl hover:bg-orange-100 transition-colors flex items-center gap-1 mx-auto"
                          >
                            <History className="w-3.5 h-3.5" />
                            Histórico
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Client Dialog Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-2xl overflow-hidden outline-none"
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-client-title"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 id="new-client-title" className="text-xl font-bold font-display text-zinc-900 dark:text-white">Novo Cliente</h3>
                <button type="button" aria-label="Fechar novo cliente" onClick={() => setIsAddOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-4">
                {writeError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">{writeError}</p>}
                <div>
                  <label htmlFor="new-client-name" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Nome do Cliente *</label>
                  <input
                    id="new-client-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Pedro Alves Silva"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="new-client-phone" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">WhatsApp / Celular *</label>
                  <input
                    id="new-client-phone"
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="new-client-scope" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Escopo / Projeto Padrão</label>
                  <input
                    id="new-client-scope"
                    type="text"
                    value={newVehicle}
                    onChange={(e) => setNewVehicle(e.target.value)}
                    placeholder="Ex: Consultoria de Investimentos ou Desenvolvimento Web"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="new-client-notes" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Notas do Cliente</label>
                  <textarea
                    id="new-client-notes"
                    rows={2}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Ex: Cliente focado em velocidade de fechamento, prefere atendimento consultivo."
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="flex-1 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-white rounded-xl text-xs font-bold"
                  >
                    Mudar de Ideia
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white rounded-xl flex justify-center items-center gap-1.5"
                  >
                    Salvar Registro
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Slide dialogue modal */}
      <AnimatePresence>
        {selectedClientHistory && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" 
              onClick={() => {
                setSelectedClientHistory(null);
                setIsEditing(false);
              }} 
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 h-full p-8 shadow-2xl flex flex-col justify-between overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label={`Detalhes de ${selectedClientHistory.name}`}
            >
              <div>
                <header className="flex justify-between items-center pb-6 border-b border-zinc-100 dark:border-zinc-800 mb-6">
                  {!isEditing ? (
                    <div className="flex-1 mr-4">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-xl font-bold font-display text-zinc-900 dark:text-white leading-tight">
                          {selectedClientHistory.name}
                        </h3>
                        <button
                          onClick={() => {
                            setEditName(selectedClientHistory.name);
                            setEditPhone(selectedClientHistory.phone);
                            setEditVehicle(selectedClientHistory.vehicleOrService || '');
                            setEditNotes(selectedClientHistory.notes || '');
                            setIsEditing(true);
                          }}
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-orange-500 hover:bg-orange-500/10 transition-all"
                          title="Editar Cadastro"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const metrics = getClientMetrics(selectedClientHistory);
                            if (metrics.quoteCount > 0) {
                              alert(`Não é possível arquivar o cliente "${selectedClientHistory.name}" enquanto ele possui ${metrics.quoteCount} orçamento(s) vinculado(s).\n\nIsso preserva a integridade do histórico comercial e financeiro.`);
                              return;
                            }
                            if (window.confirm(`Arquivar o cliente "${selectedClientHistory.name}"? Ele deixará de aparecer na lista ativa, mas seu histórico será preservado.`)) {
                              setWriteError('');
                              void (async () => {
                                try { await onClientDeleted?.(selectedClientHistory.id); setSelectedClientHistory(null); }
                                catch (err) { setWriteError(err instanceof Error ? err.message : 'Não foi possível arquivar o cliente.'); }
                              })();
                            }
                          }}
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                          title="Arquivar cliente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 font-medium font-mono mt-1.5">{formatPhone(selectedClientHistory.phone)}</p>
                    </div>
                  ) : (
                    <div className="flex-1 mr-4">
                      <h3 className="text-lg font-bold font-display text-zinc-900 dark:text-white">Editar Cliente</h3>
                      <p className="text-xs text-zinc-400 mt-0.5">Modifique os dados cadastrais abaixo.</p>
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      setSelectedClientHistory(null);
                      setIsEditing(false);
                    }} 
                    className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 shrink-0"
                    aria-label="Fechar detalhes do cliente"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </header>

                {!isEditing && <section className="mb-5 rounded-2xl border border-[#FF9F1C]/25 bg-[#FF9F1C]/5 p-4" aria-label="Sinais comerciais calculados">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#FF9F1C]">Contexto WIA · sinais operacionais</p><h4 className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Relação comercial</h4></div>
                    <button type="button" onClick={() => void assessClientRisk()} disabled={intelligenceLoading} className="min-h-9 shrink-0 rounded-lg border border-[#FF9F1C]/35 px-3 text-[10px] font-semibold text-zinc-700 hover:bg-[#FF9F1C]/10 disabled:opacity-50 dark:text-zinc-200">{intelligenceLoading ? 'Atualizando…' : clientIntelligence?.risk ? 'Reavaliar risco' : 'Avaliar risco'}</button>
                  </div>
                  {intelligenceError && <p role="alert" className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[10px] leading-4 text-amber-800 dark:text-amber-200">{intelligenceError}</p>}
                  {intelligenceNotice && <p role="status" className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[10px] leading-4 text-emerald-800 dark:text-emerald-200">{intelligenceNotice}</p>}
                  {intelligenceLoading && !clientIntelligence ? <p role="status" className="mt-3 text-[10px] text-zinc-500">Buscando sinais registrados…</p> : clientIntelligence ? <>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"><p className="text-[9px] uppercase tracking-wider text-zinc-500">Mood Ring</p><p className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">{{ ENGAGED: 'Engajado', NEUTRAL: 'Neutro', STUCK: 'Travado', LOYAL: 'Fiel' }[clientIntelligence.mood.state]}</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">{clientIntelligence.mood.explanation}</p>{clientIntelligence.mood.signals.length > 0 && <p className="mt-2 text-[9px] leading-4 text-zinc-500">Sinais: {clientIntelligence.mood.signals.join(' · ')}</p>}</div>
                      <div className="rounded-xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"><p className="text-[9px] uppercase tracking-wider text-zinc-500">Ritmo de contato</p><p className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Índice operacional {clientIntelligence.operationalSignals.score}/100</p><p className="mt-1 text-[10px] leading-4 text-zinc-500">{clientIntelligence.operationalSignals.signals.length ? clientIntelligence.operationalSignals.signals.join(' · ') : 'Sem sinal operacional relevante nos dados disponíveis.'}</p></div>
                    </div>
                    {clientIntelligence.risk ? <div className="mt-2 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"><p className="text-[10px] font-semibold text-amber-900 dark:text-amber-100">Risco comercial {clientIntelligence.risk.score}/100 · confiança {Math.round(clientIntelligence.risk.confidence * 100)}%</p>{clientIntelligence.risk.reasons?.length > 0 && <p className="mt-1 text-[9px] leading-4 text-amber-800 dark:text-amber-200">{clientIntelligence.risk.reasons.join(' · ')}</p>}<p className="mt-1 text-[9px] text-zinc-500">Recomendação: {clientIntelligence.risk.recommended_action} · revisão humana preservada.</p></div> : <p className="mt-2 text-[9px] text-zinc-500">Ainda sem avaliação de risco registrada.</p>}
                    <p className="mt-2 text-[9px] leading-4 text-zinc-500">{clientIntelligence.note}</p>
                  </> : !intelligenceLoading && <p className="mt-3 text-[10px] leading-4 text-zinc-500">Nenhum sinal calculado disponível ainda.</p>}
                </section>}

                {OPTIONAL_CUSTOMER_OPERATIONS_ENABLED && !isEditing && <section className="mb-5 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-950/40" aria-label="Memória comercial e recompra">
                  <div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#FF9F1C]">Contexto persistente · workspace</p><h4 className="mt-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">Memória comercial e recompra</h4><p className="mt-1 text-[10px] leading-4 text-zinc-500">Memórias são fatos/preferências confirmados, com origem. O cálculo de recompra usa apenas compras registradas.</p></div>
                  {(customerContextError || customerContextNotice) && <p role={customerContextError ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-[10px] leading-4 ${customerContextError ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200'}`}>{customerContextError || customerContextNotice}</p>}
                  {customerContextLoading ? <p role="status" className="text-[10px] text-zinc-500">Carregando memória e histórico de compras…</p> : <>
                    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">Ciclo de recompra</p><button type="button" onClick={() => setCustomerContextRefresh(value => value + 1)} disabled={customerContextSaving || customerContextLoading} className="min-h-7 rounded-md px-2 text-[9px] font-semibold text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800">Atualizar</button></div>
                      {repurchaseView ? <><p className="mt-2 text-[10px] leading-4 text-zinc-600 dark:text-zinc-400">{repurchaseView.data.reason}</p><p className="mt-1 text-[10px] text-zinc-500">{repurchaseView.data.intervalDays == null ? 'Intervalo: sem dados' : `Intervalo mediano: ${repurchaseView.data.intervalDays} dias`} · confiança {Math.round(repurchaseView.data.confidence * 100)}%{repurchaseView.data.estimatedAt ? ` · estimativa ${new Date(repurchaseView.data.estimatedAt).toLocaleDateString('pt-BR')}` : ''}</p><p className="mt-1 text-[9px] text-zinc-500">Agenda: {repurchaseView.jobs.filter(job => job.status === 'scheduled').length} pendente(s) · automação sempre prepara para aprovação; nenhum envio automático.</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => void scheduleCustomerRepurchase()} disabled={customerContextSaving || !repurchaseView.data.eligible} className="min-h-8 rounded-lg bg-[#FF9F1C] px-3 text-[9px] font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50">{customerContextSaving ? 'Salvando…' : 'Programar para revisão'}</button>{repurchaseView.jobs.some(job => job.status === 'scheduled') && <button type="button" onClick={() => void cancelCustomerRepurchase()} disabled={customerContextSaving} className="min-h-8 rounded-lg border border-zinc-300 px-3 text-[9px] font-semibold text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300">Cancelar programação</button>}</div></> : <p className="mt-2 text-[10px] text-zinc-500">Sem histórico suficiente para estimar.</p>}
                      <details className="mt-3 border-t border-zinc-100 pt-2 dark:border-zinc-800"><summary className="cursor-pointer text-[9px] font-semibold text-zinc-600 dark:text-zinc-300">Registrar compra histórica</summary><form onSubmit={recordCustomerPurchase} className="mt-2 grid gap-2 sm:grid-cols-2"><input required value={purchaseProductName} onChange={event => setPurchaseProductName(event.target.value)} placeholder="Produto ou serviço" aria-label="Produto ou serviço da compra" className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" /><input value={purchaseProductRef} onChange={event => setPurchaseProductRef(event.target.value)} placeholder="Referência (opcional)" aria-label="Referência do produto" className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" /><input required type="number" min="0" step="0.01" value={purchaseAmount} onChange={event => setPurchaseAmount(event.target.value)} placeholder="Valor em R$" aria-label="Valor da compra em reais" className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" /><input required type="date" max={new Date().toISOString().slice(0,10)} value={purchaseDate} onChange={event => setPurchaseDate(event.target.value)} aria-label="Data da compra" className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" /><button type="submit" disabled={customerContextSaving} className="min-h-9 rounded-lg border border-[#FF9F1C]/40 px-3 text-[9px] font-semibold text-amber-800 disabled:opacity-50 dark:text-[#ffb54d]">Registrar compra</button></form></details>
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/50"><p className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">Memórias ativas ({customerMemories.length})</p>{customerMemories.length === 0 ? <p className="mt-2 text-[10px] text-zinc-500">Nenhuma memória confirmada para este cliente.</p> : <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">{customerMemories.map(memory => <li key={memory.id} className="rounded-lg border border-zinc-100 p-2 dark:border-zinc-800"><p className="whitespace-pre-wrap text-[10px] leading-4 text-zinc-700 dark:text-zinc-300">{String(memory.content?.note || memory.content?.text || JSON.stringify(memory.content))}</p><div className="mt-1 flex flex-wrap items-center justify-between gap-2"><span className="text-[8px] text-zinc-500">{memory.memory_type} · origem {memory.provenance?.source || 'não informada'} · confiança {memory.confidence == null ? 'não definida' : `${Math.round(memory.confidence * 100)}%`}</span>{memory.memory_type !== 'raw_event' && <button type="button" onClick={() => void correctCustomerMemory(memory)} disabled={customerContextSaving} className="min-h-6 rounded px-2 text-[8px] font-semibold text-amber-800 hover:bg-amber-500/10 disabled:opacity-50 dark:text-[#ffb54d]">Corrigir</button>}</div></li>)}</ul>}
                      <form onSubmit={saveCustomerMemory} className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800"><div className="flex gap-2"><select aria-label="Tipo de memória" value={memoryType} onChange={event => setMemoryType(event.target.value as typeof memoryType)} className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2 text-[9px] dark:border-zinc-700 dark:bg-zinc-950"><option value="preference">Preferência</option><option value="fact">Fato</option><option value="summary">Resumo</option><option value="commercial_pattern">Padrão comercial</option></select><input value={memoryText} onChange={event => setMemoryText(event.target.value)} maxLength={1000} placeholder="Informação confirmada pela equipe" aria-label="Nova memória comercial" className="min-h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" /></div><button type="submit" disabled={customerContextSaving || !memoryText.trim()} className="min-h-8 rounded-lg border border-[#FF9F1C]/40 px-3 text-[9px] font-semibold text-amber-800 disabled:opacity-50 dark:text-[#ffb54d]">Salvar memória confirmada</button></form>
                    </div>
                  </>}
                </section>}

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Nome Completo *</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-900 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Telefone WhatsApp *</label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-900 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Escopo / Projeto Padrão</label>
                      <input
                        type="text"
                        value={editVehicle}
                        onChange={(e) => setEditVehicle(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Notas Internas</label>
                      <textarea
                        rows={3}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 text-zinc-900 dark:text-white"
                      />
                    </div>

                    <div className="pt-4 flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!editName.trim()) {
                            alert('Informe o nome do cliente.');
                            return;
                          }
                          if (!editPhone.trim()) {
                            alert('Informe o telefone do cliente.');
                            return;
                          }
                          const updated: SavedClient = {
                            ...selectedClientHistory,
                            name: editName,
                            phone: editPhone,
                            vehicleOrService: editVehicle || undefined,
                            notes: editNotes || undefined,
                            updatedAt: Timestamp.now()
                          };
                          setWriteError('');
                          void (async () => {
                            try { await onClientUpdated?.(updated); setSelectedClientHistory(updated); setIsEditing(false); }
                            catch (err) { setWriteError(err instanceof Error ? err.message : 'Não foi possível atualizar o cliente.'); }
                          })();
                        }}
                        className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white rounded-xl transition-all"
                      >
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Basic notes details */}
                    {selectedClientHistory.vehicleOrService && (
                      <div>
                        <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-1.5">Escopo / Projeto Padrão Registrado</h4>
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-[#FF9F1C]" />
                          <span className="text-xs text-zinc-700 dark:text-zinc-300 font-bold">{selectedClientHistory.vehicleOrService}</span>
                        </div>
                      </div>
                    )}

                    {selectedClientHistory.notes && (
                      <div>
                        <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-1.5">Notas do Cliente</h4>
                        <p className="text-xs text-zinc-500 bg-orange-50/5 p-3 rounded-2xl border border-orange-200/5 leading-relaxed">{selectedClientHistory.notes}</p>
                      </div>
                    )}

                    <section aria-label="Contatos do cliente" className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="flex items-center justify-between gap-3">
                        <div><h4 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Contatos ({contacts.length})</h4><p className="mt-1 text-[10px] text-zinc-500">Pessoas vinculadas a este cliente.</p></div>
                        <button type="button" onClick={resetContactForm} className="min-h-8 rounded-lg border border-zinc-300 px-3 text-[9px] font-semibold dark:border-zinc-700">Novo contato</button>
                      </div>
                      {contactError && <p role="alert" className="mt-3 text-[10px] text-red-600">{contactError}</p>}
                      {contactsLoading ? <p role="status" className="mt-3 text-[10px] text-zinc-500">Carregando contatos…</p> :
                        contacts.length === 0 ? <p className="mt-3 text-[10px] text-zinc-500">Nenhum contato cadastrado.</p> :
                        <ul className="mt-3 space-y-2">{contacts.map(contact => <li key={contact.id} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950">
                          <div><p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{contact.full_name}</p><p className="mt-1 text-[9px] text-zinc-500">{[contact.role,contact.phone,contact.email].filter(Boolean).join(' · ')}</p></div>
                          <button type="button" aria-label={`Editar contato ${contact.full_name}`} onClick={() => { setContactEditingId(contact.id);setContactName(contact.full_name);setContactPhone(contact.phone || '');setContactEmail(contact.email || '');setContactRole(contact.role || ''); }} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800"><Pencil className="h-3.5 w-3.5" /></button>
                        </li>)}</ul>}
                      <form onSubmit={saveContact} className="mt-3 grid gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800 sm:grid-cols-2">
                        <input required aria-label="Nome do contato" value={contactName} onChange={event=>setContactName(event.target.value)} placeholder="Nome do contato" maxLength={200} className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" />
                        <input aria-label="Cargo do contato" value={contactRole} onChange={event=>setContactRole(event.target.value)} placeholder="Cargo" maxLength={120} className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" />
                        <input aria-label="Telefone do contato" value={contactPhone} onChange={event=>setContactPhone(event.target.value)} placeholder="Telefone" maxLength={80} className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" />
                        <input type="email" aria-label="Email do contato" value={contactEmail} onChange={event=>setContactEmail(event.target.value)} placeholder="E-mail" maxLength={254} className="min-h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-950" />
                        <button type="submit" disabled={contactSaving || !contactName.trim() || (!contactPhone.trim() && !contactEmail.trim())} className="min-h-9 rounded-lg bg-[#FF9F1C] px-3 text-[10px] font-bold text-zinc-950 disabled:opacity-50 sm:col-span-2">{contactSaving ? 'Salvando…' : contactEditingId ? 'Salvar contato' : 'Adicionar contato'}</button>
                      </form>
                    </section>

                    {/* Dynamic Quotation timelines list */}
                    <div>
                      <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-3.5">Histórico de Orçamentos ({getClientMetrics(selectedClientHistory).quoteCount})</h4>
                      
                      <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                        {getClientMetrics(selectedClientHistory).quoteHistory.length === 0 ? (
                          <p className="text-xs text-zinc-500 italic">Este cliente ainda não possui faturamento criado.</p>
                        ) : (
                          getClientMetrics(selectedClientHistory).quoteHistory.map(qh => (
                            <div 
                              key={qh.id}
                              className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-2xl flex items-center justify-between gap-4"
                            >
                              <div>
                                <p className="font-extrabold text-xs text-zinc-850 dark:text-white">Orçamento #{qh.quoteNumber}</p>
                                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">{formatDate(qh.createdAt)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold font-mono text-zinc-900 dark:text-zinc-100">{formatBRL(qh.total)}</p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectQuote(qh.id);
                                    setSelectedClientHistory(null);
                                  }}
                                  className="text-[9px] font-bold text-orange-500 hover:underline mt-1 flex items-center gap-0.5 justify-end"
                                >
                                  Ver Completo
                                  <ChevronRight className="w-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!isEditing && (
                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => exportClientToCSV(selectedClientHistory)}
                    className="py-3 px-4 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/15 transition-all select-none min-h-[44px]"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientHistory(null);
                      setIsEditing(false);
                    }}
                    className="py-3 px-4 bg-zinc-100 hover:bg-zinc-200 active:scale-95 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs text-zinc-700 dark:text-white rounded-xl transition-all select-none min-h-[44px]"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
