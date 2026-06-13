import React from 'react';

interface OrktoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSlogan?: boolean;
  darkMode?: boolean;
  onlyO?: boolean;
}

export default function OrktoLogo({ 
  className = "", 
  size = 'md', 
  showSlogan = false, 
  darkMode = true,
  onlyO = false
}: OrktoLogoProps) {
  
  // Custom font configurations mimicking the clean technical uppercase style
  const containerClasses = {
    sm: 'gap-0.5',
    md: 'gap-0.5',
    lg: 'gap-1',
    xl: 'gap-1.5',
  };

  const textSizes = {
    sm: 'text-lg tracking-[0.03em] font-extrabold',
    md: 'text-2xl tracking-[0.04em] font-extrabold',
    lg: 'text-3xl tracking-[0.04em] font-extrabold',
    xl: 'text-5xl md:text-6xl tracking-[0.05em] font-black',
  };

  // Custom rounded-rectangle representing the app's signature "O" icon - removed extra margins to join the letters
  const oStyles = {
    sm: 'h-[14px] w-[18px] border-[3px] rounded-[4px]',
    md: 'h-[19px] w-[24px] border-[4.5px] rounded-[6px]',
    lg: 'h-[24px] w-[31px] border-[5.5px] rounded-[8px]',
    xl: 'h-[38px] w-[49px] md:h-[46px] md:w-[60px] border-[9px] md:border-[11px] rounded-[11px] md:rounded-[14px] shadow-[0_0_15px_rgba(255,159,28,0.15)]',
  };

  const sloganClasses = {
    sm: 'text-[6px] tracking-[0.2em] mt-1',
    md: 'text-[8.5px] tracking-[0.25em] mt-1.5 ',
    lg: 'text-[10px] tracking-[0.3em] mt-2',
    xl: 'text-[11px] md:text-xs tracking-[0.35em] mt-4',
  };

  const textTheme = darkMode ? "text-white" : "text-zinc-900";

  return (
    <div className={`flex flex-col items-center select-none font-display ${className}`}>
      <div className={`flex items-center leading-none ${containerClasses[size]}`}>
        {/* The "ORKT" part */}
        {!onlyO && (
          <span className={`${textSizes[size]} ${textTheme} uppercase`}>
            ORKT
          </span>
        )}
        
        {/* The signature orange "O" squircle */}
        <div 
          className={`${oStyles[size]} border-brand-orange shrink-0`}
          style={{ borderColor: '#FF9F1C' }}
        />
      </div>

      {showSlogan && !onlyO && (
        <div className={`${sloganClasses[size]} font-bold uppercase transition-all duration-300 text-center`}>
          <span className={darkMode ? "text-zinc-400" : "text-zinc-500"}>O orçamento </span>
          <span className="text-brand-orange" style={{ color: '#FF9F1C' }}>antes </span>
          <span className={darkMode ? "text-zinc-400" : "text-zinc-500"}>da concorrência.</span>
        </div>
      )}
    </div>
  );
}
