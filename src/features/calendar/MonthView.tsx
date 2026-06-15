import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/event';
import { eventsOnDate } from '@/lib/recurrence';
import { monthGrid, inMonth } from '@/lib/monthGrid';
import { monthLabel, weekdayLabels, todayLocal } from './format';

type Props = {
  events: CalendarEvent[];
  onSelectDay: (date: string) => void;
};

export function MonthView({ events, onSelectDay }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? 'en';
  const today = todayLocal();
  const [todayY, todayM] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];

  const [{ year, month }, setYM] = useState({ year: todayY, month: todayM });
  const onCurrent = year === todayY && month === todayM;

  function step(months: number) {
    setYM(({ year, month }) => {
      const idx = (year * 12 + (month - 1)) + months;
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
    });
  }

  const weeks = monthGrid(year, month);
  const weekdays = weekdayLabels(lang);

  return (
    <div className="flex flex-col gap-3">
      {/* Nav */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <NavBtn onClick={() => step(-12)} label={t('calendar.prevYear')}><ChevronsLeft className="h-4 w-4" strokeWidth={1.5} /></NavBtn>
          <NavBtn onClick={() => step(-1)} label={t('calendar.prevMonth')}><ChevronLeft className="h-4 w-4" strokeWidth={1.5} /></NavBtn>
        </div>
        <button
          type="button"
          onClick={() => setYM({ year: todayY, month: todayM })}
          className="font-display text-lg font-medium tracking-tight first-letter:uppercase"
          title={t('calendar.today')}
        >
          {monthLabel(year, month, lang)}
        </button>
        <div className="flex items-center gap-1">
          <NavBtn onClick={() => step(1)} label={t('calendar.nextMonth')}><ChevronRight className="h-4 w-4" strokeWidth={1.5} /></NavBtn>
          <NavBtn onClick={() => step(12)} label={t('calendar.nextYear')}><ChevronsRight className="h-4 w-4" strokeWidth={1.5} /></NavBtn>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {weekdays.map((w, i) => <span key={i}>{w}</span>)}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((date) => {
          const dayEvents = eventsOnDate(events, date);
          const isToday = date === today;
          const within = inMonth(date, year, month);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay(date)}
              className={cn(
                'flex min-h-[60px] flex-col gap-1 rounded-xl border border-border/60 bg-card p-1.5 text-left transition-colors hover:bg-accent sm:min-h-[84px]',
                !within && 'opacity-40',
                isToday && 'ring-2 ring-primary'
              )}
            >
              <span className={cn('text-xs font-semibold', isToday && 'text-primary')}>{Number(date.slice(8, 10))}</span>
              {dayEvents.length > 0 && (
                <>
                  {/* mobile: dots */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {dayEvents.slice(0, 3).map((e) => <span key={e.id} className="h-1.5 w-1.5 rounded-full bg-primary" />)}
                  </div>
                  {/* sm+: titles */}
                  <div className="hidden flex-col gap-0.5 sm:flex">
                    {dayEvents.slice(0, 2).map((e) => (
                      <span key={e.id} className="truncate rounded bg-primary/10 px-1 text-xs text-primary">{e.title}</span>
                    ))}
                    {dayEvents.length > 2 && <span className="text-xs text-muted-foreground">+{dayEvents.length - 2}</span>}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Always present (below the grid) so the layout never jumps; inactive on the current month. */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          disabled={onCurrent}
          onClick={() => setYM({ year: todayY, month: todayM })}
        >
          {t('calendar.today')}
        </Button>
      </div>
    </div>
  );
}

function NavBtn({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-soft transition-colors hover:bg-accent"
    >
      {children}
    </button>
  );
}
