import { useState, useCallback } from 'react';

export type CalendarView = 'month' | 'stream';

const KEY = 'the-frame-calendar-view';

function read(): CalendarView {
  try {
    return localStorage.getItem(KEY) === 'stream' ? 'stream' : 'month';
  } catch {
    return 'month';
  }
}

/** Calendar view (month grid vs event stream), persisted to localStorage. */
export function useCalendarView(): [CalendarView, (v: CalendarView) => void] {
  const [view, setView] = useState<CalendarView>(read);

  const set = useCallback((v: CalendarView) => {
    setView(v);
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  }, []);

  return [view, set];
}
