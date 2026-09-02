import { AgentStep, AgentStepName } from '../types/agent';

export async function runAgentStep<T>(
  steps: AgentStep[],
  stepName: AgentStepName,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = new Date().toISOString();
  const step: AgentStep = { step: stepName, status: 'running', startedAt };
  steps.push(step);
  const stepStart = Date.now();

  try {
    const output = await fn();
    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    step.latencyMs = Date.now() - stepStart;
    step.output = output;
    return output;
  } catch (error) {
    step.status = 'error';
    step.completedAt = new Date().toISOString();
    step.latencyMs = Date.now() - stepStart;
    step.error = error instanceof Error ? error.message : String(error);
    throw error;
  }
}
