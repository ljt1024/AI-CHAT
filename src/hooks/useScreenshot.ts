// hooks/useScreenshot.ts
import { useState, useRef, RefObject } from 'react';
import html2canvas from 'html2canvas';
import dompurify from 'dompurify';

const defaultOptions = {
    quality: 1,
    type: 'image/png',
    scale: 2, // 默认2倍高清
    backgroundColor: null
};

export const useScreenshot = (
    options = defaultOptions
) => {
    const [image, setImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const ref = useRef<HTMLElement | null>(null);

    const takeScreenshot = async (element: RefObject<HTMLElement> | null) => {

        const target = element?.current || ref.current;
        console.log(target, ref)
        if (!target) {
            setError('No target element found');
            return null;
        }

        try {
            setIsLoading(true);
            setError(null);

            const canvas = await html2canvas(target, {
                useCORS: true, // 允许跨域图片
                logging: false,
                scale: options.scale,
                backgroundColor: options.backgroundColor,
                onclone: (clonedDoc) => {
                    // 克隆文档处理特殊样式
                    const nodes = clonedDoc.querySelectorAll('[data-html2canvas-ignore]');
                    nodes.forEach(node => node.parentNode?.removeChild(node));
                }
            });

            // 安全处理图片数据
            const sanitized = dompurify.sanitize(canvas.toDataURL(options.type, options.quality));
            setImage(sanitized);
            return sanitized;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to capture screenshot');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const download = (filename = 'screenshot.png') => {
        if (!image) return;
        const link = document.createElement('a');
        link.download = filename;
        link.href = image;
        link.click();
    };

    const reset = () => {
        setImage(null);
        setError(null);
    };

    return {
        image,
        isImgLoading: isLoading,
        error,
        imgRef: ref,
        takeScreenshot,
        download,
        reset
    };
};
