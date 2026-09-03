import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Locale, translate } from './translations';

export const STORAGE_KEY = 'cg-locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function readInitialLocale(
  storage: { getItem(key: string): string | null } | null | undefined = globalThis.localStorage,
  language = navigator.language
): Locale {
  const saved = storage?.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'es') return saved;
  return language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(prev => (prev === 'en' ? 'es' : 'en')),
      t: (key, vars) => translate(locale, key, vars)
    }),
    [locale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function LanguageToggle() {
  const { locale, toggleLocale, t } = useLocale();

  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={toggleLocale}
      aria-label={t('lang.label')}
      title={t('lang.switchTo')}
    >
      <span className={locale === 'en' ? 'lang-active' : ''}>EN</span>
      <span className="lang-sep">/</span>
      <span className={locale === 'es' ? 'lang-active' : ''}>ES</span>
    </button>
  );
}
