'use client';

import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface DocumentTabRowProps {
  id: string;
  title: string;
  depth: number;
  active: boolean;
  expanded?: boolean;
  disabled: boolean;
  editing?: boolean;
  dropDisabled: boolean;
  faded: boolean;
  blockClick: () => boolean;
  onSelect: () => void;
  onRename: (event: React.MouseEvent) => void;
  onMenu: (event: React.MouseEvent) => void;
  children: React.ReactNode;
}

export function DocumentTabRow({
  id, title, depth, active, expanded, disabled, editing = false, dropDisabled, faded,
  blockClick, onSelect, onRename, onMenu, children
}: DocumentTabRowProps) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id, disabled: disabled || editing });
  const { setNodeRef: setDropRef } = useDroppable({ id, disabled: dropDisabled });
  const canActivate = (event: React.SyntheticEvent) =>
    !(event.target as HTMLElement).closest('button, input, textarea, a, summary, [data-no-drag]');

  const filteredListeners = React.useMemo(() => {
    if (!listeners) return {};
    const wrapped: Record<string, any> = {};
    for (const [key, handler] of Object.entries(listeners)) {
      if (typeof handler === 'function') {
        wrapped[key] = (event: React.SyntheticEvent) => {
          if (canActivate(event)) {
            handler(event);
          }
        };
      }
    }
    return wrapped;
  }, [listeners]);

  return (
    <div
      ref={element => { setDragRef(element); setDropRef(element); }}
      {...attributes}
      {...filteredListeners}
      role="treeitem"
      aria-label={title || 'Thẻ không tên'}
      aria-selected={active}
      aria-level={depth + 1}
      aria-expanded={expanded}
      aria-disabled={disabled || undefined}
      tabIndex={disabled || editing ? -1 : 0}
      data-tab-id={id}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        filteredListeners?.onKeyDown?.(event);
        if (event.key === 'Enter' && !editing && !disabled && !blockClick()) { event.preventDefault(); onSelect(); }
      }}
      onClick={() => { if (!disabled && !editing && !blockClick()) onSelect(); }}
      onDoubleClick={event => { if (!disabled && !editing && !blockClick()) onRename(event); }}
      onContextMenu={event => { if (!disabled && !editing && !blockClick()) onMenu(event); }}
      className={`relative flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium select-none
        transition-[background-color,border-color,opacity] duration-150 motion-reduce:transition-none
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
        ${isDragging ? 'opacity-35 border-dashed border-primary/50 bg-primary/5' : faded ? 'opacity-30' : ''}
        ${disabled || editing ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:border-primary/30'}
        ${active ? 'border-primary/20 bg-primary/10 text-primary' : 'border-transparent text-foreground/80 hover:bg-muted/60 hover:text-foreground'}`}
      style={{ touchAction: 'pan-y' }}
    >
      {children}
    </div>
  );
}
