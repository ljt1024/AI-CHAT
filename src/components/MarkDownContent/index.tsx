import React, { useState } from 'react';
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

// 自定义代码块渲染
const codeBlockRenderer = React.memo(({ node, inline, className, children, ...props }: CodeBlockProps) => {
    const [isCopy, setIsCopy] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    // console.log(children)
    let language = match ? match[1] : 'plaintext';
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
    if (language === 'plaintext') {
        return <span style={{ overflow: 'auto', fontSize: '16px' }}>
            <code {...props} >{children}</code>;
        </span>
    }
    let codeHTML = ''
    try {
        codeHTML = hljs.highlight(String(children), { language }).value;
    } catch (error: any) {
        // 插件中找不到对应的语言。默认使用plaintext
        // codeHTML = hljs.highlight(children, { language: 'plaintext' }).value;
        // console.log(hljs.listLanguages())
        const regex = /Error: Unknown language\b/;
        const match = error.toString().match(regex);
        if (match) {
            codeHTML = hljs.highlight(String(children), { language: 'plaintext' }).value;
        }
        console.log(error, 'error')
    }
    // hljs.highlightAll()
    const handleCopy = () => {
        if (isCopy) return;
        // https 和 本地支持
        if (navigator.clipboard) {
            navigator.clipboard
                .writeText(String(children))
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
            textArea.value = String(children);
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

    return (
        <pre {...props}>
            <div className='code-copy'>
                <span>{language}</span>
                <span className='copy-text' onClick={handleCopy}>{isCopy ? '已复制' : '复制代码'}</span>
            </div>
            <div className='codeWrap' style={{  }}>
                <code
                    className={className}
                    dangerouslySetInnerHTML={{ __html: codeHTML }}
                >
                </code>
            </div>
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