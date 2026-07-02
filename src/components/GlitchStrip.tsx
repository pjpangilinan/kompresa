type GlitchStripProps = {
  variant?: 'cyan' | 'success' | 'warning';
};

export function GlitchStrip({ variant = 'cyan' }: GlitchStripProps) {
  const colorClass =
    variant === 'success'
      ? 'bg-success'
      : variant === 'warning'
      ? 'bg-warning'
      : 'bg-primary-container';
  return (
    <div className={`w-full h-1.5 ${colorClass}`}>
      <div
        className="w-full h-full"
        style={{
          clipPath:
            'polygon(0 0, 20% 0, 25% 100%, 35% 100%, 40% 0, 60% 0, 65% 100%, 80% 100%, 85% 0, 100% 0, 100% 100%, 0 100%)',
        }}
      />
    </div>
  );
}
