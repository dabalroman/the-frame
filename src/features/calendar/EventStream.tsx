import { useTranslation } from 'react-i18next';
import type { CalendarEvent } from '@/types/event';
import { agenda } from '@/lib/recurrence';
import { todayLocal } from './format';
import { EventCard } from './EventCard';

type Props = {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
};

/** Continuous agenda — events stacked closest-first, no rows for empty days. */
export function EventStream({ events, onSelectEvent }: Props) {
  const { t } = useTranslation();
  const items = agenda(events, todayLocal());

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center text-base text-muted-foreground">
        {t('calendar.empty')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((e) => (
        <EventCard key={e.id} event={e} occursOn={e.occursOn} onClick={() => onSelectEvent(e)} />
      ))}
    </div>
  );
}
