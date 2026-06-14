import React, { useState } from 'react';
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
  Pencil
} from 'lucide-react';
import { SavedClient, Quote, Timestamp } from '../types';
import { formatBRL, formatPhone } from '../utils/format';

interface ClientsPageProps {
  clients: SavedClient[];
  quotes: Quote[];
  userId: string;
  onClientAdded: (client: SavedClient) => void;
  onClientUpdated?: (client: SavedClient) => void;
  onClientDeleted?: (clientId: string) => void;
  onSelectQuote: (quoteId: string) => void;
}

export default function ClientsPage({ 
  clients, 
  quotes, 
  userId, 
  onClientAdded,
  onClientUpdated,
  onClientDeleted,
  onSelectQuote 
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

  // Form states (Edit Client)
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editVehicle, setEditVehicle] = useState('');
  const [editNotes, setEditNotes] = useState('');

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

      onClientAdded(newClient);
      setIsAddOpen(false);
      // Reset
      setNewName('');
      setNewPhone('');
      setNewVehicle('');
      setNewNotes('');
    } catch (err) {
      console.error(err);
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

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-all shadow-md shadow-orange-505/10 active:scale-95 text-center"
        >
          <UserPlus className="w-5 h-5" />
          Novo Cliente
        </button>
      </header>

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
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold font-display text-zinc-900 dark:text-white">Novo Cliente</h3>
                <button onClick={() => setIsAddOpen(false)} className="p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Nome do Cliente *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Pedro Alves Silva"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">WhatsApp / Celular *</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Escopo / Projeto Padrão</label>
                  <input
                    type="text"
                    value={newVehicle}
                    onChange={(e) => setNewVehicle(e.target.value)}
                    placeholder="Ex: Consultoria de Investimentos ou Desenvolvimento Web"
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Notas do Cliente</label>
                  <textarea
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
                              alert(`Não é possível excluir o cliente "${selectedClientHistory.name}" porque ele possui ${metrics.quoteCount} orçamento(s) cadastrado(s).\n\nPara garantir a integridade do seu Analytics e histórico de faturamento estruturado, a remoção está bloqueada.`);
                              return;
                            }
                            if (window.confirm(`Tem certeza de que deseja remover o cliente "${selectedClientHistory.name}" permanentemente? Esta ação é irreversível.`)) {
                              onClientDeleted?.(selectedClientHistory.id);
                              setSelectedClientHistory(null);
                            }
                          }}
                          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                          title="Excluir Cliente"
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
                  >
                    <X className="w-5 h-5" />
                  </button>
                </header>

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
                          onClientUpdated?.(updated);
                          setSelectedClientHistory(updated);
                          setIsEditing(false);
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
