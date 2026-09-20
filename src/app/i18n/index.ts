import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

export type AppLanguage = 'zh' | 'en';
export type TranslationKey = keyof typeof zh;
export type TranslationParams = Record<string, string | number | undefined>;
export const normalizeLanguage = (value: string): AppLanguage => /^en\b/i.test(value) ? 'en' : 'zh';
const storageKey = 'appLanguage';
function initialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch { /* Storage may be unavailable in private browsing. */ }
  return typeof navigator === 'undefined' ? 'zh' : normalizeLanguage(navigator.language);
}
void i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: initialLanguage(), fallbackLng: 'zh', supportedLngs: ['zh', 'en'],
  keySeparator: false, initAsync: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  returnNull: false,
});
function persistLanguage(language: string) {
  const selected = normalizeLanguage(language);
  if (typeof document !== 'undefined') document.documentElement.lang = selected === 'zh' ? 'zh-CN' : 'en';
  try { localStorage.setItem(storageKey, selected); } catch { /* Keep in-memory selection. */ }
}
persistLanguage(i18n.language);
i18n.on('languageChanged', persistLanguage);
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === storageKey && (event.newValue === 'en' || event.newValue === 'zh')) void i18n.changeLanguage(event.newValue);
});
export const t = (key: TranslationKey, params?: TranslationParams): string => String(i18n.t(key, params));
export const languageHeaders = () => ({ 'Accept-Language': i18n.language === 'en' ? 'en-US' : 'zh-CN' });
export default i18n;
