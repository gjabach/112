'use client';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
const MenuOverlayContext = createContext<React.MutableRefObject<number> | null>(
  null
);

/** Keep a disclosure mounted while a child dialog owns focus in a portal. */
export function useActionMenuOverlay(open: boolean) {
  const overlays = useContext(MenuOverlayContext);
  useEffect(() => {
    if (!open || !overlays) return;
    overlays.current += 1;
    return () => {
      overlays.current -= 1;
    };
  }, [open, overlays]);
}
/** Disclosure with native Tab order, outside dismissal and focus restoration. */
export function ActionMenu({
  children,
  label = 'Thao tác khác',
  className = '',
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const overlays = useRef(0);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (overlays.current) return;
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (overlays.current) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismiss);
    const element = root.current;
    element?.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      element?.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <MenuOverlayContext.Provider value={overlays}>
      <div
        ref={root}
        className={`relative shrink-0 ${className}`}
        onBlur={(event) => {
          if (
            !overlays.current &&
            !event.currentTarget.contains(event.relatedTarget as Node)
          )
            setOpen(false);
        }}
      >
        <Button
          ref={trigger}
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              requestAnimationFrame(() =>
                root.current
                  ?.querySelector<HTMLElement>(
                    '[data-action-panel] button, [data-action-panel] a'
                  )
                  ?.focus()
              );
            }
          }}
        >
          <MoreHorizontal />
        </Button>
        {open && (
          <div
            id={id}
            data-action-panel
            className="studio-action-panel"
            onClick={(event) => {
              if (
                (event.target as HTMLElement).closest('button, a') &&
                !(event.target as HTMLElement).closest('[data-keep-menu]')
              ) {
                trigger.current?.focus();
                setOpen(false);
              }
            }}
          >
            {children}
          </div>
        )}
      </div>
    </MenuOverlayContext.Provider>
  );
}
