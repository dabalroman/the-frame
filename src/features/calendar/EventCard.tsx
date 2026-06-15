import { useTranslation } from 'react-i18next';
import { Repeat as RepeatIcon, Clock } from 'lucide-react';
import type { CalendarEvent } from '@/types/event';
import { formatEventDate } from './format';

type Props = {
  event: CalendarEvent;
  /** Resolved occurrence date to show instead of the stored date (stream view). */
  occursOn?: string;
  showDate?: boolean;
  onClick: () => void;
};

/** A single event row — gallery-card styling (rounded-2xl, soft shadow). */
export function EventCard({ event, occursOn, showDate = true, onClick }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const dateStr = occursOn ?? event.date;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-soft transition-shadow hover:shadow-card"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{event.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {showDate && <span>{formatEventDate(dateStr, lang)}</span>}
          {event.time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {event.time}
            </span>
          )}
          {event.repeat === 'yearly' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
              <RepeatIcon className="h-3 w-3 shrink-0" strokeWidth={1.5} />
              {t('calendar.yearly')}
            </span>
          )}
        </div>
        {event.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{event.description}</p>}
      </div>
    </button>
  );
}
