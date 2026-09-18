import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js';
import javascript from 'highlight.js/lib/languages/javascript';

import 'highlight.js/styles/atom-one-dark.css';
import './index.css'

// hljs不支持vue 手动注册用js表示
hljs.registerLanguage('vue', javascript);
hljs.registerLanguage('mermaid', ()=> {
    return {
        name: 'mermaid',
        contains: [
            {
                className: 'keyword', begin: '\\b(graph|sequenceDiagram|gantt)\\b'
            },
            {
                className: 'title', begin: 'title', end: '$'
            },
            {
                className: 'commment', begin: '%%', end: '$'
            }
        ]
    }
})

interface CodeBlockProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

const HTML_LANGUAGES = new Set(['html', 'htm', 'xml', 'xhtml', 'svg']);

const buildPreviewDocument = (source: string) => {
  const trimmed = source.trim();
  if (/<!doctype html>|<html[\s>]/i.test(trimmed)) {
    return source;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body>
${source}
  </body>
</html>`;
};

const isHtmlLikeCode = (language: string, source: string) => {
  if (HTML_LANGUAGES.has(language.toLowerCase())) {
    return true;
  }
  return language === 'plaintext' && /<\/?[a-z][\s\S]*>/i.test(source.trim());
};

// 自定义代码块渲染
const codeBlockRenderer = React.memo(({ node, inline, className, children, ...props }: CodeBlockProps) => {
    const [isCopy, setIsCopy] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
    const codeText = String(children ?? '');
    const previewDialogRef = useRef<HTMLDivElement>(null);
    const match = /language-([\w-]+)/.exec(className || '');
    // console.log(children)
    let language = (match ? match[1] : 'plaintext').toLowerCase();
    const enableHtmlPreview = !inline && isHtmlLikeCode(language, codeText);
    const previewDoc = useMemo(() => {
        if (!enableHtmlPreview) {
            return '';
        }
        return buildPreviewDocument(codeText);
    }, [enableHtmlPreview, codeText]);

    useEffect(() => {
        if (!isPreviewOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !document.fullscreenElement) {
                setIsPreviewOpen(false);
            }
        };

        const handleFullscreenChange = () => {
            const currentFullscreenElement = document.fullscreenElement;
            setIsPreviewFullscreen(currentFullscreenElement === previewDialogRef.current);
        };

        document.addEventListener('keydown', handleEsc);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleEsc);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [isPreviewOpen]);
    // console.log(language, children)
    // 模型返回的code有时候并不会携带language
    // if (language === 'plaintext') {
    //     language = hljs.highlightAuto(children).language
    // }
    // let chacheLang = new Map()
    // if (!chacheLang.has(language)) {
    //     if (!hljs.listLanguages().includes(language)) {
    //         language = 'plaintext'
    //         chacheLang.set(language, 'plaintext')
    //     } else {
    //         chacheLang.set(language, language)
    //     }
    // }
    // language = chacheLang.get(language)
    if (inline) {
        return <code {...props}>{children}</code>;
    }

    if (language === 'plaintext' && !enableHtmlPreview) {
        return <span style={{ overflow: 'auto', fontSize: '16px' }}>
            <code {...props} >{children}</code>
        </span>
    }
    let codeHTML = ''
    try {
        codeHTML = hljs.highlight(codeText, { language }).value;
    } catch (error: any) {
        // 插件中找不到对应的语言。默认使用plaintext
        // codeHTML = hljs.highlight(children, { language: 'plaintext' }).value;
        // console.log(hljs.listLanguages())
        const regex = /Error: Unknown language\b/;
        const match = error.toString().match(regex);
        if (match) {
            language = 'plaintext';
            codeHTML = hljs.highlight(codeText, { language: 'plaintext' }).value;
        }
        console.log(error, 'error')
    }
    // hljs.highlightAll()
    const handleCopy = () => {
        if (isCopy) return;
        // https 和 本地支持
        if (navigator.clipboard) {
            navigator.clipboard
                .writeText(codeText)
                .then(() => {
                    console.log('已复制到剪贴板！');
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
            textArea.value = codeText;
            document.body.appendChild(textArea);
            textArea.select();

            try {
                document.execCommand("copy");
                console.log('代码已复制到剪贴板！');
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

    const closePreview = async () => {
        if (document.fullscreenElement) {
            try {
                await document.exitFullscreen();
            } catch (error) {
                console.error('退出全屏失败:', error);
            }
        }
        setIsPreviewOpen(false);
        setIsPreviewFullscreen(false);
    };

    const togglePreviewFullscreen = async () => {
        if (!previewDialogRef.current) {
            return;
        }
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await previewDialogRef.current.requestFullscreen();
            }
        } catch (error) {
            console.error('切换全屏失败:', error);
        }
    };

    return (
        <pre {...props}>
            <div className='code-copy'>
                <span>{language}</span>
                <div className='codeActions'>
                    {enableHtmlPreview && (
                        <span
                            className='copy-text'
                            onClick={() => setIsPreviewOpen(true)}
                        >
                            预览
                        </span>
                    )}
                    <span className='copy-text' onClick={handleCopy}>{isCopy ? '已复制' : '复制代码'}</span>
                </div>
            </div>
            <div className='codeWrap'>
                <code
                    className={className}
                    dangerouslySetInnerHTML={{ __html: codeHTML }}
                >
                </code>
            </div>
            {isPreviewOpen && enableHtmlPreview && typeof document !== 'undefined'
                ? createPortal(
                    <div
                        className='htmlPreviewOverlay'
                        onClick={(event) => {
                            if (event.target === event.currentTarget) {
                                closePreview();
                            }
                        }}
                    >
                        <div
                            ref={previewDialogRef}
                            className='htmlPreviewDialog'
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className='htmlPreviewHeader'>
                                <span>HTML 预览</span>
                                <div className='htmlPreviewActions'>
                                    <button
                                        type="button"
                                        className='htmlPreviewBtn'
                                        onClick={togglePreviewFullscreen}
                                    >
                                        {isPreviewFullscreen ? '退出全屏' : '全屏'}
                                    </button>
                                    <button
                                        type="button"
                                        className='htmlPreviewBtn'
                                        onClick={closePreview}
                                    >
                                        关闭
                                    </button>
                                </div>
                            </div>
                            <div className='htmlPreviewBody'>
                                <iframe
                                    className='htmlPreviewFrame'
                                    title="HTML预览"
                                    srcDoc={previewDoc}
                                    sandbox="allow-scripts allow-forms"
                                />
                            </div>
                        </div>
                    </div>,
                    document.body
                )
                : null}
        </pre>
    );
});

interface MarkdownContentProps {
  msg: string;
}

const MarkdownContent = React.memo(({ msg }: MarkdownContentProps) => {
   
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code: codeBlockRenderer,
            }}>
            {msg}
        </ReactMarkdown>
    )
})

export default MarkdownContent
