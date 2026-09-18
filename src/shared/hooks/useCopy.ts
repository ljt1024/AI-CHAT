import { useState } from "react";

export const useCopy = () => {
    const [isCopy, setIsCopy] = useState(false)

    const handleCopy = (children: string, callback: () => void) => {
        if (!children) {
            throw new Error('没有复制内容')
        }
        if (isCopy) return;
        // https 和 本地支持
        if (navigator.clipboard) {
            navigator.clipboard
                .writeText(children)
                .then(() => {
                    console.log('已复制到剪贴板！');
                    callback()
                    setIsCopy(true)
                    setTimeout(() => {
                        setIsCopy(false)
                    }, 1000)
                })
                .catch((err) => {
                    console.error('复制失败:', err);
                });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = children;
            document.body.appendChild(textArea);
            textArea.select();

            try {
                document.execCommand("copy");
                console.log('代码已复制到剪贴板！');
                callback()
                setIsCopy(true)
                setTimeout(() => {
                    setIsCopy(false)
                }, 1000)
            } catch (err) {
                console.error("复制失败:", err);
            } finally {
                document.body.removeChild(textArea);
            }
        }
    };

    return {
        isCopy,
        handleCopy
    }
}

