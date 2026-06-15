import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mobile floating action button (#186) — extended terracotta pill pinned bottom-right,
 * thumb-reachable, respecting the iOS safe-area inset. Shared by the gallery (upload) and
 * calendar (add event) so the primary mobile action is identical across screens. Hidden on
 * desktop by the caller (`sm:hidden`), which uses an inline header button instead.
 */
export function Fab({
  onClick,
  disabled,
  label,
  icon,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'fixed bottom-6 right-5 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-primary pl-5 pr-6 text-base font-semibold text-primary-foreground shadow-lifted transition-transform active:scale-95 disabled:opacity-60',
        className
      )}
      style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
    >
      {icon}
      {label}
    </button>
  );
}
