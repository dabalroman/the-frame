import { useState, useEffect } from 'react';

// Ported from random-tools' eink-frame useFrameConfig.ts (#185). Only the
// endpoint path changed (`/api/eink/config` → `/api/config`).

type FrameConfig = { width: number; height: number };

const DEFAULT: FrameConfig = { width: 800, height: 480 };

let cache: FrameConfig | null = null;

export function useFrameConfig(): FrameConfig {
  const [config, setConfig] = useState<FrameConfig>(cache ?? DEFAULT);

  useEffect(() => {
    if (cache) return;
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal })
      .then(r => r.ok ? r.json() as Promise<FrameConfig> : Promise.resolve(DEFAULT))
      .then(cfg => { cache = cfg; setConfig(cfg); })
      .catch(err => { if ((err as { name?: string }).name !== 'AbortError') setConfig(DEFAULT); });
    return () => controller.abort();
  }, []);

  return config;
}
