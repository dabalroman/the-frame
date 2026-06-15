import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, CalendarDays, List } from 'lucide-react';
import LanguageToggle from '@/components/LanguageToggle';
import { Button } from '@/components/ui/button';
import { Fab } from '@/components/Fab';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import type { CalendarEvent } from '@/types/event';
import { useEvents } from './useEvents';
import { useCalendarView, type CalendarView } from './useCalendarView';
import { MonthView } from './MonthView';
import { EventStream } from './EventStream';
import { DaySheet } from './DaySheet';
import { EventDialog, type EventTarget } from './EventDialog';

/**
 * Calendar screen (#186) — month grid + event stream, CRUD via dialog. Mirrors the
 * gallery's header / toggle / FAB / card patterns. Lives at `/calendar` until #187
 * wraps it in the Picture↔Calendar shell.
 */
export default function Calendar() {
  const { t } = useTranslation();
  const { events, loading, error, reload } = useEvents();
  const [view, setView] = useCalendarView();
  const [target, setTarget] = useState<EventTarget | null>(null);
  const [daySheetDate, setDaySheetDate] = useState<string | null>(null);

  useEffect(() => {
    if (error) toast.error(error, { duration: Infinity, id: 'events-fetch-error' });
  }, [error]);

  function editEvent(ev: CalendarEvent) {
    setDaySheetDate(null);
    setTarget({ kind: 'edit', event: ev });
  }

  const status = loading ? t('calendar.status.loading') : t('calendar.status.events', { count: events.length });

  return (
    <div className="relative mx-auto flex min-h-screen max-w-screen-xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-2xl sm:text-3xl">{t('calendar.title')}</h1>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>
          <LanguageToggle className="sm:hidden" />
        </div>

        <div className="flex items-center gap-2">
          <SegmentedToggle<CalendarView>
            value={view}
            onChange={setView}
            ariaLabel={t('calendar.viewLabel')}
            options={[
              { value: 'month', label: t('calendar.viewMonth'), Icon: CalendarDays },
              { value: 'stream', label: t('calendar.viewStream'), Icon: List },
            ]}
          />
          <LanguageToggle className="hidden sm:inline-flex" />
          <Button className="hidden sm:inline-flex" size="sm" onClick={() => setTarget({ kind: 'add' })}>
            <Plus className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {t('calendar.addEvent')}
          </Button>
        </div>
      </header>

      {view === 'month' ? (
        <MonthView events={events} onSelectDay={(d) => setDaySheetDate(d)} />
      ) : (
        <EventStream events={events} onSelectEvent={editEvent} />
      )}

      {/* Spacer so the FAB never hides the last row on mobile. */}
      <div className="h-20 sm:hidden" aria-hidden />
      <Fab
        className="sm:hidden"
        onClick={() => setTarget({ kind: 'add' })}
        label={t('calendar.add')}
        icon={<Plus className="h-5 w-5 shrink-0" strokeWidth={1.5} />}
      />

      <DaySheet
        date={daySheetDate}
        events={events}
        onClose={() => setDaySheetDate(null)}
        onSelectEvent={editEvent}
        onAddOnDate={(d) => { setDaySheetDate(null); setTarget({ kind: 'add', date: d }); }}
      />
      <EventDialog target={target} onClose={() => setTarget(null)} onChanged={reload} />
    </div>
  );
}
