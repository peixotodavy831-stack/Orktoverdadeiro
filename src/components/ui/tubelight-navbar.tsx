import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Users, Plus, Settings as SettingsIcon, FileText, LucideIcon } from 'lucide-react';

interface TubelightNavbarProps {
  currentView: 'landing' | 'auth' | 'dashboard' | 'quotes' | 'create_quote' | 'quote_detail' | 'clients' | 'services' | 'settings' | 'analytics';
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
    <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md pointer-events-none safe-area-bottom">
      <div 
        id="tubelight-pill-bar"
        className="pointer-events-auto bg-[#111111]/95 border border-zinc-800/80 rounded-full py-1.5 px-2 shadow-[0_12px_40px_rgba(0,0,0,0.65)] flex items-center justify-between relative backdrop-blur-xl"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          if (item.isSpecial) {
            return (
              <button
                key={item.id}
                id={`tubelight-btn-${item.id}`}
                onClick={() => handleTabClick(item)}
                className="relative flex flex-col items-center justify-center -mt-6 mx-1 transition-transform active:scale-95 duration-150 cursor-pointer"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div 
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    currentView === 'create_quote' 
                      ? 'bg-[#FF9F1C] text-zinc-950 shadow-[0_0_20px_rgba(255,159,28,0.5)]' 
                      : 'bg-zinc-900 border border-zinc-800 text-[#FF9F1C] hover:text-[#FF9F1C] shadow-lg'
                  }`}
                >
                  <Icon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-bold mt-1 text-zinc-400">
                  {item.label}
                </span>
                {currentView === 'create_quote' && (
                  <motion.div
                    layoutId="tubelight-indicator-dot"
                    className="absolute -bottom-1 w-1 h-1 bg-[#FF9F1C] rounded-full shadow-[0_0_8px_#FF9F1C]"
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  />
                )}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`tubelight-btn-${item.id}`}
              onClick={() => handleTabClick(item)}
              className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-full flex-1 transition-colors duration-300 cursor-pointer ${
                isActive ? 'text-[#FF9F1C]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
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
                    
                    {/* Glowing tubelight light bar on top of the active item */}
                    <motion.div
                      layoutId="tubelight-beam"
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#FF9F1C] rounded-full shadow-[0_0_10px_rgba(255,159,28,1),0_0_18px_rgba(255,159,28,0.6)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  </>
                )}
              </AnimatePresence>
              
              <Icon className="w-5 h-5 transition-transform duration-200" />
              <span className="text-[10px] font-bold mt-0.5 tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
