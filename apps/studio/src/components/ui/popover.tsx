import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A small anchored panel. Closes on Escape (focus returns to the trigger), on a click outside, and on focus leaving it.
 * The panel is a sibling of the trigger inside a relative wrapper, so it never leaves the tab order.
 */
export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = 'right',
  className,
  panelClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  panelClassName?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onOpenChange(false);
      root.current?.querySelector<HTMLElement>('[data-popover-trigger]')?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div
      ref={root}
      className={cn('relative', className)}
      onBlur={(e) => {
        if (open && e.relatedTarget && root.current && !root.current.contains(e.relatedTarget as Node)) onOpenChange(false);
      }}
    >
      {trigger}
      {open ? (
        <div
          className={cn(
            'popover-panel absolute top-[calc(100%+6px)] z-40 rounded-card border border-line bg-surface shadow-lift',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            panelClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
