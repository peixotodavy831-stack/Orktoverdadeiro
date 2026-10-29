import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  Briefcase, 
  Phone, 
  MessageSquare, 
  CreditCard, 
  Palette, 
  Save, 
  Check, 
  AlertCircle, 
  ArrowRight, 
  Sparkles,
  Users,
  MapPin,
  Upload,
  Trash2,
  Image,
  Table as TableIcon
} from 'lucide-react';
import { UserProfile, Timestamp } from '../types';
import { supabase } from '../lib/supabase';


interface SettingsPageProps {
  userProfile: UserProfile | null;
  onOpenWia?: () => void;
  onOpenIntegrations?: () => void;
  onProfileUpdated: (profile: UserProfile) => void | Promise<void>;
}

export default function SettingsPage({ userProfile, onProfileUpdated, onOpenWia, onOpenIntegrations }: SettingsPageProps) {


  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // States
  const [companyName, setCompanyName] = useState(userProfile?.companyName || '');
  const [taxID, setTaxID] = useState(userProfile?.taxID || '');
  const [companyLogo, setCompanyLogo] = useState(userProfile?.companyLogo || '');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleLogoFile = (file: File) => {
    if (!file) return;
    const acceptedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      alert('Envie um arquivo PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('O logotipo deve ter no máximo 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCompanyLogo(e.target.result as string);
        setLogoFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const [whatsappNumber, setWhatsappNumber] = useState(userProfile?.whatsappNumber || '');
  const whatsappTemplate = userProfile?.whatsappTemplate || '';
  const [paymentInfo, setPaymentInfo] = useState(userProfile?.paymentInfo || '');
  const [quoteColor, setQuoteColor] = useState(userProfile?.quoteColor || '#FF9F1C');
  const [address, setAddress] = useState(userProfile?.address || '');

  const colorsOption = [
    { name: 'Laranja Orkto', hex: '#FF9F1C' },
    { name: 'Azul Stripe Elegante', hex: '#2563eb' },
    { name: 'Verde Fintech Pix', hex: '#16a34a' },
    { name: 'Vermelho Linear Estilo', hex: '#dc2626' },
    { name: 'Cinza Apple Minimalista', hex: '#4b5563' }
  ];

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setIsSaving(true);
    setSuccess(false);
    setSaveError('');

    try {
      const userUid = userProfile?.uid || 'anonymous';
      let persistedLogo = companyLogo;
      if (logoFile) {
        if (userUid === 'anonymous') throw new Error('Sua sessão expirou. Entre novamente.');
        const extension = logoFile.type === 'image/png' ? 'png' : logoFile.type === 'image/webp' ? 'webp' : 'jpg';
        const storagePath = `${userUid}/logo.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(storagePath, logoFile, { upsert: true, contentType: logoFile.type, cacheControl: '3600' });
        if (uploadError) throw new Error(`Não foi possível enviar o logotipo: ${uploadError.message}`);
        const { data } = supabase.storage.from('company-logos').getPublicUrl(storagePath);
        persistedLogo = `${data.publicUrl}?v=${Date.now()}`;
      }
      const updatedProfile: UserProfile = {
        uid: userUid,
        displayName: userProfile?.displayName || 'Dono do Negócio',
        email: userProfile?.email || 'noreply@gmail.com',
        photoURL: userProfile?.photoURL || null,
        createdAt: userProfile?.createdAt || Timestamp.now(),
        onboardingCompleted: true,
        companyName,
        taxID,
        companyLogo: persistedLogo,
        whatsappNumber,
        whatsappTemplate,
        paymentInfo,
        quoteColor,
        address
      };

      await onProfileUpdated(updatedProfile);
      setCompanyLogo(persistedLogo);
      setLogoFile(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12">
      {/* Settings header */}
      <header className="mb-8 flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            <Settings className="w-8 h-8 text-orange-500" />
            Configurações do Sistema
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Configure os dados da empresa, a identidade das propostas e o atendimento com a WIA.
          </p>
        </div>
      </header>

      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center gap-2 text-xs font-bold">
          <Check className="w-5 h-5 shrink-0" />
          Configurações salvas com sucesso! Suas alterações já estão ativas nos novos orçamentos.
        </div>
      )}

      {saveError && (
        <div role="alert" className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center gap-2 text-xs font-bold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {saveError}
        </div>
      )}

      {/* Main Settings Form split rows block */}
      <form onSubmit={handleSaveSettings} className="space-y-8">
        
        {/* Row 1: Profile & Company Name */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-orange-500" />
            Perfil da Empresa
          </h3>

          {/* Logo Drag-and-Drop & Manual Selection Uploader Container */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">Inclusão de Logotipo da Marca (Opcional)</label>
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleLogoFile(file); }}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center gap-3 relative cursor-pointer group ${
                isDragging ? 'border-[#FF9F1C] bg-[#FF9F1C]/5' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-950/20'
              }`}
            >
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoFile(file); }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" 
              />
              {companyLogo ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 relative z-20 pointer-events-auto">
                  <div className="w-20 h-20 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2 flex items-center justify-center overflow-hidden">
                    <img src={companyLogo} alt="Logo de sua marca" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="text-left space-y-1">
                    <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Logotipo Carregado com Sucesso</p>
                    <p className="text-[10px] text-zinc-400">Este logotipo aparecerá no cabeçalho das suas propostas e links.</p>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCompanyLogo(''); setLogoFile(null); }}
                      className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/25 text-red-500 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 mt-1.5 cursor-pointer relative z-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remover Logotipo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 py-1.5 select-none pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto text-orange-500">
                    <Upload className="w-5 h-5 animate-bounce" />
                  </div>
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Arraste o arquivo do seu logo aqui ou <span className="text-orange-500 hover:underline cursor-pointer font-extrabold">clique para selecionar</span>
                  </p>
                  <p className="text-[10px] text-zinc-400">Até 2MB. Formatos aceitos: PNG, JPG, JPEG ou WebP.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Nome do Estabelecimento *</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Acme Consulting & Tech Agency"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">CNPJ ou CPF (Opcional)</label>
              <input
                type="text"
                value={taxID}
                onChange={(e) => setTaxID(e.target.value)}
                placeholder="Ex: 00.000.000/0001-00"
                className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">WhatsApp para Contato</label>
              <div className="relative">
                <Phone className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="Ex: 11987654321"
                  className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>
              <p className="text-[10px] text-zinc-400 mt-1">Insira somente os dígitos incluindo DDD, sem espaços ou traços.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Endereço de Negócio (Aparece no Cabeçalho)</label>
            <div className="relative">
              <MapPin className="w-5 h-5 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Av. das Nações Unidas, 1200 - Centro, São Paulo"
                className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>



        <section className="rounded-3xl border p-6 orkto-product-border orkto-product-surface space-y-4" aria-labelledby="settings-wia-title">
          <h3 id="settings-wia-title" className="flex items-center gap-2 text-lg font-semibold"><Sparkles size={20} aria-hidden="true"/>Mensagens com a WIA</h3>
          <p className="max-w-2xl text-sm leading-6 orkto-product-muted">Descreva o atendimento na WIA, revise o rascunho e confirme o próximo passo. Os dados do cliente e da proposta devem vir dos registros da empresa.</p>
          <p className="max-w-2xl text-sm leading-6 orkto-product-muted">A disponibilidade da IA e do envio depende das integrações e dos limites aprovados. Preparar uma mensagem não significa enviá-la.</p>
          <div className="flex flex-wrap gap-3"><button type="button" disabled={!onOpenWia} onClick={onOpenWia} className="min-h-11 rounded-full px-5 orkto-product-primary">Preparar mensagem na WIA</button><button type="button" disabled={!onOpenIntegrations} onClick={onOpenIntegrations} className="min-h-11 rounded-full border px-5 orkto-product-border">Ver conexão do WhatsApp</button></div>
        </section>

        {/* Row 3: Colors Branding Accent and Pix info defaults */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Colors box */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-4">
                <Palette className="w-5 h-5 text-orange-500" />
                Tema Visual da Cobrança
              </h3>
              <p className="text-xs text-zinc-500 mb-6">A cor será aplicada no topo e em botões cruciais do Link do Cliente.</p>
              
              <div className="space-y-3">
                {colorsOption.map(color => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => setQuoteColor(color.hex)}
                    className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-2xl text-left hover:border-orange-500 group transition-all"
                  >
                    <div className="flex items-center gap-2.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      <div className="w-5 h-5 rounded-lg border shadow-inner" style={{ backgroundColor: color.hex }} />
                      <span>{color.name}</span>
                    </div>
                    {quoteColor === color.hex && <Check className="w-4 h-4 text-orange-500" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Pix Instructions box */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              Pix / Destaques Gerais
            </h3>
            <p className="text-xs text-zinc-500">Instruções de pagamento podem aparecer na proposta. Este campo não cria cobrança nem confirma pagamento.</p>
            
            <textarea
              rows={6}
              value={paymentInfo}
              onChange={(e) => setPaymentInfo(e.target.value)}
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
              placeholder="Instruções de pagamento..."
            />
          </div>
        </div>

        {/* Bottom submit row */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-10 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm rounded-2xl transition-all shadow-xl shadow-orange-500/20 flex items-center gap-2 active:scale-95"
          >
            {isSaving ? 'Gravando Configurações...' : 'Salvar Alterações'}
            <Save className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
