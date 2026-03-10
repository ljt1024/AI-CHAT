import { useTheme } from '@/context/ThemeContext';
import lightIcon from '../../assets/light.png'
import darkIcon from '../../assets/dark.png'
import './index.css'

const ThemeSwitcher = () => {
    const { theme, toggleTheme } = useTheme();
    const nextThemeLabel = theme === 'dark' ? '明亮模式' : '暗黑模式';
    const currentIcon = theme === 'dark' ? lightIcon : darkIcon;

    return (
        <div className="theme-switcher">
            <button
                type="button"
                className="theme-button"
                onClick={toggleTheme}
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
