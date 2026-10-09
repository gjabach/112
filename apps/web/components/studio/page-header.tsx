import { cn } from '@/lib/utils';
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && <p className="studio-eyebrow mb-3">{eyebrow}</p>}
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl break-words">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      )}
    </div>
  );
}
export function StudioState({
  title,
  description,
  action,
  busy = false,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn('studio-state', className)}
      role={busy ? 'status' : undefined}
      aria-live="polite"
    >
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border bg-primary/5 text-primary">
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 5h7c2 0 3 1 3 3v15c-2-2-5-3-10-2V5Zm10 3c1-2 3-3 8-3v16c-3-1-6 0-8 2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h2 className="font-serif text-2xl">{title}</h2>
      {description && (
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
