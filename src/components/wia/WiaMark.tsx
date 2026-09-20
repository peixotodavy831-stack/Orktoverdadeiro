interface WiaMarkProps {
  className?: string;
  size?: number;
}

export default function WiaMark({ className = '', size = 28 }: WiaMarkProps) {
  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-lg bg-black ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/wia-symbol.jpg"
        alt="Símbolo da WIA"
        className="h-full w-full scale-[1.45] object-cover"
      />
    </span>
  );
}
