import { useLocale } from '../i18n/LocaleContext';
import { UserGuideContent } from '../components/UserGuideContent';

export default function Guide() {
  const { locale } = useLocale();
  return <UserGuideContent locale={locale} />;
}
