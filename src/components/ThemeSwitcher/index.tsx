import { useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';
import lightIcon from '../../assets/light.png'
import darkIcon from '../../assets/dark.png'
import './index.css'

const ThemeSwitcher = () => {
    const { theme, toggleTheme } = useTheme();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const nextThemeLabel = theme === 'dark' ? '明亮模式' : '暗黑模式';
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
                aria-label={`切换到${nextThemeLabel}`}
                title={`切换到${nextThemeLabel}`}
            >
                <span className="theme-icon">
                    <img src={currentIcon} alt="" />
                </span>
            </button>
        </div>
    );
};

export default ThemeSwitcher
