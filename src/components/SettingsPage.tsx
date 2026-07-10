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
  Mail,
  Table as TableIcon,
  CheckCircle2
} from 'lucide-react';
import { UserProfile, Timestamp } from '../types';
import { googleSignIn, logout as googleLogout, getAccessToken } from '../lib/firebaseAuth';

interface SettingsPageProps {
  userProfile: UserProfile | null;
  onProfileUpdated: (profile: UserProfile) => void;
}

export default function SettingsPage({ userProfile, onProfileUpdated }: SettingsPageProps) {
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  useEffect(() => {
    getAccessToken().then(token => setGoogleToken(token));
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        setGoogleToken(res.accessToken);
        alert('Conta do Google conectada com sucesso para sincronização do Sheets e envio com Gmail!');
      }
    } catch (e: any) {
      alert('Erro ao conectar com o Google: ' + e.message);
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (confirm('Deseja realmente desconectar sua conta do Google?')) {
      await googleLogout();
      setGoogleToken(null);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // States
  const [companyName, setCompanyName] = useState(userProfile?.companyName || '');
  const [taxID, setTaxID] = useState(userProfile?.taxID || '');
  const [companyLogo, setCompanyLogo] = useState(userProfile?.companyLogo || '');
  const [isDragging, setIsDragging] = useState(false);

  const handleLogoFile = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Por favor, envie um arquivo de imagem válido (PNG ou JPG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setCompanyLogo(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const [whatsappNumber, setWhatsappNumber] = useState(userProfile?.whatsappNumber || '');
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    userProfile?.whatsappTemplate || 
    'Olá *[CLIENT_NAME]*, aqui está a proposta comercial de *[SERVICE_TYPE]* no valor de *[TOTAL]*. Clique no link abaixo para visualizar todos os detalhes e aprovar online com 1 clique:\n\n*[LINK]*'
  );
  const [paymentInfo, setPaymentInfo] = useState(
    userProfile?.paymentInfo || 
    'Chave Pix CNPJ: 14.502.836/0001-90\nBanco Cora - Favorecido: Orkto Pro Solutions Ltda'
  );
  const [quoteColor, setQuoteColor] = useState(userProfile?.quoteColor || '#FF9F1C');
  const [address, setAddress] = useState(userProfile?.address || '');

  // Live Preview Placeholder custom state
  const [previewClientName, setPreviewClientName] = useState('Felipe Albuquerque');
  const [previewServiceType, setPreviewServiceType] = useState(
    userProfile?.profession ? `${userProfile.profession} Personalizado` : 'Instalação Elétrica Premium'
  );
  const [previewTotal, setPreviewTotal] = useState('R$ 1.850,00');
  const [previewLink, setPreviewLink] = useState('https://orkto.com/q/74921x');

  // Notifications Toggles (Simulated options)
  const [notifyView, setNotifyView] = useState(true);
  const [notifyApprove, setNotifyApprove] = useState(true);

  const colorsOption = [
    { name: 'Laranja Orkto', hex: '#FF9F1C' },
    { name: 'Azul Stripe Elegante', hex: '#2563eb' },
    { name: 'Verde Fintech Pix', hex: '#16a34a' },
    { name: 'Vermelho Linear Estilo', hex: '#dc2626' },
    { name: 'Cinza Apple Minimalista', hex: '#4b5563' }
  ];

  const handleInjectPlaceholder = (placeholder: string) => {
    setWhatsappTemplate(prev => prev + placeholder);
  };

  const renderFormattedPreview = (text: string) => {
    let filled = text
      .replace(/\[CLIENT_NAME\]/g, previewClientName || '[CLIENT_NAME]')
      .replace(/\[SERVICE_TYPE\]/g, previewServiceType || '[SERVICE_TYPE]')
      .replace(/\[TOTAL\]/g, previewTotal || '[TOTAL]')
      .replace(/\[LINK\]/g, previewLink || '[LINK]');

    const parts = filled.split('*');
    return (
      <span className="whitespace-pre-wrap text-[12px] sm:text-[13px] font-sans leading-relaxed text-zinc-900 dark:text-zinc-100">
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            return <strong key={index} className="font-extrabold text-black dark:text-white">{part}</strong>;
          }
          return part;
        })}
      </span>
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setIsSaving(true);
    setSuccess(false);

    try {
      const userUid = userProfile?.uid || 'anonymous';
      const updatedProfile: UserProfile = {
        uid: userUid,
        displayName: userProfile?.displayName || 'Dono do Negócio',
        email: userProfile?.email || 'noreply@gmail.com',
        photoURL: userProfile?.photoURL || null,
        createdAt: userProfile?.createdAt || Timestamp.now(),
        onboardingCompleted: true,
        companyName,
        taxID,
        companyLogo,
        whatsappNumber,
        whatsappTemplate,
        paymentInfo,
        quoteColor,
        address
      };

      onProfileUpdated(updatedProfile);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
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
            Personalize os dados da sua empresa, a cor do orçamento digital e as mensagens padrão do WhatsApp.
          </p>
        </div>
      </header>

      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center gap-2 text-xs font-bold">
          <Check className="w-5 h-5 shrink-0" />
          Configurações salvas com sucesso! Suas alterações já estão ativas nos novos orçamentos.
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
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCompanyLogo(''); }}
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
                  <p className="text-[10px] text-zinc-400">Até 2MB. Formatos aceitos: PNG, JPG, JPEG, SVG ou GIF.</p>
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

        {/* Google Workspace Integration Settings Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-500" />
              Integração Google Workspace
            </h3>
            {googleToken ? (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 leading-none">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Conectado
              </span>
            ) : (
              <span className="text-[10px] bg-zinc-500/10 text-zinc-400 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 leading-none">
                Não Conectado
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              <p className="text-xs text-zinc-550 dark:text-zinc-450 leading-relaxed">
                Habilite o envio direto de orçamentos e propostas em formato HTML via seu e-mail do <strong className="text-zinc-800 dark:text-zinc-200">Gmail</strong> e a sincronização instantânea do pipeline comercial com o <strong className="text-zinc-800 dark:text-zinc-200">Google Sheets</strong>.
              </p>
              <div className="pt-2 text-[11px] text-zinc-500 leading-relaxed font-medium">
                🔒 Seus dados são transmitidos de forma segura através dos canais de autorização oficiais do Google com total sigilo e permissão controlada de dados.
              </div>
            </div>

            <div className="flex flex-col items-center sm:items-start lg:items-end justify-center">
              {googleToken ? (
                <div className="space-y-3 w-full sm:max-w-xs text-center lg:text-right">
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-left">
                    <p className="text-[11px] font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5 leading-none mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Serviços Ativos:
                    </p>
                    <ul className="text-[10px] text-zinc-500 space-y-1 pl-3.5 list-disc mt-1.5 font-bold">
                      <li>Sincronização Google Sheets</li>
                      <li>Envio de Notas via Gmail</li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    className="w-full py-2.5 bg-red-650 hover:bg-red-700 hover:text-white dark:hover:bg-red-950/45 dark:bg-red-500/10 border border-red-200 dark:border-red-950 text-red-500 font-extrabold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Desconectar Conta Google
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-4 bg-zinc-950 hover:bg-zinc-900 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-950 border border-zinc-800 dark:border-zinc-200 rounded-full text-xs font-bold transition-all shadow-xl active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
                  </svg>
                  <span>{isConnectingGoogle ? 'Conectando...' : 'Conectar Google Workspace'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: WhatsApp Send Message Template Customization with Live Preview */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-orange-500" />
              Notificação por WhatsApp (Template)
            </h3>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 leading-none">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Live Sync ativa
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor Input Block */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Redija sua Mensagem</label>
                <textarea
                  rows={6}
                  value={whatsappTemplate}
                  onChange={(e) => setWhatsappTemplate(e.target.value)}
                  placeholder="Redija o texto com markdown padrão..."
                  className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 font-sans leading-relaxed"
                />
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Clique para inserir variáveis inteligentes:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleInjectPlaceholder(' [CLIENT_NAME]')}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:text-orange-500 text-[11px] font-bold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    + Nome Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjectPlaceholder(' [SERVICE_TYPE]')}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:text-orange-500 text-[11px] font-bold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    + Tipo Serviço
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjectPlaceholder(' [TOTAL]')}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:text-orange-500 text-[11px] font-bold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    + Total (R$)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInjectPlaceholder(' [LINK]')}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:text-orange-500 text-[11px] font-bold transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    + Link Proposta
                  </button>
                </div>
              </div>

              {/* Visual Editor Customizing values of the placeholders */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-100 dark:border-zinc-850 space-y-3">
                <div className="flex items-center gap-1.5 border-b border-zinc-200 dark:border-zinc-800/80 pb-2 mb-1">
                  <Palette className="w-4 h-4 text-orange-500" />
                  <span className="text-[11px] font-extrabold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    Simulador: Testar Valores dos Placeholders
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      [CLIENT_NAME] (Nome p/ Teste)
                    </label>
                    <input
                      type="text"
                      value={previewClientName}
                      onChange={(e) => setPreviewClientName(e.target.value)}
                      placeholder="Felipe Albuquerque"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      [SERVICE_TYPE] (Serviço p/ Teste)
                    </label>
                    <input
                      type="text"
                      value={previewServiceType}
                      onChange={(e) => setPreviewServiceType(e.target.value)}
                      placeholder="Instalação Elétrica Premium"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      [TOTAL] (Total p/ Teste)
                    </label>
                    <input
                      type="text"
                      value={previewTotal}
                      onChange={(e) => setPreviewTotal(e.target.value)}
                      placeholder="R$ 1.850,00"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
                      [LINK] (Link p/ Teste)
                    </label>
                    <input
                      type="text"
                      value={previewLink}
                      onChange={(e) => setPreviewLink(e.target.value)}
                      placeholder="https://orkto.com/q/74921x"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Simulated Smartphone Chat Preview Container */}
            <div className="flex flex-col">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Live Preview no WhatsApp</label>
              
              <div className="flex-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col shadow-xl">
                {/* Simulated Header */}
                <div className="bg-[#075e54] text-white px-4 py-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-[11px] text-zinc-100 uppercase shrink-0">
                      {(previewClientName || 'Cliente').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold truncate">{previewClientName || 'Felipe Albuquerque'} (Cliente)</p>
                      <p className="text-[9px] text-[#25d366] font-bold">Online</p>
                    </div>
                  </div>
                </div>

                {/* Simulated message wrapper with wallpaper pattern color */}
                <div className="flex-1 p-4 bg-[#efeae2] dark:bg-[#0b141a] overflow-y-auto space-y-3 min-h-[220px] max-h-[360px]">
                  {/* Message bubble from owner (sent) */}
                  <div className="flex justify-end animate-fade-in">
                    <div className="relative max-w-[90%] bg-[#d9fdd3] dark:bg-[#005c4b] p-3 rounded-[18px] rounded-tr-none shadow-md text-zinc-900 dark:text-stone-100 flex flex-col transition-all duration-300">
                      {renderFormattedPreview(whatsappTemplate)}
                      
                      {/* Checkmarks and simulated time */}
                      <span className="text-[9px] text-zinc-500 dark:text-zinc-350 ml-auto mt-2 flex items-center gap-1">
                        <span>12:30</span>
                        <span className="text-blue-500 dark:text-emerald-300">✓✓</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            <p className="text-xs text-zinc-500">Insira a chave e instruções de pagamento padrão para aparecer no rodapé de cada boleto.</p>
            
            <textarea
              rows={6}
              value={paymentInfo}
              onChange={(e) => setPaymentInfo(e.target.value)}
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm focus:outline-none"
              placeholder="Instruções de pagamento..."
            />
          </div>
        </div>

        {/* Row 4: Asaas Integration */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-500" />
            Integração Asaas (Pagamentos)
          </h3>
          <p className="text-xs text-zinc-500">Insira sua API Key do Asaas para habilitar assinaturas recorrentes nos planos Pro e Business.</p>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5">API Key Asaas</label>
            <input
              type="password"
              value={userProfile?.asaasApiKey || ''}
              onChange={(e) => onProfileUpdated({ ...userProfile!, asaasApiKey: e.target.value } as UserProfile)}
              placeholder="$aas_sk_sua_chave_aqui"
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
            />
          </div>
          <p className="text-[10px] text-zinc-400">Obtenha sua chave em <code className="text-orange-500 text-[9px]">asaas.com/configuracoes/api</code></p>
        </div>

        {/* Row 5: Simulated App Notifications options */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase text-zinc-400 tracking-wider mb-2">Avisos e Lembretes (Simulado)</h3>
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-bold">Lembrete de expiração de orçamentos pendentes</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Dispare um alerta quando o orçamento estiver a 24 horas de vencer.</p>
            </div>
            <input 
              type="checkbox" 
              checked={notifyView} 
              onChange={() => setNotifyView(!notifyView)} 
              className="accent-orange-500 w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between py-1 border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
            <div>
              <p className="text-xs font-bold">Notificações por e-mail de faturamento fechado</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">Receba avisos instantâneos com dados do caixa consolidado.</p>
            </div>
            <input 
              type="checkbox" 
              checked={notifyApprove} 
              onChange={() => setNotifyApprove(!notifyApprove)} 
              className="accent-orange-500 w-4 h-4"
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
