import React from 'react'
import ThemeSwitcher from "../ThemeSwitcher"
import './index.css'

interface ChatHeaderOperateProps {
  isShowShare: boolean;
  onCancelShare: (showShare: boolean) => void;
}

const ChatHeaderOperate: React.FC<ChatHeaderOperateProps> = (props) => {
    const { isShowShare, onCancelShare } = props
    return (
        <div className="chatHeaderOperate">
            <div className="modelName">DeepSeek-R1</div>
            {isShowShare && <div className='shareCancel' onClick={()=> {onCancelShare(false)}}>取消分享</div>}
            {!isShowShare && <ThemeSwitcher />}
        </div>
    )
}


export default ChatHeaderOperate