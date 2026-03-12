import React from 'react'
import ArrowDownIcon from '@/assets/arrowDown.svg?react';
import Popover from "../Popover";
import LanguageSwitcher from "../LanguageSwitcher";
import ThemeSwitcher from "../ThemeSwitcher"
import { useLanguage } from '@/context/LanguageContext';
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
    const { t } = useLanguage()
    const { isShowShare, onCancelShare, models, selectedModelId, isModelLoading = false, onSelectModel } = props
    const selectedModel = models.find((model) => model.id === selectedModelId)
    const selectedModelName = selectedModel?.name || selectedModelId || t('header.placeholder')

    const modelContent = (
        <div className="modelPopover">
            <div className="modelPopoverTitle">{t('header.selectModelTitle')}</div>
            <div className="modelPopoverList">
                {models.length === 0 && (
                    <div className="modelPopoverEmpty">{isModelLoading ? t('header.modelsLoading') : t('header.noModels')}</div>
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
                                {model.supportsStream ? <span className="modelCardTag">{t('header.tag.stream')}</span> : <span className="modelCardTag">{t('header.tag.nonStream')}</span>}
                                {isVisionModel && <span className="modelCardTag modelCardTagVision">{t('header.tag.vision')}</span>}
                                {isThinkingModel && <span className="modelCardTag modelCardTagThinking">{t('header.tag.thinking')}</span>}
                                {!model.enabled && <span className="modelCardTag modelCardTagDisabled">{t('header.tag.disabled')}</span>}
                            </div>
                            <p className="modelCardDesc">{model.description || t('header.noDescription')}</p>
                        </button>
                    )
                })}
            </div>
        </div>
    )

    return (
        <div className="chatHeaderOperate">
            <div className="headerPrimary">
                <div className="modelName" title={selectedModelName}>{selectedModelName}</div>
                <Popover
                    title=""
                    content={modelContent}
                    placement="bottom-start"
                    trigger="click"
                    className="modelPopoverWrap"
                >
                    <button type="button" className="modelSelectButton" disabled={isModelLoading || models.length === 0}>
                        <span className="modelSelectText">{t('header.switchModel')}</span>
                        <ArrowDownIcon className="modelSelectArrow" />
                    </button>
                </Popover>
            </div>
            <div className="headerActions">
                <LanguageSwitcher />
                {isShowShare && <div className='shareCancel' onClick={() => { onCancelShare(false) }}>{t('header.cancelShare')}</div>}
                {!isShowShare && <ThemeSwitcher />}
            </div>
        </div>
    )
}


export default ChatHeaderOperate
