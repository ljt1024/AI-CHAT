import { useScreenshot } from '../../hooks/useScreenshot';
import { createPortal } from 'react-dom';
import PictuerIcon from '../../assets/pictuer.png'

import './index.css'

interface ShareProps {
    targetElement: HTMLElement | null;
    setIsShowShare: (show: boolean) => void;
}

const Share: React.FC<ShareProps> = ({ targetElement, setIsShowShare }) => {
    const {
        image,
        isImgLoading,
        error: _error,
        takeScreenshot,
        download,
        reset
    } = useScreenshot({
        scale: 3, // 3倍高清
        type: 'image/jpeg',
        quality: 0.9,
        backgroundColor: null
    });

    const onClosePreview = () => {
        setIsShowShare(false)
        reset()
    }

    const onTakeScreenshot = () => {
        if (isImgLoading) return
        takeScreenshot(targetElement)
    }

    const previewNode = image && (
        <div className='previewMask'>
            <div className='previewContent'>
                <div className='previewImg'>
                    <img
                        src={image}
                        alt="预览"
                        style={{ width: '100%' }}
                    />
                </div>
                <div className='previewHandle'>
                    <button onClick={() => download(`screenshot_${Date.now()}.jpg`)}>
                        保  存
                    </button>
                    <button onClick={onClosePreview}>
                        关  闭
                    </button>
                </div>
            </div>
        </div>
    )

    return (
        <>
            <div className='shareWrap'>
                <div className='shareItem savePicture' onClick={onTakeScreenshot}>
                    <img src={PictuerIcon} alt="" />
                    <span>{isImgLoading ? '图片生成中' : '保存图片'}</span>
                </div>
            </div>
            {previewNode && typeof document !== 'undefined' ? createPortal(previewNode, document.body) : null}
        </>

    )
}

export default Share
