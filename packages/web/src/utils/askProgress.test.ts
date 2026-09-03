import { describe, expect, it } from 'vitest';
import {
  ASK_PROGRESS_STEPS,
  ASK_PROGRESS_STEP_MS,
  askStepFromElapsed,
  askStepStatus
} from './askProgress';

describe('askProgress', () => {
  it('pins elapsed at or below zero to INTENT', () => {
    expect(askStepFromElapsed(0)).toBe('INTENT');
    expect(askStepFromElapsed(-1)).toBe('INTENT');
  });

  it('advances one step every 5s and clamps at AUDIT', () => {
    expect(askStepFromElapsed(ASK_PROGRESS_STEP_MS - 1)).toBe('INTENT');
    expect(askStepFromElapsed(ASK_PROGRESS_STEP_MS)).toBe('DISCOVER');
    expect(askStepFromElapsed(ASK_PROGRESS_STEP_MS * 5)).toBe('AUDIT');
    expect(askStepFromElapsed(ASK_PROGRESS_STEP_MS * 20)).toBe('AUDIT');
    expect(askStepFromElapsed(9_000, 4_000)).toBe('PLAN_SQL');
  });

  it('marks steps done, active, or pending relative to the current phase', () => {
    expect(askStepStatus('INTENT', 'PLAN_SQL')).toBe('done');
    expect(askStepStatus('PLAN_SQL', 'PLAN_SQL')).toBe('active');
    expect(askStepStatus('AUDIT', 'PLAN_SQL')).toBe('pending');
    expect(ASK_PROGRESS_STEPS).toHaveLength(6);
  });
});
