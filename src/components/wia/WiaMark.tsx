interface WiaMarkProps {
  className?: string;
  size?: number;
  accentColor?: string;
}

export default function WiaMark({ className = '', size = 28, accentColor = '#FF8A00' }: WiaMarkProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size, color: accentColor }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 19.5 10.7 5.6a1.45 1.45 0 0 1 2.6 0l7.2 13.9" />
      </svg>
    </span>
  );
}
