import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = 'primary',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'relative font-headline-md text-headline-md uppercase tracking-wide py-4 px-8 w-full transform -skew-x-6 transition-all flex items-center justify-center gap-4 select-none';
  const variants: Record<Variant, string> = {
    primary:
      'bg-primary-container hover:bg-primary text-on-primary-container hover:-translate-y-1 hover:shadow-[0px_6px_0px_0px_rgba(255,255,255,0.2)] clip-button',
    ghost:
      'bg-transparent border-2 border-primary-container text-primary-container hover:bg-primary-container hover:text-on-primary-container',
  };
  const disabledCls =
    disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer';

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${disabledCls} ${className}`}
    >
      <span className="skew-x-6 flex items-center gap-4">
        {loading ? (
          <span
            className="material-symbols-outlined text-[28px] animate-spin"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            progress_activity
          </span>
        ) : (
          icon
        )}
        <span>{children}</span>
      </span>
    </button>
  );
}
