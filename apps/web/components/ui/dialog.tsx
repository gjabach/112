'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
const DialogContext = React.createContext<{
  close: () => void;
  titleId: string;
  descriptionId: string;
  setTitle: (value: boolean) => void;
  setDescription: (value: boolean) => void;
} | null>(null);
const focusable =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  drawer?: boolean;
}
export function Dialog({
  open,
  onOpenChange,
  children,
  className,
  drawer = false,
}: DialogProps) {
  const id = React.useId();
  const panel = React.useRef<HTMLDivElement>(null);
  const [hasTitle, setTitle] = React.useState(false);
  const [hasDescription, setDescription] = React.useState(false);
  const change = React.useRef(onOpenChange);
  change.current = onOpenChange;
  const [host, setHost] = React.useState<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    setHost(element);
    return () => {
      element.remove();
    };
  }, []);
  React.useEffect(() => {
    if (!open || !host) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const siblings = Array.from(document.body.children).filter(
      (el) => el !== host && el instanceof HTMLElement
    ) as HTMLElement[];
    const inert = siblings.map((el) => el.inert);
    siblings.forEach((el) => {
      el.inert = true;
    });
    const elements = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(focusable) || []
      ).filter((el) => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      (
        Array.from(
          panel.current?.querySelectorAll<HTMLElement>(
            '[autofocus], [data-autofocus], input:not([disabled]):not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea:not([disabled])'
          ) || []
        ).find((el) => el.getClientRects().length > 0) ||
        elements()[0] ||
        panel.current
      )?.focus();
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        change.current(false);
      }
      if (event.key !== 'Tab') return;
      const items = elements();
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        panel.current?.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      siblings.forEach((el, index) => {
        el.inert = inert[index];
      });
      previous?.focus();
    };
  }, [open, host]);
  if (!open || !host) return null;
  return createPortal(
    <DialogContext.Provider
      value={{
        close: () => change.current(false),
        titleId: `${id}-title`,
        descriptionId: `${id}-description`,
        setTitle,
        setDescription,
      }}
    >
      <div
        className={cn(
          'fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6',
          drawer && 'justify-start p-0 sm:p-0'
        )}
      >
        <div
          className="absolute inset-0 bg-black/40 studio-dialog-backdrop"
          aria-hidden="true"
          onClick={() => change.current(false)}
        />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={hasTitle ? `${id}-title` : undefined}
          aria-label={hasTitle ? undefined : 'Hộp thoại'}
          aria-describedby={hasDescription ? `${id}-description` : undefined}
          tabIndex={-1}
          className={cn(
            'relative w-full max-w-lg max-h-[calc(100dvh-24px)] overflow-y-auto overscroll-contain outline-none studio-dialog-panel',
            drawer && 'h-dvh max-h-dvh max-w-xs rounded-none',
            className
          )}
        >
          {children}
        </div>
      </div>
    </DialogContext.Provider>,
    host
  );
}
export function DialogContent({
  className,
  children,
  onClose,
}: {
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const context = React.useContext(DialogContext);
  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-card p-6 shadow-xl sm:p-8',
        className
      )}
    >
      <button
        type="button"
        aria-label="Đóng hộp thoại"
        onClick={onClose || context?.close}
        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}
export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mb-6 flex flex-col gap-2 pr-7 text-left', className)}
      {...props}
    />
  );
}
export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const context = React.useContext(DialogContext);
  const setTitle = context?.setTitle;
  React.useEffect(() => {
    setTitle?.(true);
    return () => setTitle?.(false);
  }, [setTitle]);
  return (
    <h2
      id={context?.titleId}
      className={cn(
        'font-serif text-2xl font-semibold tracking-tight',
        className
      )}
      {...props}
    />
  );
}
export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const context = React.useContext(DialogContext);
  const setDescription = context?.setDescription;
  React.useEffect(() => {
    setDescription?.(true);
    return () => setDescription?.(false);
  }, [setDescription]);
  return (
    <p
      id={context?.descriptionId}
      className={cn('text-sm leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}
