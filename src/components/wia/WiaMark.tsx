interface WiaMarkProps {
  className?: string;
  size?: number;
}

export default function WiaMark({ className = '', size = 28 }: WiaMarkProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-black/20 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/wia-monogram.png"
        alt="Monograma WIA"
        className="h-full w-full scale-[1.72] object-contain brightness-0 invert"
      />
    </span>
  );
}
