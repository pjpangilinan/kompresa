import type { ReactNode } from 'react';
import { GlitchStrip } from './GlitchStrip';

type PanelProps = {
  children: ReactNode;
  className?: string;
  glitch?: 'cyan' | 'success' | 'warning';
  shadow?: boolean;
};

export function Panel({
  children,
  className = '',
  glitch = 'cyan',
  shadow = true,
}: PanelProps) {
  return (
    <div
      className={`bg-surface-container-high border border-surface-container-highest overflow-hidden flex flex-col ${
        shadow ? 'shadow-cyber' : ''
      } ${className}`}
    >
      <GlitchStrip variant={glitch} />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
