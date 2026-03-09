import { useSearchParams } from 'react-router-dom';
import MarkdownContent from '@/components/MarkDownContent';
import './index.css';

const ShareMsg = () => {
    const [searchParams] = useSearchParams()
    const content = searchParams.get('content') || ''
    const reasoning_content = searchParams.get('reasoning_content') || ''
    // TODO 分享从后端获取

    return (
        <div className="share-page">
            <div className="share-shell">
                {reasoning_content && (
                    <blockquote className="share-reasoning">
                        <MarkdownContent msg={reasoning_content} />
                    </blockquote>
                )}
                <div className="share-content">
                    <MarkdownContent msg={content} />
                </div>
            </div>
        </div>
    )
}

export default ShareMsg
