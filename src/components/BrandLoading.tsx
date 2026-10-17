import OrktoLogo from './OrktoLogo';

export default function BrandLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`orkto-loader ${fullScreen ? 'orkto-loader--full' : ''}`}>
      <OrktoLogo size="lg" />
      <span className="orkto-loader-track" aria-hidden="true"><span /></span>
      <span className="orkto-loader-label">Preparando sua ORKTO…</span>
    </div>
  );
}
