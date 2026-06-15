import { useState, useCallback, useEffect } from 'react';
import type { CalendarEvent } from '@/types/event';

type State = {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
};

async function fetchEvents(signal: AbortSignal): Promise<CalendarEvent[]> {
  const res = await fetch('/api/events', { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<CalendarEvent[]>;
}

export function useEvents() {
  const [state, setState] = useState<State>({ events: [], loading: true, error: null });

  const load = useCallback(() => {
    const controller = new AbortController();
    fetchEvents(controller.signal)
      .then((events) => setState({ events, loading: false, error: null }))
      .catch((err) => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => load(), [load]);

  const reload = useCallback(() => { load(); }, [load]);

  return { ...state, reload };
}
