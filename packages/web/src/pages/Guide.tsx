import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleContext';
import { UserGuideContent } from '../components/UserGuideContent';

export default function Guide() {
  const { locale } = useLocale();
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const frame = window.requestAnimationFrame(scroll);
    return () => window.cancelAnimationFrame(frame);
  }, [hash, locale]);

  return <UserGuideContent locale={locale} />;
}
