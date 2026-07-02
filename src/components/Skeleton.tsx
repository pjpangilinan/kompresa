type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-container-highest animate-pulse ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function SkeletonText({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-4 ${className}`} />;
}
