import { useMemo, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n, { normalizeLanguage, type AppLanguage, type TranslationKey, type TranslationParams } from '../i18n';

export type { AppLanguage } from '../i18n';
export const LanguageProvider = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// Compatibility facade for existing components; all resources now use i18next.
export const useLanguage = () => {
  const { t, i18n: instance } = useTranslation();
  const language = normalizeLanguage(instance.resolvedLanguage || instance.language);
  return useMemo(() => ({
    language,
    setLanguage: (value: AppLanguage) => { void instance.changeLanguage(value); },
    t: (key: TranslationKey, params?: TranslationParams): string => String(t(key, params)),
    dateLocale: language === 'zh' ? 'zh-CN' : 'en-US',
  }), [language, t, instance]);
};
