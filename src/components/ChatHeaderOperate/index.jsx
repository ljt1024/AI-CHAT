import ThemeSwitcher from "../ThemeSwitcher"
import './index.css'

const ChatHeaderOperate = (props) => {
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