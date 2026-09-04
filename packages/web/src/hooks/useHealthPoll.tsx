import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { api, HealthStatus } from '../api';

export const POLL_MS = 3_000;
export const MAX_ATTEMPTS = 25;

export type HealthPollState = {
  health: HealthStatus | null;
  waking: boolean;
  retry: () => void;
  attempt: number;
  maxAttempts: number;
  elapsedHint: number;
};

const HealthPollContext = createContext<HealthPollState | null>(null);

function useHealthPollState(): HealthPollState {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [waking, setWaking] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [pollGeneration, setPollGeneration] = useState(0);

  const retry = useCallback(() => {
    setPollGeneration(g => g + 1);
    setAttempt(0);
    setWaking(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    async function poll() {
      tries += 1;
      if (!cancelled) setAttempt(tries);

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
  }, [pollGeneration]);

  const elapsedHint = useMemo(() => Math.min(attempt * POLL_MS, MAX_ATTEMPTS * POLL_MS), [attempt]);

  return { health, waking, retry, attempt, maxAttempts: MAX_ATTEMPTS, elapsedHint };
}

/** One shared /health poll for banner + Ask/Dashboard gates. */
export function HealthPollProvider({ children }: { children: ReactNode }) {
  const value = useHealthPollState();
  return <HealthPollContext.Provider value={value}>{children}</HealthPollContext.Provider>;
}

export function useHealthPoll(): HealthPollState {
  const ctx = useContext(HealthPollContext);
  if (!ctx) {
    throw new Error('useHealthPoll must be used within HealthPollProvider');
  }
  return ctx;
}
