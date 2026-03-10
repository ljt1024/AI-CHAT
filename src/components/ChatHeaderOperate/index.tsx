import React from 'react'
import ArrowDownIcon from '@/assets/arrowDown.svg?react';
import Popover from "../Popover";
import ThemeSwitcher from "../ThemeSwitcher"
import { ModelOption, supportsDeepThinking, supportsImageUnderstanding } from '@/types/model';
import './index.css'

interface ChatHeaderOperateProps {
  isShowShare: boolean;
  onCancelShare: (showShare: boolean) => void;
  models: ModelOption[];
  selectedModelId: string;
  isModelLoading?: boolean;
  onSelectModel: (modelId: string) => void;
}

const ChatHeaderOperate: React.FC<ChatHeaderOperateProps> = (props) => {
    const { isShowShare, onCancelShare, models, selectedModelId, isModelLoading = false, onSelectModel } = props
    const selectedModel = models.find((model) => model.id === selectedModelId)
    const selectedModelName = selectedModel?.name || selectedModelId || '请选择模型'

    const modelContent = (
        <div className="modelPopover">
            <div className="modelPopoverTitle">选择模型</div>
            <div className="modelPopoverList">
                {models.length === 0 && (
                    <div className="modelPopoverEmpty">{isModelLoading ? '模型加载中...' : '暂无可用模型'}</div>
                )}
                {models.map((model) => {
                    const isChecked = model.id === selectedModelId
                    const isDisabled = !model.enabled || isModelLoading
                    const isVisionModel = supportsImageUnderstanding(model)
                    const isThinkingModel = supportsDeepThinking(model)
                    return (
                        <button
                            type="button"
                            key={model.id}
                            className={`modelCard ${isChecked ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`.trim()}
                            disabled={isDisabled}
                            onClick={() => onSelectModel(model.id)}
                        >
                            <div className="modelCardHeader">
                                <span className="modelCardName">{model.name}</span>
                                <span className={`modelCardCheck ${isChecked ? 'checked' : ''}`.trim()}>{isChecked ? '✓' : ''}</span>
                            </div>
                            <div className="modelCardMeta">
                                <span className="modelCardProvider">{model.provider}</span>
                                {model.supportsStream ? <span className="modelCardTag">流式</span> : <span className="modelCardTag">非流式</span>}
                                {isVisionModel && <span className="modelCardTag modelCardTagVision">图片理解</span>}
                                {isThinkingModel && <span className="modelCardTag modelCardTagThinking">深度思考</span>}
                                {!model.enabled && <span className="modelCardTag modelCardTagDisabled">未启用</span>}
                            </div>
                            <p className="modelCardDesc">{model.description || '暂无模型描述'}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    )

    return (
        <div className="chatHeaderOperate">
            <div className="modelName">{selectedModelName}</div>
            <div className="headerActions">
                <Popover
                    title=""
                    content={modelContent}
                    placement="bottom-end"
                    trigger="click"
                    className="modelPopoverWrap"
                >
                    <button type="button" className="modelSelectButton" disabled={isModelLoading || models.length === 0}>
                        <span className="modelSelectText">{selectedModelName}</span>
                        <ArrowDownIcon className="modelSelectArrow" />
                    </button>
                </Popover>
                {isShowShare && <div className='shareCancel' onClick={() => { onCancelShare(false) }}>取消分享</div>}
                {!isShowShare && <ThemeSwitcher />}
            </div>
        </div>
    )
}


export default ChatHeaderOperate
