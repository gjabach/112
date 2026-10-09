import Link from 'next/link';
import { cn } from '@/lib/utils';
export function StudioMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={cn('h-10 w-10 shrink-0 text-primary', className)}
    >
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <path
        d="M11 11h7c3 0 5 2 5 5v14c-2-2-4-3-7-3h-5V11Z"
        stroke="#FFFCF6"
        strokeWidth="1.5"
      />
      <path
        d="M23 16c1-3 3-5 6-5v16c-2 0-4 1-6 3M15 16h3M15 20h4"
        stroke="#FFFCF6"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M28 8v8l2-1 2 1V8" fill="#D6BB83" />
    </svg>
  );
}
export function StudioBrand({
  href = '/',
  compact = false,
}: {
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-w-0 items-center gap-3"
      aria-label="Novelist Studio — Trang chủ"
    >
      <StudioMark />
      <span className={cn('min-w-0', compact && 'hidden sm:block')}>
        <span className="block font-serif text-xl font-semibold leading-tight tracking-tight">
          Novelist<span className="text-primary">.</span>
        </span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Studio sáng tác
        </span>
      </span>
    </Link>
  );
}
