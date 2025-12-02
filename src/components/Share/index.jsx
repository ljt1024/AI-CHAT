import { useScreenshot } from '../../hooks/useScreenshot';
import { useEffect } from 'react';
import PictuerIcon from '../../assets/pictuer.png'
import TextCopyIcon from '@/assets/TextCopy.png'
import { useNavigate } from 'react-router-dom';

import './index.css'

const Share = ({ getImgRef, setIsShowShare, curMsg }) => {
    const {
        imgRef,
        image,
        isImgLoading,
        error,
        takeScreenshot,
        download,
        reset
    } = useScreenshot({
        scale: 3, // 3倍高清
        type: 'image/jpeg',
        quality: 0.9
    });

    const navigate = useNavigate()

    useEffect(() => {
        getImgRef(imgRef)
    }, [])

    const onClosePreview = () => {
        setIsShowShare(false)
        reset()
    }

    const onTakeScreenshot = () => {
        if (isImgLoading) return
        takeScreenshot()
    }

    const onGenerateLink = ()=> {
        fetch('http://localhost:3001/api/chat/shareCreate', {
            method: 'post',
            body: JSON.stringify({
               msg: curMsg
            }),
            headers: {
                "Content-Type": "application/json"
            }
        }).then(response=> { return response.json()}).then(res=> {
            console.log(res)
        })
        // navigate(`/share?content=${curMsg.content}&reasoning_content=${curMsg.reasoning_content}`)
    }

    return (
        <>
            <div className='shareWrap'>
                <div className='shareItem savePicture' onClick={onTakeScreenshot}>
                    <img src={PictuerIcon} alt="" />
                    <span>{isImgLoading ? '图片生成中' : '保存图片'}</span>
                </div>
                <div className='shareItem copyText' onClick={onGenerateLink}>
                    <img src={TextCopyIcon} alt="" />
                    <span>生成链接</span>
                </div>
            </div>
            {
                image &&
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
            }
        </>

    )
}

export default Share