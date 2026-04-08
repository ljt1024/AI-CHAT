import { useLanguage } from '@/context/LanguageContext';
import './index.css';

const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="language-switcher" aria-label={t('language.label')}>
      <button
        type="button"
        className={`language-option ${language === 'zh' ? 'active' : ''}`.trim()}
        onClick={() => setLanguage('zh')}
        title={t('language.switchToZh')}
        aria-pressed={language === 'zh'}
      >
        中文
      </button>
      <button
        type="button"
        className={`language-option ${language === 'en' ? 'active' : ''}`.trim()}
        onClick={() => setLanguage('en')}
        title={t('language.switchToEn')}
        aria-pressed={language === 'en'}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
