import { useState, useEffect, useRef } from 'react';
import lightIcon from '../../assets/light.png'
import darkIcon from '../../assets/dark.png'
import './index.css'

const ThemeSwitcher = () => {
    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const themes = [
        {
            id: 'light', name: '明亮模式', icon: darkIcon, colors: {
                '--bg-color': '#ffffff',
                '--text-color': '#1a1a1a',
                '--avatar-bg': '#f0f2f5',
                '--user-bubble-bg': '#007bff',
                '--bot-bubble-bg': '#f0f2f5',
                '--border-color': '#e0e0e0',
                '--input-bg': '#f5f5f5',
                '--primary-color': '#007bff',
            }
        },
        {
            id: 'dark', name: '暗黑模式', icon: lightIcon, colors: {
                '--bg-color': '#1a1a1a',
                '--text-color': '#ffffff',
                '--avatar-bg': '#2d2d2d',
                '--user-bubble-bg': '#007bff',
                '--bot-bubble-bg': '#2d2d2d',
                '--border-color': '#3d3d3d',
                '--input-bg': '#2d2d2d',
            }
        },
        // { id: 'blue', name: '蓝色主题', icon: '💙', colors: { primary: '#3498db', secondary: '#e1f5fe', text: '#01579b', card: '#b3e5fc' }},
        // { id: 'pink', name: '粉色主题', icon: '🌸', colors: { primary: '#e84393', secondary: '#ffeaa7', text: '#6d214f', card: '#fd79a8' }}
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
        // const colors = themes.find(t => t.id === theme)?.colors;
        // 移除现有主题类
        root.removeAttribute('data-theme')

        if (theme === 'dark') {
            root.setAttribute('data-theme', 'dark');
        }
        // if (colors) {
        //   Object.keys(colors).forEach(key => {
        //     root.style.setProperty(key, colors[key]);
        //   });
        //   // root.style.setProperty('--primary-color', colors.primary);
        //   // root.style.setProperty('--secondary-color', colors.secondary);
        //   // root.style.setProperty('--text-color', colors.text);
        //   // root.style.setProperty('--card-color', colors.card);
        // }

        setCurrentTheme(theme);
        // setIsOpen(false);

        // 保存主题到本地存储
        localStorage.setItem('theme', theme);
    };

    // 初始化主题
    useEffect(() => {
        const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
        applyTheme(savedTheme);
    }, []);

    // onClick={() => setIsOpen(!isOpen)}
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
                    {/* { themes.find(t => t.id === currentTheme)?.icon|| '🎨'} */}
                </span>
                {/* <span className="theme-label">主题</span>
                <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span> */}
            </div>

            {/* {isOpen && (
                <div className="dropdown-menu">
                    {themes.map((theme) => (
                        <div
                            key={theme.id}
                            className={`theme-option ${currentTheme === theme.id ? 'active' : ''}`}
                            onClick={() => applyTheme(theme.id)}
                        >
                            <span className="option-icon">{theme.icon}</span>
                            <span className="option-name">{theme.name}</span>
                            <div
                                className="color-preview"
                                style={{ backgroundColor: theme.colors.primary }}
                            />
                        </div>
                    ))}
                </div>
            )} */}
        </div>
    );
};

export default ThemeSwitcher