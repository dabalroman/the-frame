import { useState, useCallback, useEffect } from 'react';
import type { FrameImage } from '@/types/image';

// Ported from random-tools' eink-frame useImages.ts (#185). Only the endpoint
// path (`/api/eink/images` → `/api/images`) and the image type changed.

type State = {
  images: FrameImage[];
  loading: boolean;
  error: string | null;
};

async function fetchImages(signal: AbortSignal): Promise<FrameImage[]> {
  const res = await fetch('/api/images', { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<FrameImage[]>;
}

export function useImages() {
  const [state, setState] = useState<State>({ images: [], loading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    fetchImages(controller.signal)
      .then(images => setState({ images, loading: false, error: null }))
      .catch(err => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setState(s => ({ ...s, loading: false, error: String(err) }));
      });
    return () => controller.abort();
  }, []);

  const reload = useCallback(() => {
    const controller = new AbortController();
    setState(s => ({ ...s, loading: true, error: null }));
    fetchImages(controller.signal)
      .then(images => setState({ images, loading: false, error: null }))
      .catch(err => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setState(s => ({ ...s, loading: false, error: String(err) }));
      });
  }, []);

  return { ...state, reload };
}
