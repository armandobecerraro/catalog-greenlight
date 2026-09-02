import { useState } from 'react';
import type { AgentStep } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { StepOutput } from './StepOutput';

function statusKey(status: AgentStep['status']): string {
  if (status === 'failed') return 'steps.status.failed';
  return `steps.status.${status}`;
}

export function AgentTimeline({ steps }: { steps: AgentStep[] }) {
  const { t } = useLocale();

  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <TimelineStep key={i} step={s} t={t} />
      ))}
    </ol>
  );
}

function TimelineStep({
  step,
  t
}: {
  step: AgentStep;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(step.status === 'running');
  const hasOutput = step.output != null;
  const statusLabel = t(statusKey(step.status));

  return (
    <li className={`timeline-step status-${step.status}`}>
      <div className="timeline-head">
        <div className="timeline-title">
          <strong>{t(`steps.${step.step}`)}</strong>
          <span className={`status-badge status-badge-${step.status}`}>{statusLabel}</span>
        </div>
        <span className="timeline-meta">
          {step.latencyMs != null ? t('steps.latency', { ms: step.latencyMs }) : statusLabel}
        </span>
      </div>

      {step.error && <p className="timeline-error">{step.error}</p>}

      {hasOutput && (
        <div className="timeline-body">
          <button
            type="button"
            className="timeline-toggle"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
          >
            {expanded ? t('steps.hideDetails') : t('steps.showDetails')}
          </button>
          {expanded && <StepOutput step={step.step} output={step.output} />}
        </div>
      )}
    </li>
  );
}
