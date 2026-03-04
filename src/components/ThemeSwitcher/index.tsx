import { useState, useEffect, useRef } from 'react';
import lightIcon from '../../assets/light.png'
import darkIcon from '../../assets/dark.png'
import './index.css'

const ThemeSwitcher = () => {
    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const themes = [
        {
            id: 'light',
            name: '明亮模式',
            icon: darkIcon
        },
        {
            id: 'dark',
            name: '暗黑模式',
            icon: lightIcon
        },
    ];

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                // setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 应用主题
    const applyTheme = (theme: 'light' | 'dark') => {
        const root = document.documentElement;
        root.removeAttribute('data-theme')

        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
        }
        setCurrentTheme(theme);

        // 保存主题到本地存储
        localStorage.setItem('theme', theme);
    };

    // 初始化主题
    useEffect(() => {
        const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
        applyTheme(savedTheme);
    }, []);

    return (
        <div className="theme-switcher" ref={dropdownRef}>
            <div
                className="theme-button"
                onClick={() => applyTheme(currentTheme === 'dark' ? 'light' : 'dark')}
                aria-label="切换主题"
            >
                <span className="theme-icon">
                    {
                        <img src={themes.find(t => t.id === currentTheme)?.icon} alt="" />
                    }
                </span>
            </div>
        </div>
    );
};

export default ThemeSwitcher
