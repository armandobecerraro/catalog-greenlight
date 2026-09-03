export const ASK_PROGRESS_STEPS = [
  'INTENT',
  'DISCOVER',
  'PLAN_SQL',
  'EXECUTE',
  'SYNTHESIZE',
  'AUDIT'
] as const;

export type AskProgressStep = (typeof ASK_PROGRESS_STEPS)[number];

export const ASK_PROGRESS_STEP_MS = 5_000;

export function askStepFromElapsed(
  elapsedMs: number,
  stepMs = ASK_PROGRESS_STEP_MS
): AskProgressStep {
  if (elapsedMs <= 0) return ASK_PROGRESS_STEPS[0];
  const idx = Math.min(ASK_PROGRESS_STEPS.length - 1, Math.floor(elapsedMs / stepMs));
  return ASK_PROGRESS_STEPS[idx];
}

export function askStepStatus(
  step: AskProgressStep,
  current: AskProgressStep
): 'done' | 'active' | 'pending' {
  const currentIdx = ASK_PROGRESS_STEPS.indexOf(current);
  const stepIdx = ASK_PROGRESS_STEPS.indexOf(step);
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}
