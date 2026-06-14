import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  Search, 
  Plus, 
  Trash2, 
  Pencil, 
  Check, 
  X, 
  Folder, 
  DollarSign, 
  Layers,
  HelpCircle,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { SavedService, AUTO_SERVICE_CATEGORIES, Timestamp } from '../types';
import { formatBRL, formatCurrency } from '../utils/format';

interface ServicesPageProps {
  services: SavedService[];
  userId: string;
  onServiceAdded: (service: SavedService) => void;
  onServiceUpdated: (service: SavedService) => void;
  onServiceDeleted: (serviceId: string) => void;
}

export default function ServicesPage({ 
  services, 
  userId, 
  onServiceAdded, 
  onServiceUpdated, 
  onServiceDeleted 
}: ServicesPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form States for creation
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [category, setCategory] = useState(AUTO_SERVICE_CATEGORIES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Inline Editing State (lets users change prices instantly on the list!)
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlinePriceValue, setInlinePriceValue] = useState<string>('');

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const serviceId = 'sv_' + Math.random().toString(36).substring(2, 9);
      const newService: SavedService = {
        id: serviceId,
        userId,
        name,
        description,
        unitPrice: Number(unitPrice) || 0,
        category,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      onServiceAdded(newService);
      setIsAddOpen(false);
      // Reset form
      setName('');
      setDescription('');
      setUnitPrice(0);
      setCategory(AUTO_SERVICE_CATEGORIES[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartInlineEdit = (service: SavedService) => {
    setInlineEditingId(service.id);
    setInlinePriceValue(service.unitPrice.toString());
  };

  const handleSaveInlinePrice = async (service: SavedService) => {
    const updatedPrice = parseFloat(inlinePriceValue);
    if (isNaN(updatedPrice) || updatedPrice < 0) return;

    try {
      onServiceUpdated({ ...service, unitPrice: updatedPrice, updatedAt: Timestamp.now() });
    } catch (err) {
      console.error(err);
    } finally {
      setInlineEditingId(null);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!window.confirm('Excluir este serviço do catálogo permanente?')) return;
    try {
      onServiceDeleted(serviceId);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (service.description && service.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header Panel */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-zinc-900 dark:text-white">
            Catálogo de Serviços
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Cadastre os serviços e itens recorrentes padrão para preencher novos orçamentos em 1 clique.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-orange-500/10 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Cadastrar Modelo
        </button>
      </header>

      {/* Filter and Search Layout columns split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Category Filters (Left on desktop) */}
        <div className="lg:col-span-1 space-y-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1 mb-4 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-orange-500" />
            Filtrar Categorias
          </h3>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${selectedCategory === 'all' ? 'bg-orange-500 text-white shadow-md shadow-orange-505/10' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
          >
            <span>Todas as Categorias</span>
            <span className="font-mono text-[9px] bg-white/15 px-1.5 py-0.5 rounded-md font-bold">{services.length}</span>
          </button>
          
          <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-2 space-y-1">
            {AUTO_SERVICE_CATEGORIES.map(cat => {
              const count = services.filter(s => s.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${selectedCategory === cat ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-850'}`}
                >
                  <span className="truncate">{cat}</span>
                  <span className="font-mono text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-400 px-1.5 py-0.5 rounded-md font-bold group-hover:bg-orange-500 group-hover:text-white">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Catalog templates listing (Right side) - 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar serviço no catálogo pelo nome ou detalhes..."
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium dark:text-white"
            />
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
            {filteredServices.length === 0 ? (
              <div className="p-16 text-center">
                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-zinc-300 dark:text-zinc-650" />
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 font-bold mb-1">Filtro de Serviços Vazio</p>
                <button
                  onClick={() => setIsAddOpen(true)}
                  className="text-xs text-orange-500 hover:underline font-bold mt-2"
                >
                  Criar primeiro modelo agora
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredServices.map(service => (
                  <div 
                    key={service.id} 
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-all group"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 px-2 py-0.5 bg-orange-50 dark:bg-orange-500/10 rounded-md border border-orange-100 dark:border-orange-500/20 font-sans uppercase">
                          {service.category}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm sm:text-base text-zinc-900 dark:text-white">{service.name}</h4>
                      {service.description && (
                        <p className="text-xs text-zinc-400 font-medium mt-1">{service.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-zinc-100 dark:border-zinc-800 sm:border-0 pt-3 sm:pt-0">
                      {/* Interactive inline editing for quick price adjustment */}
                      <div className="text-right">
                        {inlineEditingId === service.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono font-bold text-zinc-400">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={inlinePriceValue}
                              onChange={(e) => setInlinePriceValue(e.target.value)}
                              className="w-20 px-2 py-1 border border-orange-500 bg-white dark:bg-zinc-950 font-bold font-mono text-xs rounded-lg focus:outline-none dark:text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveInlinePrice(service)}
                              className="p-1 text-green-500 hover:bg-green-50 dark:hover:bg-green-950/20 rounded-lg transition-colors"
                              title="Salvar preço"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setInlineEditingId(null)}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 rounded-lg transition-colors"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="cursor-pointer" onClick={() => handleStartInlineEdit(service)}>
                            <p className="text-emerald-600 font-display font-bold text-base sm:text-lg font-mono">
                              {formatBRL(service.unitPrice)}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-medium leading-none hover:underline flex items-center gap-0.5 justify-end mt-0.5">
                              <Pencil className="w-2.5 h-2.5" /> Clique para editar
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteService(service.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/10 lg:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        title="Remover Serviço"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Creational Dialog modal */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setIsAddOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] p-8 shadow-2xl overflow-hidden outline-none"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold font-display text-zinc-900 dark:text-white">Cadastrar Modelo</h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-450"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleCreateService} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Nome do Serviço / Item *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Consultoria Estratégica de Marca ou Desenvolvimento Web"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Descrição / Marca Modelo</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Inclui manual de marca completo, vetores e manual de tom de voz"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Categoria *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                    >
                      {AUTO_SERVICE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Preço Base (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={unitPrice || ''}
                      onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                      placeholder="0,00"
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none text-right font-mono text-zinc-900 dark:text-white"
                      required
                    />
                  </div>
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
                    Salvar Modelo
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
