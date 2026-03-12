import { useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useTheme } from '@/context/ThemeContext';
import lightIcon from '../../assets/light.png'
import darkIcon from '../../assets/dark.png'
import './index.css'

const ThemeSwitcher = () => {
    const { theme, toggleTheme } = useTheme();
    const { t } = useLanguage();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const nextThemeLabel = theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark');
    const currentIcon = theme === 'dark' ? lightIcon : darkIcon;

    const onToggleTheme = () => {
        const buttonRect = buttonRef.current?.getBoundingClientRect();
        toggleTheme(buttonRect ? {
            x: buttonRect.left + buttonRect.width / 2,
            y: buttonRect.top + buttonRect.height / 2
        } : undefined);
    }

    return (
        <div className="theme-switcher">
            <button
                ref={buttonRef}
                type="button"
                className="theme-button"
                onClick={onToggleTheme}
                aria-label={nextThemeLabel}
                title={nextThemeLabel}
            >
                <span className="theme-icon">
                    <img src={currentIcon} alt="" />
                </span>
            </button>
        </div>
    );
};

export default ThemeSwitcher
