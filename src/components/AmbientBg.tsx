type AmbientBgProps = {
  variant?: 'dashboard' | 'download';
};

export function AmbientBg({ variant = 'dashboard' }: AmbientBgProps) {
  if (variant === 'download') {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] bg-primary-container/10 rounded-full blur-3xl mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-tertiary-container/5 rounded-full blur-3xl mix-blend-screen" />
        <div className="absolute inset-0 halftone-bg opacity-30" />
        <div className="absolute top-1/4 left-0 w-full h-[1px] bg-primary-container/20 -skew-y-6" />
        <div className="absolute top-2/3 right-0 w-full h-[2px] bg-primary-container/30 skew-y-3" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none opacity-20 bg-halftone z-0" />
  );
}
