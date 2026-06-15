import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CalendarEvent } from '@/types/event';
import { eventsOnDate } from '@/lib/recurrence';
import { formatFullDate } from './format';
import { EventCard } from './EventCard';

type Props = {
  date: string | null;
  events: CalendarEvent[];
  onClose: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onAddOnDate: (date: string) => void;
};

/** Bottom-sheet-ish dialog listing a day's events with an "add on this day" action. */
export function DaySheet({ date, events, onClose, onSelectEvent, onAddOnDate }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const dayEvents = date ? eventsOnDate(events, date) : [];

  return (
    <Dialog open={!!date} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle className="first-letter:uppercase">{date ? formatFullDate(date, lang) : ''}</DialogTitle>

        {dayEvents.length === 0 ? (
          <p className="text-base text-muted-foreground">{t('calendar.noEventsOnDay')}</p>
        ) : (
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {dayEvents.map((e) => (
              <EventCard key={e.id} event={e} showDate={false} onClick={() => onSelectEvent(e)} />
            ))}
          </div>
        )}

        <Button size="sm" onClick={() => date && onAddOnDate(date)}>
          <Plus className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          {t('calendar.addOnDay')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
