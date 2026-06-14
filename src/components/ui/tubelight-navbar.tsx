import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Users, Plus, Settings as SettingsIcon, FileText } from 'lucide-react';

interface TubelightNavbarProps {
  currentView: 'landing' | 'auth' | 'dashboard' | 'quotes' | 'create_quote' | 'quote_detail' | 'clients' | 'services' | 'settings' | 'analytics' | 'billing';
  setCurrentView: (view: any) => void;
  setSelectedQuoteId: (id: any) => void;
}

export default function TubelightNavbar({
  currentView,
  setCurrentView,
  setSelectedQuoteId,
}: TubelightNavbarProps) {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  useEffect(() => {
    setActiveTab(currentView);
  }, [currentView]);

  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: Home, view: 'dashboard' as const },
    { id: 'quotes', label: 'Orçamentos', icon: FileText, view: 'quotes' as const },
    { id: 'create_quote', label: 'Novo', icon: Plus, view: 'create_quote' as const, isSpecial: true },
    { id: 'clients', label: 'Clientes', icon: Users, view: 'clients' as const },
    { id: 'settings', label: 'Ajustes', icon: SettingsIcon, view: 'settings' as const },
  ];

  const handleTabClick = (item: typeof navItems[0]) => {
    setActiveTab(item.id);
    setSelectedQuoteId(null);
    setCurrentView(item.view);
  };

  return (
    <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-[360px] pointer-events-none safe-area-bottom">
      <div 
        id="tubelight-pill-bar"
        className="pointer-events-auto bg-[#111111]/95 border border-zinc-850 rounded-full h-14 px-2.5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] flex items-center justify-between relative backdrop-blur-xl"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          if (item.isSpecial) {
            const isSpecialActive = currentView === 'create_quote';
            return (
              <button
                key={item.id}
                id={`tubelight-btn-${item.id}`}
                onClick={() => handleTabClick(item)}
                className="relative flex items-center justify-center w-11 h-11 rounded-full transition-colors duration-300 cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
                title={item.label}
              >
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center absolute -top-5 transition-all duration-300 shadow-lg border ${
                    isSpecialActive 
                      ? 'bg-[#FF9F1C] text-zinc-950 border-[#FF9F1C] shadow-[0_4px_20px_rgba(255,159,28,0.45)] scale-105' 
                      : 'bg-zinc-900 border-zinc-800 text-[#FF9F1C] hover:bg-zinc-850 hover:scale-105'
                  }`}
                >
                  <Icon className="w-5.5 h-5.5 stroke-[2.5]" />
                </div>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`tubelight-btn-${item.id}`}
              onClick={() => handleTabClick(item)}
              className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-colors duration-300 cursor-pointer ${
                isActive ? 'text-[#FF9F1C]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
              title={item.label}
            >
              <AnimatePresence>
                {isActive && (
                  <>
                    {/* Background capsule overlay */}
                    <motion.div
                      layoutId="tubelight-active-bg"
                      className="absolute inset-0 bg-[#FF9F1C]/10 rounded-full -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                    
                    {/* Glowing tubelight light bar on top of active item */}
                    <motion.div
                      layoutId="tubelight-beam"
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#FF9F1C] rounded-full shadow-[0_0_10px_rgba(255,159,28,1),0_0_18px_rgba(255,159,28,0.6)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  </>
                )}
              </AnimatePresence>
              
              <Icon className="w-5.5 h-5.5 transition-transform duration-200" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
