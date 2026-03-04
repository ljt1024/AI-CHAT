import React, { useState, useEffect, useRef } from 'react';

// 接口定义
interface LazyImageProps {
  src: string;
  alt: string;
  width?: string;
  height?: string;
  placeholder?: string;
  threshold?: number;
  className?: string;
  [key: string]: any;
}

// 自定义Hook：检测元素是否进入视口
const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsIntersecting(true);
        observer.disconnect(); // 观察到一次后就断开连接
      }
    }, options);
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
    };
  }, [options]);
  
  return [ref as React.RefObject<HTMLDivElement>, isIntersecting] as const;
};

// 懒加载图片组件
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width = '100%',
  height = 'auto',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZWVlZWVlIi8+PC9zdmc+',
  threshold = 0.1,
  className = '',
  ...props
}) => {
  const [ref, inView] = useIntersectionObserver({ threshold });
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(false);
  };

  return (
    <div
      ref={ref}
      className={`lazy-image-container ${className}`}
      style={{
        width,
        height,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: 'var(--surface-elevated)'
      }}
    >
      {inView && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
          }}
          {...props}
        />
      )}
      
      {/* 占位符 */}
      {!isLoaded && !hasError && (
        <img
          src={placeholder}
          alt="loading"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
      
      {/* 错误状态 */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--surface-hover)',
            color: 'var(--text-muted-color)',
            fontSize: '14px',
          }}
        >
          图片加载失败
        </div>
      )}
    </div>
  );
};

// 示例使用
const ImageLoad = () => {
  const images = [
    { id: 1, src: 'https://picsum.photos/400/300?random=1', alt: 'Random image 1' },
    { id: 2, src: 'https://picsum.photos/400/300?random=2', alt: 'Random image 2' },
    { id: 3, src: 'https://picsum.photos/400/300?random=3', alt: 'Random image 3' },
    { id: 4, src: 'https://picsum.photos/400/300?random=4', alt: 'Random image 4' },
    { id: 5, src: 'https://picsum.photos/400/300?random=5', alt: 'Random image 5' },
    { id: 6, src: 'https://picsum.photos/400/300?random=6', alt: 'Random image 6' },
    { id: 7, src: 'https://picsum.photos/400/300?random=7', alt: 'Random image 7' },
    { id: 8, src: 'https://picsum.photos/400/300?random=8', alt: 'Random image 8' },
     { id: 9, src: 'https://picsum.photos/400/300?random=1', alt: 'Random image 1' },
    { id: 10, src: 'https://picsum.photos/400/300?random=2', alt: 'Random image 2' },
    { id: 11, src: 'https://picsum.photos/400/300?random=3', alt: 'Random image 3' },
    { id:12, src: 'https://picsum.photos/400/300?random=4', alt: 'Random image 4' },
    { id: 13, src: 'https://picsum.photos/400/300?random=5', alt: 'Random image 5' },
    { id: 14, src: 'https://picsum.photos/400/300?random=6', alt: 'Random image 6' },
    { id: 15, src: 'https://picsum.photos/400/300?random=7', alt: 'Random image 7' },
    { id: 16, src: 'https://picsum.photos/400/300?random=8', alt: 'Random image 8' },
     { id: 17, src: 'https://picsum.photos/400/300?random=1', alt: 'Random image 1' },
    { id: 18, src: 'https://picsum.photos/400/300?random=2', alt: 'Random image 2' },
    { id: 19, src: 'https://picsum.photos/400/300?random=3', alt: 'Random image 3' },
    { id: 20, src: 'https://picsum.photos/400/300?random=4', alt: 'Random image 4' },
    { id: 21, src: 'https://picsum.photos/400/300?random=5', alt: 'Random image 5' },
    { id: 22, src: 'https://picsum.photos/400/300?random=6', alt: 'Random image 6' },
    { id: 23, src: 'https://picsum.photos/400/300?random=7', alt: 'Random image 7' },
    { id: 24, src: 'https://picsum.photos/400/300?random=8', alt: 'Random image 8' },
  ];

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>React图片懒加载示例</h1>
      <p>向下滚动查看图片懒加载效果</p>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
        {images.map((image) => (
          <LazyImage
            key={image.id}
            src={image.src}
            alt={image.alt}
            width="100%"
            height="200px"
            className="lazy-image"
          />
        ))}
      </div>
      
      {/* <div style={{ height: '1000px' }}></div> 用于产生滚动空间 */}
    </div>
  );
};

export default ImageLoad;
