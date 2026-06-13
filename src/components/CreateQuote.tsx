import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Phone, 
  Car, 
  FileText, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Send, 
  Copy, 
  Download, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  Search,
  Tag,
  DollarSign,
  AlertCircle,
  Clock,
  Printer,
  ExternalLink,
  Mail,
  Briefcase,
  Sparkles
} from 'lucide-react';
import { Quote, QuoteItem, SavedClient, SavedService, UserProfile, Timestamp } from '../types';
import { formatCurrency, formatBRL, formatPhone, getCleanPhoneForWhatsApp } from '../utils/format';

interface CreateQuoteProps {
  userProfile: UserProfile | null;
  savedClients: SavedClient[];
  savedServices: SavedService[];
  duplicateQuoteSource?: Quote | null;
  editQuoteSource?: Quote | null;
  onQuoteCreated: (quote: Quote) => void;
  onCancel: () => void;
  onClientAdded?: (client: SavedClient) => void;
}

export default function CreateQuote({ 
  userProfile, 
  savedClients, 
  savedServices, 
  duplicateQuoteSource,
  editQuoteSource,
  onQuoteCreated, 
  onCancel,
  onClientAdded
}: CreateQuoteProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Client Data
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientVehicleOrService, setClientVehicleOrService] = useState('');
  const [notes, setNotes] = useState('');
  const [searchClientQuery, setSearchClientQuery] = useState('');
  const [showClientSuggested, setShowClientSuggested] = useState(false);

  // Step 2: Edit Items
  const [items, setItems] = useState<QuoteItem[]>([
    { id: '1', name: '', description: '', quantity: 1, unitPrice: 0, discount: 0 }
  ]);
  const [searchServiceQuery, setSearchServiceQuery] = useState('');
  const [activeItemIndexForServiceSearch, setActiveItemIndexForServiceSearch] = useState<number | null>(null);

  // Step 3: Terms
  const [validValueDays, setValidValueDays] = useState(10);
  const [paymentInstructions, setPaymentInstructions] = useState(
    userProfile?.paymentInfo || 'Chave Pix CNPJ: 14.502.836/0001-90\nBanco Cora - Favorecido: Orkto Pro Solutions Ltda'
  );
  const [taxes, setTaxes] = useState<number>(0);
  const [linkCopied, setLinkCopied] = useState(false);

  // Use useEffect to prefill if duplication or editing source is active
  useEffect(() => {
    const source = editQuoteSource || duplicateQuoteSource;
    if (source) {
      setClientName(source.clientName || '');
      setClientPhone(source.clientPhone || '');
      setClientEmail(source.clientEmail || '');
      setClientVehicleOrService(source.clientVehicleOrService || '');
      setNotes(source.notes || '');
      // Deep clone items so modified IDs won't conflict
      setItems(source.items.map(item => ({ 
        ...item, 
        id: editQuoteSource ? item.id : Math.random().toString(36).substring(2, 9) 
      })));
      setValidValueDays(source.validValueDays || 10);
      setPaymentInstructions(source.paymentInstructions || '');
      setTaxes(source.taxes || 0);
    }
  }, [editQuoteSource, duplicateQuoteSource]);

  // Result state
  const [createdQuote, setCreatedQuote] = useState<Quote | null>(null);

  const [isEnhancingIndex, setIsEnhancingIndex] = useState<number | null>(null);

  const handleEnhanceWithAI = async (index: number) => {
    setIsEnhancingIndex(index);
    try {
      const item = items[index];
      const response = await fetch('/api/gemini/adapt-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profession: userProfile?.profession || 'Design & Tecnologia',
          tone: userProfile?.brandTone || 'comercial',
          clientName: clientName || 'Cliente',
          clientVehicleOrService: clientVehicleOrService || 'Prestação de Serviço',
          notes: notes,
          items: [item],
          paymentInstructions: paymentInstructions
        })
      });

      if (!response.ok) {
        throw new Error('Fallback to local enhancement');
      }

      const data = await response.json();
      if (data && data.items && data.items.length > 0) {
        const enhancedItem = data.items[0];
        const updated = [...items];
        updated[index] = {
          ...updated[index],
          name: enhancedItem.name || item.name,
          description: enhancedItem.description || item.description
        };
        setItems(updated);
        
        // Smoothly refine total notes/payment instructions if they are empty
        if (data.notes && !notes) {
          setNotes(data.notes);
        }
        if (data.paymentInstructions && !paymentInstructions) {
          setPaymentInstructions(data.paymentInstructions);
        }
      } else {
        throw new Error('Invalid format from AI adaptation endpoint');
      }
    } catch (err) {
      console.warn('Using local fallback copywriter for item enrichment:', err);
      const item = items[index];
      const itemNameLower = (item.name || '').toLowerCase();
      const itemDescLower = (item.description || '').toLowerCase();
      
      let enhancedName = item.name;
      let enhancedDesc = item.description;

      if (itemNameLower.includes('landing') || itemDescLower.includes('landing') || itemNameLower.includes('site') || itemDescLower.includes('site')) {
        enhancedName = 'Desenvolvimento de Landing Page de Alta Conversão';
        enhancedDesc = 'Design responsivo premium focado em captação de leads. Inclui copywriting tático, SEO técnico refinado, integração HubSpot e otimização total de velocidade.';
      } else if (itemNameLower.includes('logo') || itemDescLower.includes('logo') || itemNameLower.includes('brand') || itemDescLower.includes('brand') || itemNameLower.includes('design') || itemDescLower.includes('design')) {
        enhancedName = 'Branding & Identidade Visual Corporativa';
        enhancedDesc = 'Logotipo autoral exclusivo, paleta de cores estratégica e tipografia corporativa. Entrega do manual completo de marca e arquivos finais vetorizados.';
      } else if (itemNameLower.includes('consultoria') || itemDescLower.includes('consultoria') || itemNameLower.includes('seo') || itemDescLower.includes('seo')) {
        enhancedName = 'Consultoria Estratégica de Posicionamento';
        enhancedDesc = 'Auditoria profunda da presença digital ativa, diagnóstico de conversão UX/UI do funil de vendas e cronograma detalhado de ações táticas prioritárias.';
      } else if (itemNameLower.includes('tráfego') || itemDescLower.includes('tráfego') || itemNameLower.includes('ads') || itemDescLower.includes('ads')) {
        enhancedName = 'Gestão de Tráfego Pago & Audiência Select';
        enhancedDesc = 'Gerenciamento avançado de mídia paga (Facebook Ads e Google Ads). Implementação técnica de rastreamento, testes contínuos de criativos e otimização semanal.';
      } else {
        enhancedName = item.name ? `${item.name} Premium` : 'Serviço de Tecnologia & Inovação';
        enhancedDesc = item.description 
          ? `Entrega consultiva Premium de ${item.description}. Alta performance, suporte dedicado e garantia absoluta de conformidade técnica corporativa.`
          : 'Solução corporativa customizada com metodologia ágil aplicada, visando excelência operacional e aceleração de novos negócios digitais.';
      }

      const updated = [...items];
      updated[index] = {
        ...updated[index],
        name: enhancedName,
        description: enhancedDesc
      };
      setItems(updated);
    } finally {
      setIsEnhancingIndex(null);
    }
  };

  // Auto-fill values on user profile load
  useEffect(() => {
    if (userProfile?.paymentInfo) {
      setPaymentInstructions(userProfile.paymentInfo);
    }
  }, [userProfile]);

  // Totals calculations
  const calculateTotals = () => {
    let subtotal = 0;
    let discountTotal = 0;
    
    items.forEach(item => {
      const itemSub = item.quantity * item.unitPrice;
      const itemDisc = itemSub * (item.discount / 100);
      subtotal += itemSub;
      discountTotal += itemDisc;
    });

    const total = subtotal - discountTotal + (Number(taxes) || 0);

    return {
      subtotal,
      discountTotal,
      total
    };
  };

  const { subtotal, discountTotal, total } = calculateTotals();

  // Handlers for Items
  const handleAddItem = () => {
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substring(2, 9),
      name: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      setItems([{ id: '1', name: '', description: '', quantity: 1, unitPrice: 0, discount: 0 }]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItemField = (index: number, field: keyof QuoteItem, value: any) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setItems(updated);
  };

  // Autocomplete service template selection
  const handleQuickInsertService = (index: number, service: SavedService) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      name: service.name,
      description: service.description || '',
      unitPrice: service.unitPrice
    };
    setItems(updated);
    setActiveItemIndexForServiceSearch(null);
  };

  // Autocomplete client selection
  const handleQuickSelectClient = (client: SavedClient) => {
    setClientName(client.name);
    setClientPhone(client.phone);
    setClientVehicleOrService(client.vehicleOrService || '');
    if (client.notes) {
      setNotes(client.notes);
    }
    setShowClientSuggested(false);
  };

  // Next steps validation
  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      if (!clientName.trim()) {
        setErrorMessage('Por favor, informe o nome do cliente.');
        return false;
      }
      if (!clientPhone.trim()) {
        setErrorMessage('Por favor, informe o telefone do cliente.');
        return false;
      }
    }
    if (currentStep === 2) {
      // Check if name is non-empty, price is non-negative, and quantity >= 1
      const invalidNameOrPrice = items.some(item => !item.name.trim() || item.unitPrice < 0);
      if (invalidNameOrPrice) {
        setErrorMessage('Preencha o nome de todos os itens e garanta que não existem valores unitários negativos.');
        return false;
      }
      const invalidQuantity = items.some(item => item.quantity < 1);
      if (invalidQuantity) {
        setErrorMessage('A quantidade de cada item deve ser igual ou superior a 1.');
        return false;
      }
      const invalidDiscount = items.some(item => item.discount < 0 || item.discount > 100);
      if (invalidDiscount) {
        setErrorMessage('O desconto concedido por item deve estar obrigatoriamente entre 0% e 100%.');
        return false;
      }
    }
    if (currentStep === 3) {
      if (Number(taxes) < 0) {
        setErrorMessage('Ajustes ou taxas extras não podem possuir valor negativo.');
        return false;
      }
      if (total < 0) {
        setErrorMessage('O valor final estimado do orçamento não pode ser negativo. Revise descontos ou acréscimos aplicados.');
        return false;
      }
    }
    setErrorMessage(null);
    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    setErrorMessage(null);
    setStep(step - 1);
  };

  // Submit quote locally and save client if needed
  const handleFinalize = async () => {
    if (!validateStep(3)) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const userUid = userProfile?.uid || 'anonymous';
      const quoteId = editQuoteSource ? editQuoteSource.id : 'q_' + Math.random().toString(36).substring(2, 11);
      
      // Auto-generate random Quote Number or keep original
      const quoteNumberStr = editQuoteSource ? editQuoteSource.quoteNumber : Math.floor(1000 + Math.random() * 9000).toString();

      const newQuote: Quote = {
        id: quoteId,
        userId: userUid,
        quoteNumber: quoteNumberStr,
        clientName,
        clientPhone,
        clientEmail,
        clientVehicleOrService,
        notes,
        items,
        subtotal,
        discountTotal,
        taxes: Number(taxes) || 0,
        total,
        validValueDays,
        paymentInstructions,
        status: editQuoteSource ? editQuoteSource.status : 'pending',
        createdAt: editQuoteSource ? editQuoteSource.createdAt : Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // 1. Notify parent that quote is created (which will write to local state and localStorage)
      onQuoteCreated(newQuote);

      // 2. Notify parent if client is new so client list updates
      const existingClientRef = savedClients.find(c => c.name.toLowerCase() === clientName.toLowerCase() || c.phone === clientPhone);
      if (!existingClientRef && onClientAdded) {
        const clientUid = 'cl_' + Math.random().toString(36).substring(2, 9);
        onClientAdded({
          id: clientUid,
          userId: userUid,
          name: clientName,
          phone: clientPhone,
          vehicleOrService: clientVehicleOrService,
          notes,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      setCreatedQuote(newQuote);
      setStep(4);
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Erro ao persistir o orçamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const serverTimestampOrNow = () => {
    return Timestamp.now();
  };

  // Share text builder
  const getWhatsAppLink = () => {
    if (!createdQuote) return '';
    const origin = window.location.origin;
    const viewLink = `${origin}?quoteId=${createdQuote.id}`;
    
    // Custom template replace
    let text = userProfile?.whatsappTemplate || 
      'Olá *[CLIENT_NAME]*, aqui está a proposta de *[SERVICE_TYPE]* no valor de *[TOTAL]*. Clique no link abaixo para visualizar os detalhes e aprovar:\n\n*[LINK]*';
    
    text = text.replace('[CLIENT_NAME]', createdQuote.clientName);
    text = text.replace('[SERVICE_TYPE]', createdQuote.clientVehicleOrService || 'serviços');
    text = text.replace('[TOTAL]', formatBRL(createdQuote.total));
    text = text.replace('[LINK]', viewLink);

    return `https://wa.me/${getCleanPhoneForWhatsApp(createdQuote.clientPhone)}?text=${encodeURIComponent(text)}`;
  };

  // Helper date adder
  const getValidityDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + validValueDays);
    return d.toLocaleDateString('pt-BR');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-zinc-900 dark:text-white">
            {step === 4 ? 'Proposta Comercial Pronta!' : 'Criar Nova Proposta'}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {step === 4 ? 'Envie para o cliente agora e acelere o fechamento comercial' : `Passo ${step} de 3 - ${step === 1 ? 'Identificação do Cliente' : step === 2 ? 'Escopo & Proposta' : 'Envio & Condições Comercial'}`}
          </p>
        </div>
        <button 
          onClick={onCancel}
          className="text-sm font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
        >
          {step === 4 ? 'Voltar ao App' : 'Cancelar'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Creation Form Block (Left) - 7 cols on desktop */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {errorMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-2xl flex items-center gap-2 mb-6"
              >
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </motion.div>
            )}

            {step === 1 && (
              <motion.div 
                key="step1" 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 10 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6"
              >
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-orange-500" />
                  Identificação do Cliente
                </h3>

                {/* Autocomplete sugestão de clientes */}
                <div className="relative">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Nome do Cliente *</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      setShowClientSuggested(true);
                    }}
                    onFocus={() => setShowClientSuggested(true)}
                    placeholder="Ex: Carlos Santos de Souza"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/35"
                    required
                  />
                  {showClientSuggested && savedClients.length > 0 && (
                    <div className="absolute left-0 right-0 z-20 mt-1.5 max-h-48 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl divide-y divide-zinc-100 dark:divide-zinc-800">
                      <div className="p-2 text-[10px] uppercase tracking-wider text-zinc-400 font-bold bg-zinc-50 dark:bg-zinc-950">Selecione cliente cadastrado</div>
                      {savedClients
                        .filter(c => c.name.toLowerCase().includes(clientName.toLowerCase()))
                        .map(client => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => handleQuickSelectClient(client)}
                            className="w-full text-left px-4 py-2.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 transition-colors flex justify-between items-center"
                          >
                            <div>
                              <span className="font-bold">{client.name}</span>
                              <span className="text-zinc-400 dark:text-zinc-500 ml-1">({client.phone})</span>
                            </div>
                            <span className="text-[9px] text-zinc-400 italic">{client.vehicleOrService}</span>
                          </button>
                        ))}
                      <button
                        type="button"
                        onClick={() => setShowClientSuggested(false)}
                        className="w-full text-center py-2 text-[10px] text-zinc-400 hover:text-orange-500 font-bold bg-zinc-50 dark:bg-zinc-950"
                      >
                        Fechar Sugestões
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">WhatsApp / Celular *</label>
                    <div className="relative">
                      <Phone className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="Ex: (11) 98765-4321"
                        className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/35"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">E-mail do Cliente</label>
                    <div className="relative">
                      <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="Ex: felipe@empresa.com"
                        className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Projeto / Escopo de Serviço</label>
                    <div className="relative">
                      <Briefcase className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={clientVehicleOrService}
                        onChange={(e) => setClientVehicleOrService(e.target.value)}
                        placeholder="Ex: Desenvolvimento Landing Page Premium & Branding"
                        className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Observações Adicionais (Aparece no Orçamento)</label>
                  <div className="relative">
                    <FileText className="w-5 h-5 absolute left-4 top-4 text-zinc-400" />
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Inclusos 3 meses de suporte e manutenção após a entrega das interfaces digitais de alta fidelidade."
                      className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-orange-500/10 flex items-center gap-2 active:scale-95"
                  >
                    Próximo Passo
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2" 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 10 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Tag className="w-5 h-5 text-orange-500" />
                    Adicionar Serviços & Itens
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3.5 py-2 bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 font-bold text-xs rounded-xl hover:bg-orange-100 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                  {items.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 space-y-3 relative group"
                    >
                      {/* Search Catalog Widget popup anchor */}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-bold text-zinc-400">Item #{index + 1}</span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Remover Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Title & Catalog selection */}
                        <div className="md:col-span-2 relative">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItemField(index, 'name', e.target.value)}
                            onFocus={() => setActiveItemIndexForServiceSearch(index)}
                            placeholder="Nome (Ex: Landing Page Premium ou Consultoria UX)"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                            required
                          />
                          
                          {/* Service catalog suggestions list */}
                          {activeItemIndexForServiceSearch === index && savedServices.length > 0 && (
                            <div className="absolute left-0 right-0 z-30 mt-1 max-h-36 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl scrollbar-thin">
                              <div className="p-2 text-[10px] uppercase tracking-wider text-zinc-400 font-bold bg-zinc-50 dark:bg-zinc-950 flex justify-between items-center">
                                <span>Importar do Catálogo</span>
                                <button type="button" onClick={() => setActiveItemIndexForServiceSearch(null)} className="text-red-500 hover:underline">Fechar</button>
                              </div>
                              {savedServices
                                .filter(s => s.name.toLowerCase().includes(item.name.toLowerCase()))
                                .map(service => (
                                  <button
                                    key={service.id}
                                    type="button"
                                    onClick={() => handleQuickInsertService(index, service)}
                                    className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-orange-950/20 hover:text-orange-600 transition-colors flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800"
                                  >
                                    <span className="font-bold">{service.name}</span>
                                    <span className="font-mono text-zinc-500">{formatBRL(service.unitPrice)}</span>
                                  </button>
                                ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdateItemField(index, 'description', e.target.value)}
                            placeholder="Descritivo do escopo / entregas"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* AI Sparkle action button */}
                      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800/60 pt-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleEnhanceWithAI(index)}
                          disabled={isEnhancingIndex === index}
                          className="px-3 py-1.5 bg-orange-500/10 text-[#FF9F1C] hover:bg-orange-500/20 border border-orange-500/20 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#FF9F1C] animate-pulse" />
                          {isEnhancingIndex === index ? 'Polindo Copywriter...' : 'Melhorar escopo com IA'}
                        </button>
                        <span className="text-[10px] text-zinc-400 italic">Conversão baseada em copy de alta relevância</span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] text-zinc-400 font-bold tracking-wider mb-1">Quantidade</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItemField(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 font-bold tracking-wider mb-1">Valor Unitário (R$)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice || ''}
                            onChange={(e) => handleUpdateItemField(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            placeholder="0,00"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none text-right font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-zinc-400 font-bold tracking-wider mb-1">Desconto (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discount || ''}
                            onChange={(e) => handleUpdateItemField(index, 'discount', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                            placeholder="Ex: 5"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none text-right"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-between border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white font-bold text-sm rounded-2xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-orange-500/10 flex items-center gap-2 active:scale-95"
                  >
                    Próximo Passo
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3" 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 10 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6"
              >
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  Validade & Pagamento
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Validade do Orçamento (Dias) *</label>
                    <select
                      value={validValueDays}
                      onChange={(e) => setValidValueDays(parseInt(e.target.value) || 10)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/35"
                    >
                      <option value={3}>3 Dias (Urgente)</option>
                      <option value={5}>5 Dias</option>
                      <option value={10}>10 Dias</option>
                      <option value={15}>15 Dias</option>
                      <option value={30}>30 Dias</option>
                    </select>
                    <p className="text-[10px] text-zinc-400 mt-1">Válido até o dia: {getValidityDateStr()}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Ajustes / Taxa Extra (Opcional)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold font-mono">R$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={taxes || ''}
                        onChange={(e) => setTaxes(parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                        className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/35 text-right font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Instruções de Pagamento / Cobrança</label>
                  <textarea
                    rows={4}
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(e.target.value)}
                    placeholder="Instruções de pagamento para o cliente..."
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/35"
                  />
                </div>

                <div className="pt-4 flex justify-between border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-white font-bold text-sm rounded-2xl transition-all flex items-center gap-1 active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={isSubmitting}
                    className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-emerald-500/10 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Gerando Orçamento...' : 'Gerar Orçamento Agora'}
                    <CheckCircle className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && createdQuote && (
              <motion.div 
                key="step4" 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-zinc-900 text-white border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6 relative"
              >
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/25 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle className="w-8 h-8" />
                </div>
                
                <div className="text-center">
                  <h3 className="text-xl font-display font-bold">Orçamento Gerado com Sucesso!</h3>
                  <p className="text-zinc-400 text-xs mt-1">Orçamento número #{createdQuote.quoteNumber} para {createdQuote.clientName}</p>
                </div>

                <div className="bg-zinc-950 p-4 border border-zinc-800 rounded-2xl font-mono text-xs break-all space-y-2">
                  <p className="font-bold text-zinc-500 uppercase tracking-widest text-[9px] mb-2">LINK DO ORÇAMENTO PARA O CLIENTE</p>
                  <p className="text-orange-400 select-all underline">{window.location.origin}?quoteId={createdQuote.id}</p>
                </div>

                <div className="space-y-3 pt-3">
                  <a
                    href={getWhatsAppLink()}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Send className="w-5 h-5" />
                    Enviar pelo WhatsApp ao Cliente
                  </a>

                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={`${window.location.origin}?quoteId=${createdQuote.id}`}
                      target="_blank"
                      className="py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-[10px] sm:text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Tela Cheia
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${window.location.origin}?quoteId=${createdQuote.id}`;
                        navigator.clipboard.writeText(link);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className={`py-3 font-bold text-[10px] sm:text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 ${linkCopied ? 'bg-emerald-600 text-white animate-pulse' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'}`}
                    >
                      <Copy className="w-4 h-4" />
                      {linkCopied ? 'Copiado!' : 'Copiar Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-[10px] sm:text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimir
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 text-center">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs text-zinc-400 hover:text-white font-medium underline"
                  >
                    Ir para o Dashboard
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Preview Column (Right) - 5 cols on desktop */}
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-zinc-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              Live Preview do Cliente
            </span>
            <span className="text-[10px] text-zinc-400 font-mono font-bold bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded">PDF-Ready</span>
          </div>

          {/* Quote Bill Mock Container */}
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-2xl relative text-zinc-950 dark:text-zinc-50 overflow-hidden font-sans border-t-[8px]" style={{ borderColor: userProfile?.quoteColor || '#f97316' }}>
            {/* Mock Header */}
            <div className="flex justify-between items-start gap-3 mb-6">
              <div>
                <h4 className="font-display font-extrabold text-base tracking-tight leading-tight uppercase">
                  {userProfile?.companyName || 'Sua Empresa'}
                </h4>
                <p className="text-[9px] text-zinc-400 font-mono mt-0.5">
                  {userProfile?.address || 'Seu Endereço de Negócio'}
                </p>
                <p className="text-[9px] text-zinc-400 font-mono">
                  WhatsApp: {formatPhone(userProfile?.whatsappNumber || '11999999999')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 rounded-md uppercase">ORÇAMENTO</span>
                <p className="text-xs font-bold font-mono text-zinc-500 dark:text-zinc-400 mt-1">#1040</p>
                <p className="text-[8px] text-zinc-400 font-mono">{new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* Mock Client Box */}
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl mb-5 text-[10px] sm:text-xs">
              <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">CLIENTE</p>
              <p className="font-bold text-zinc-900 dark:text-zinc-50 mt-0.5">{clientName || 'Nome do Cliente'}</p>
              <div className="flex justify-between items-center text-zinc-500 mt-1 text-[9px]">
                <span>Contatos: {clientPhone ? formatPhone(clientPhone) : '(00) 00000-0000'}</span>
                {clientVehicleOrService && <span className="font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800 rounded px-1">{clientVehicleOrService}</span>}
              </div>
            </div>

            {/* Mock items list */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-[8px] font-extrabold text-zinc-400 border-b pb-1 dark:border-zinc-800">
                <span>DESCRIÇÃO</span>
                <span className="text-right">SUBTOTAL</span>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-40 overflow-y-auto pr-1">
                {items.map((item, idx) => {
                  const itemSub = item.quantity * item.unitPrice;
                  const itemDisc = itemSub * (item.discount / 100);
                  const itemTotal = itemSub - itemDisc;
                  return (
                    <div key={item.id || idx} className="py-2 flex justify-between gap-2 text-[10px] leading-tight">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-zinc-800 dark:text-zinc-100 truncate">{item.name || `Item #${idx+1}`}</p>
                        {item.description && <p className="text-[8px] text-zinc-400 truncate">{item.description}</p>}
                        <span className="text-[8px] text-zinc-400">{item.quantity}un x {formatBRL(item.unitPrice)}</span>
                        {item.discount > 0 && <span className="text-[8px] text-emerald-500 font-bold ml-1.5">-{item.discount}%</span>}
                      </div>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium whitespace-nowrap align-bottom">{formatBRL(itemTotal)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mock Notes */}
            {notes && (
              <div className="p-3 bg-orange-100/10 border border-orange-500/10 rounded-2xl text-[9px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                <p className="font-bold text-zinc-700 dark:text-zinc-300 mb-0.5">Observações:</p>
                {notes}
              </div>
            )}

            {/* Calculations Panel */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400 text-[10px]">
                <span>Subtotal dos Serviços</span>
                <span className="font-mono">{formatBRL(subtotal)}</span>
              </div>

              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-500 font-bold text-[10px]">
                  <span>Descontos Aplicados</span>
                  <span className="font-mono">-{formatBRL(discountTotal)}</span>
                </div>
              )}

              {taxes > 0 && (
                <div className="flex justify-between text-zinc-450 text-[10px]">
                  <span>Ajustes / Taxa Extra</span>
                  <span className="font-mono">+{formatBRL(taxes)}</span>
                </div>
              )}

              <div className="flex justify-between items-center font-display font-extrabold text-sm border-t border-zinc-200 dark:border-zinc-800 pt-2" style={{ color: userProfile?.quoteColor || '#f97316' }}>
                <span>Valor Total</span>
                <span className="font-display font-bold font-mono py-1 px-3 bg-zinc-50 dark:bg-zinc-900 border rounded-xl">{formatBRL(total)}</span>
              </div>
            </div>

            {/* Validity Mock */}
            <div className="mt-5 border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-3 text-[8px] text-zinc-400 flex justify-between">
              <span>Validade: {validValueDays} dias (Até {getValidityDateStr()})</span>
              <span>Aprovável pelo telefone</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
