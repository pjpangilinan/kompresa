import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Input({ label, error, id, className = '', ...rest }: InputProps) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="flex flex-col relative pt-2">
      <label
        htmlFor={inputId}
        className="font-label-mono text-label-mono text-on-surface-variant opacity-60 uppercase absolute -top-2 left-0 bg-surface-container-high px-1 z-10 tracking-widest"
      >
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={`bg-transparent border-0 border-b-2 border-surface-container-highest focus:border-primary-container focus:ring-0 focus:outline-none font-body-lg text-body-lg text-on-surface py-3 px-0 transition-colors w-full ${className}`}
      />
      {error ? (
        <span
          id={`${inputId}-error`}
          role="alert"
          className="font-label-mono text-label-mono text-error mt-2 uppercase"
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
