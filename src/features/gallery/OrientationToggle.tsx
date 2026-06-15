import { useTranslation } from 'react-i18next';
import { RectangleHorizontal, RectangleVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Orientation } from '@/types/image';

const OPTIONS = [
  { value: 'horizontal' as const, Icon: RectangleHorizontal },
  { value: 'vertical' as const, Icon: RectangleVertical },
];

/**
 * Gallery view-orientation control — an iOS-style segmented switch: a sand inset track
 * with a lifted white chip marking the active segment. Full-width thumb targets on
 * mobile; compact inline on desktop.
 */
export function OrientationToggle({
  value,
  onChange,
  className,
}: {
  value: Orientation;
  onChange: (o: Orientation) => void;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('gallery.viewOrientation')}
      className={cn(
        'flex w-full gap-1 rounded-full border border-border/60 bg-muted/60 p-1 sm:w-auto',
        className
      )}
    >
      {OPTIONS.map(({ value: v, Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={active}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-[color,background-color,box-shadow] sm:flex-none sm:py-1.5',
              active
                ? 'bg-card text-primary shadow-soft'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {t(`gallery.orientation.${v}`)}
          </button>
        );
      })}
    </div>
  );
}
