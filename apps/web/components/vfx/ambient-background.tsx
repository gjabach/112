export function AmbientBackground({
  className = '',
}: {
  intensity?: 'subtle' | 'medium' | 'high';
  className?: string;
}) {
  return (
    <div
      className={`studio-paper-background pointer-events-none fixed inset-0 select-none ${className}`}
      aria-hidden="true"
    />
  );
}
