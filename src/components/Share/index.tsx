import { useScreenshot } from '../../hooks/useScreenshot';
import { useLanguage } from '@/context/LanguageContext';
import { createPortal } from 'react-dom';
import PictuerIcon from '../../assets/pictuer.png'

import './index.css'

interface ShareProps {
    targetElement: HTMLElement | null;
    setIsShowShare: (show: boolean) => void;
}

const Share: React.FC<ShareProps> = ({ targetElement, setIsShowShare }) => {
    const { t } = useLanguage()
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
                        alt={t('share.previewAlt')}
                        style={{ width: '100%' }}
                    />
                </div>
                <div className='previewHandle'>
                    <button onClick={() => download(`screenshot_${Date.now()}.jpg`)}>
                        {t('share.save')}
                    </button>
                    <button onClick={onClosePreview}>
                        {t('share.close')}
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
                    <span>{isImgLoading ? t('share.generating') : t('share.saveImage')}</span>
                </div>
            </div>
            {previewNode && typeof document !== 'undefined' ? createPortal(previewNode, document.body) : null}
        </>

    )
}

export default Share
