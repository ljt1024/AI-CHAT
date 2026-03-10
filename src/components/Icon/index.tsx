// 全局图标注册表
const iconRegistry: Record<string, React.ComponentType<any>> = {};

/**
 * 注册全局图标 (通过名称引用)
 * @param icons 图标名称到组件的映射
 */
export function registerIcons(icons: Record<string, React.ComponentType<any>>) {
  Object.assign(iconRegistry, icons);
}

interface IconProps {
  sourceType: 'svg' | 'font' | 'img';
  source: string | React.ComponentType<any>;
  size?: string | number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  rotate?: number;
  spin?: boolean;
  title?: string;
  onClick?: () => void;
  isPoint?: boolean;
}

const Icon: React.FC<IconProps> = ({
  sourceType,
  source,
  size = '1em',
  color,
  className = '',
  style,
  rotate,
  spin = false,
  title,
  onClick,
  isPoint = true
}) => {
  // 合并样式
  const combinedStyle = {
    ...style,
    ...(color && { color }),
    ...(size && { fontSize: typeof size === 'number' ? `${size}px` : size }),
    ...(rotate && { transform: `rotate(${rotate}deg)` }),
    ...(isPoint && { cursor: 'pointer'})
  };

  // 处理旋转动画
  const animationClass = spin ? 'icon-spin' : '';
  const finalClassName = `icon ${animationClass} ${className}`.trim();

  // 渲染逻辑
  const renderIcon = () => {
    switch (sourceType) {
      case 'svg':
        const SvgIcon = typeof source === 'string' ? iconRegistry[source] : source;
        if (!SvgIcon) {
          console.error(`Icon component not found: ${source}`);
          return <span className="icon-error">❌</span>;
        }
        return (
          <SvgIcon
            style={{
              ...combinedStyle,
              width: '1em',
              height: '1em',
              fill: 'currentColor',
              flexShrink: 0
            }}
          />
        );

      case 'font':
        return (
          <i 
            className={`${source} ${finalClassName}`} 
            style={combinedStyle}
            aria-hidden="true"
          />
        );

      case 'img':
        return (
          <img 
            src={source as string} 
            alt={title || 'icon'} 
            className={finalClassName} 
            style={combinedStyle}
          />
        );

      default:
        return null;
    }
  };

  return (
    <span 
      className={`icon-wrapper ${onClick ? 'icon-clickable' : ''}`}
      onClick={onClick}
      title={title}
      role={onClick ? 'button' : 'img'}
      aria-label={title}
      style={{ display: 'inline-flex', verticalAlign: 'middle' }}
    >
      {renderIcon()}
    </span>
  );
};

export default Icon;
