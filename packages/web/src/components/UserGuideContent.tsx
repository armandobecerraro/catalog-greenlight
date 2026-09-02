import { Link } from 'react-router-dom';
import { Card } from './Layout';
import { translations } from '../i18n/translations';
import type { Locale } from '../i18n/translations';

export const GUIDE_SECTION_ID = 'guia-de-uso';
export const DEMO_STORY_GUIDE_ANCHOR = 'demo-story';

interface UserGuideContentProps {
  locale: Locale;
}

export function UserGuideContent({ locale }: UserGuideContentProps) {
  const copy = translations[locale].about;

  return (
    <section id={GUIDE_SECTION_ID} className="user-guide" aria-label={copy.title}>
      <header className="user-guide-hero">
        <span className="user-guide-badge">{copy.badge}</span>
        <h2>{copy.title}</h2>
        <p>{copy.subtitle}</p>
      </header>

      <Card className="about-intro user-guide-card">
        <h3>{copy.judgeTitle}</h3>
        <ol className="about-steps">
          {copy.judgeSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Card>

      <Card className="about-intro user-guide-card">
        <h3>{copy.whatTitle}</h3>
        <p className="user-guide-lead">{copy.whatBody}</p>
        <p className="muted">{copy.audience}</p>
      </Card>

      <Card className="user-guide-card">
        <h3>{copy.purposeTitle}</h3>
        <div className="purpose-table-wrap">
          <table className="purpose-table">
            <thead>
              <tr>
                <th>{copy.purposeColNeed}</th>
                <th>{copy.purposeColHow}</th>
              </tr>
            </thead>
            <tbody>
              {copy.purposes.map((row, i) => (
                <tr key={i}>
                  <td>{row.need}</td>
                  <td>{row.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="user-guide-card">
        <h3>{copy.quickStartTitle}</h3>
        <ol className="about-steps">
          {copy.quickStartSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Card>

      <h3 className="about-section-heading">{copy.guideTitle}</h3>
      <div className="about-grid">
        {copy.screens.map(screen => (
          <Card key={screen.path} className="about-screen-card user-guide-card">
            <h4>{screen.title}</h4>
            <p>{screen.body}</p>
            <Link to={screen.path} className="about-link">
              {screen.cta} →
            </Link>
          </Card>
        ))}
      </div>

      <div id={DEMO_STORY_GUIDE_ANCHOR}>
        <Card className="about-greenlight user-guide-card">
          <h3>{copy.greenlightTitle}</h3>
          <p className="user-guide-lead">{copy.demoStoryLead}</p>
          <p>{copy.greenlightIntro}</p>
          <ol className="about-steps">
            {copy.greenlightSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p className="about-formula">
            <strong>{copy.formulaTitle}:</strong> {copy.formula}
          </p>
        </Card>
      </div>

      <div className="about-grid about-grid-2">
        <Card className="user-guide-card">
          <h3>{copy.stackTitle}</h3>
          <ul className="about-list">
            {copy.stackItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="user-guide-card">
          <h3>{copy.tipsTitle}</h3>
          <ul className="about-list">
            {copy.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="user-guide-card">
        <h3>{copy.troubleshootTitle}</h3>
        <div className="purpose-table-wrap">
          <table className="purpose-table">
            <thead>
              <tr>
                <th>{copy.troubleshootColSymptom}</th>
                <th>{copy.troubleshootColFix}</th>
              </tr>
            </thead>
            <tbody>
              {copy.troubleshoot.map((row, i) => (
                <tr key={i}>
                  <td>{row.symptom}</td>
                  <td>{row.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
