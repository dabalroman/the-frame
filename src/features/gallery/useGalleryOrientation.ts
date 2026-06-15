import { useState, useCallback } from 'react';
import type { Orientation } from '@/types/image';

// Gallery view orientation (which crop the thumbnails + the crop modal open to),
// persisted to localStorage so it survives reloads. Defaults to horizontal.

const KEY = 'the-frame-gallery-orientation';

function read(): Orientation {
  try {
    return localStorage.getItem(KEY) === 'vertical' ? 'vertical' : 'horizontal';
  } catch {
    return 'horizontal';
  }
}

export function useGalleryOrientation(): [Orientation, (o: Orientation) => void] {
  const [orientation, setOrientation] = useState<Orientation>(read);

  const set = useCallback((o: Orientation) => {
    setOrientation(o);
    try { localStorage.setItem(KEY, o); } catch { /* ignore quota / privacy mode */ }
  }, []);

  return [orientation, set];
}
