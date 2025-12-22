import { useSearchParams } from 'react-router-dom';
import MarkdownContent from '@/components/MarkDownContent';

const ShareMsg = () => {
    const [searchParams] = useSearchParams()
    const content = searchParams.get('content') || ''
    const reasoning_content = searchParams.get('reasoning_content') || ''
    // TODO 分享从后端获取

    return <>
        <blockquote>
            <MarkdownContent msg={reasoning_content} />
        </blockquote>
        <MarkdownContent msg={content} />
    </>
}

export default ShareMsg