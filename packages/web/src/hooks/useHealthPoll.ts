import { useCallback, useEffect, useState } from 'react';
import { api, HealthStatus } from '../api';

const POLL_MS = 3_000;
const MAX_ATTEMPTS = 25;

export function useHealthPoll() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [waking, setWaking] = useState(true);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt(a => a + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    async function poll() {
      tries += 1;
      try {
        const h = await api.health();
        if (cancelled) return;
        setHealth(h);
        if (h.ready) {
          setWaking(false);
          return;
        }
        setWaking(true);
      } catch {
        if (cancelled) return;
        setHealth(null);
        setWaking(true);
      }

      if (tries < MAX_ATTEMPTS && !cancelled) {
        timer = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attempt]);

  return { health, waking, retry };
}
