import { useMemo, useState } from 'react';
import type { AgentRunResult } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { SCORER_WEIGHTS } from '../utils/greenlightMetrics';
import { discoverFullById } from '../utils/greenlightAnalytics';
import {
  hasDiscoverRows,
  rescoreFromDiscover,
  type ScorerWeights
} from '../utils/greenlightRescore';

const SCORER_GITHUB =
  'https://github.com/armandobecerraro/catalog-greenlight/blob/main/packages/orchestration/src/greenlight/GreenlightScorer.ts';

function cloneWeights(): ScorerWeights {
  return { ...SCORER_WEIGHTS };
}

export function FormulaPlayground({ greenlight }: { greenlight: AgentRunResult }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [weights, setWeights] = useState<ScorerWeights>(cloneWeights);
  const [relaxCannibal, setRelaxCannibal] = useState(false);
  const [relaxDiversity, setRelaxDiversity] = useState(false);

  const fullById = useMemo(() => discoverFullById(greenlight), [greenlight]);
  const available = hasDiscoverRows(fullById);

  const preview = useMemo(() => {
    if (!fullById || !available) return null;
    return rescoreFromDiscover(fullById, { weights, relaxCannibal, relaxDiversity });
  }, [fullById, available, weights, relaxCannibal, relaxDiversity]);

  function setWeight(key: keyof ScorerWeights, value: number) {
    setWeights(w => ({ ...w, [key]: value }));
  }

  return (
    <section className="formula-playground" id="formula-playground" aria-label={t('playground.title')}>
      <button
        type="button"
        className="btn secondary playground-toggle"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {open ? t('playground.hide') : t('playground.show')}
      </button>
      {open && (
        <div className="playground-body">
          <h4>{t('playground.title')}</h4>
          <p className="muted">{t('playground.caption')}</p>
          <p className="muted small">
            <a href={SCORER_GITHUB} target="_blank" rel="noreferrer">
              {t('playground.sourceLink')}
            </a>
          </p>
          {!available ? (
            <p className="warning-banner playground-unavailable" role="status">
              {t('playground.unavailable')}
            </p>
          ) : (
            <>
              <div className="playground-sliders">
                <WeightSlider
                  label={t('playground.weightGenreGap')}
                  value={weights.genre_gap}
                  onChange={v => setWeight('genre_gap', v)}
                />
                <WeightSlider
                  label={t('playground.weightWow')}
                  value={weights.wow_momentum}
                  onChange={v => setWeight('wow_momentum', v)}
                />
                <WeightSlider
                  label={t('playground.weightCannibal')}
                  value={weights.cannibalization_penalty}
                  onChange={v => setWeight('cannibalization_penalty', v)}
                />
                <WeightSlider
                  label={t('playground.weightLanguage')}
                  value={weights.language_gap}
                  onChange={v => setWeight('language_gap', v)}
                />
              </div>
              <label className="playground-flag">
                <input
                  type="checkbox"
                  checked={relaxCannibal}
                  onChange={e => setRelaxCannibal(e.target.checked)}
                />
                {t('playground.relaxCannibal')}
              </label>
              <label className="playground-flag">
                <input
                  type="checkbox"
                  checked={relaxDiversity}
                  onChange={e => setRelaxDiversity(e.target.checked)}
                />
                {t('playground.relaxDiversity')}
              </label>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  setWeights(cloneWeights());
                  setRelaxCannibal(false);
                  setRelaxDiversity(false);
                }}
              >
                {t('playground.reset')}
              </button>
              {preview && (
                <ol className="playground-preview-slate">
                  {preview.top.map((c, i) => (
                    <li key={c.title_id || c.title}>
                      <strong>
                        {i + 1}. {c.title}
                      </strong>
                      <span className="genre-pill">{c.genre}</span>
                      <span className="muted small">{c.opportunity_score.toFixed(3)}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="muted small">{t('playground.previewNote')}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function WeightSlider({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="playground-slider">
      <span>
        {label}: <code>{value.toFixed(2)}</code>
      </span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </label>
  );
}
