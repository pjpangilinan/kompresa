type ProgressBarProps = {
  value: number;
  label?: string;
  showPercent?: boolean;
};

export function ProgressBar({ value, label, showPercent = true }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between font-label-mono text-label-mono text-primary-container mb-1">
          {label ? <span>{label}</span> : <span />}
          {showPercent ? <span>{clamped}%</span> : null}
        </div>
      )}
      <div
        className="w-full h-2 bg-surface-container-highest overflow-hidden"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-primary-container -skew-x-12 origin-left transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
