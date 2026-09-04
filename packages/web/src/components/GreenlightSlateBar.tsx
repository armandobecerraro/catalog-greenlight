import type { AgentRunResult } from '../api';
import { SlateReviewFlow } from './SlateReviewFlow';

/** Unified Review → confirm → download. Filename stays `greenlight-slate-YYYY-MM-DD.*`. */
export function GreenlightSlateBar({ greenlight }: { greenlight: AgentRunResult }) {
  return <SlateReviewFlow greenlight={greenlight} />;
}
