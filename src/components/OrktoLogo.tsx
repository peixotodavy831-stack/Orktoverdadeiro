interface OrktoLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSlogan?: boolean;
  darkMode?: boolean;
  /** Compact symbol, retained for existing callers. */
  onlyO?: boolean;
  accentColor?: string;
}

const symbolSizes = { sm: 32, md: 40, lg: 52, xl: 80 };
const wordmarkWidths = { sm: 100, md: 130, lg: 170, xl: 260 };

export default function OrktoLogo({ className = '', size = 'md', showSlogan = false, darkMode = true, onlyO = false }: OrktoLogoProps) {
  return (
    <span role="img" aria-label="ORKTO" className={`inline-flex shrink-0 flex-col items-center select-none ${className}`}>
      <span aria-hidden="true" className="flex items-center gap-2.5 leading-none">
        <img src="/brand/orkto-symbol.svg" alt="" width={symbolSizes[size]} height={symbolSizes[size]} className="shrink-0 object-contain" />
        {!onlyO && (
          <img
            src="/brand/orkto-wordmark.svg"
            alt=""
            width={wordmarkWidths[size]}
            height={Math.round(wordmarkWidths[size] * 365 / 1547)}
            className="h-auto shrink-0 object-contain"
            style={{ width: wordmarkWidths[size], filter: darkMode ? 'brightness(0) invert(1)' : 'brightness(0)' }}
          />
        )}
      </span>
      {showSlogan && !onlyO && <span aria-hidden="true" className={`mt-2 text-[9px] font-semibold uppercase tracking-[0.16em] ${darkMode ? 'text-zinc-400' : 'text-zinc-500'}`}>Operação com inteligência</span>}
    </span>
  );
}
