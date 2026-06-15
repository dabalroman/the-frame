import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * iOS-style segmented switch (#186) — a sand inset track with a lifted white chip on the
 * active segment. Full-width thumb targets on mobile, compact inline on desktop. Shared by
 * the gallery (orientation) and calendar (view / repeat) controls so they stay identical.
 */

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  Icon?: LucideIcon;
};

export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex w-full gap-1 rounded-full border border-border/60 bg-muted/60 p-1 sm:w-auto',
        className
      )}
    >
      {options.map(({ value: v, label, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-[color,background-color,box-shadow] sm:flex-none sm:py-1.5',
              active ? 'bg-card text-primary shadow-soft' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
