import { Link } from 'react-router-dom';
import { PageHeader, Card, EmptyState } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';

export default function NotFound() {
  const { t } = useLocale();

  return (
    <>
      <PageHeader title={t('notFound.title')} subtitle={t('notFound.subtitle')} />
      <Card className="not-found">
        <EmptyState
          title={t('notFound.heading')}
          body={t('notFound.body')}
          action={
            <>
              <Link to="/">{t('notFound.dashboard')}</Link>
              {' · '}
              <Link to="/guia">{t('nav.about')}</Link>
            </>
          }
        />
        <p className="muted small">{t('notFound.apiHint')}</p>
      </Card>
    </>
  );
}
