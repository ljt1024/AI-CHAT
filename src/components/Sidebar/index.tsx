import React, { useState, useEffect, useMemo } from "react"

import Tooltip from "../Tooltip"
import Popover from "../Popover"
import ChatRecordDialog from "./components/ChatRecordDialog"
import FoldIcon from "@/assets/icons/fold.svg?react"
import DeleteIcon from "@/assets/icons/delete.svg?react"
import RenameIcon from "@/assets/icons/rename.svg?react"
import TopIcon from "@/assets/icons/top.svg?react"
import FixIcon from "@/assets/icons/fix.svg?react"
import SettingIcon from "@/assets/icons/setting.svg?react"
import MesssageIcon from "@/assets/icons/message.svg?react"
import EditTitDialog from "./components/EditTitDialog"
import DeleteDialog from "./components/DeleteDialog"

import Icon from "../Icon"
import { useChat, useChatDispatch } from "@/context/ChatContext"
import { getSelectId, storageSelectId, CovIdListItem } from "@/utils/localMessages"

import './index.css'

interface ConversationProps {
  isShowSidebar: boolean;
  isLoading: boolean;
}

const Conversation: React.FC<ConversationProps> = ({ isShowSidebar, isLoading }) => {
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
    const [isShowDeleteDialog, setIsShowDeleteDialog] = useState(false)
    const [isShowRecordDialog, setIsShowRecordDialog] = useState(false)
    const [curCov, setCurCov] = useState<CovIdListItem | null>(null)
    const { covList } = useChat()
    const dispatch = useChatDispatch()

    const sortedCovList = useMemo(() => {
        const getTimeValue = (time?: string) => {
            if (!time) return 0
            const timestamp = new Date(time).getTime()
            return Number.isNaN(timestamp) ? 0 : timestamp
        }

        return [...covList].sort((a, b) => {
            // 第一优先级：置顶会话优先
            if (a.isTop !== b.isTop) {
                return a.isTop ? -1 : 1
            }

            // 第二优先级：最新会话时间倒序（最近在最上）
            const latestDiff = getTimeValue(b.latestTime) - getTimeValue(a.latestTime)
            if (latestDiff !== 0) {
                return latestDiff
            }

            // 兜底：创建时间倒序
            return getTimeValue(b.createTime) - getTimeValue(a.createTime)
        })
    }, [covList])

    useEffect(() => {
        dispatch({
            type: 'getCovList'
        })
    }, [])

    // 新开会话
    const onNewCov = () => {
        if (isLoading) return
        localStorage.setItem('isNewCov', 'true')
        dispatch({
            type: 'clearMessages'
        })
    }

    // 切换会话
    const onSelectCov = (id: string) => {
        if (isLoading) return
        localStorage.setItem('isNewCov', 'false')
        storageSelectId(id)
        dispatch({
            type: 'getLastMessages'
        })
    }

    // 获取当前会话是否是新开会话
    const getIsNewCov = () => {
        return localStorage.getItem('isNewCov') === 'true'
    }

    // 重命名
    const onRename = (item: CovIdListItem) => {
        setCurCov(item)
        setIsConfirmDialogOpen(true)
    }

    // 置顶取消置顶
    const onSetTop = (item: CovIdListItem) => {
        const { id } = item
        dispatch({
            type: 'top',
            id
        })
    }

    const onDeleteHandle = (item: CovIdListItem) => {
        setCurCov(item)
        setIsShowDeleteDialog(true)
    }

    return (
        <div className="sideContent">
            {
                isShowSidebar && <div>
                    <div className="covTit">
                        <div className="covTitLeft">
                            <Icon
                                sourceType="svg"
                                source={MesssageIcon}
                                size={18}
                                color="var(--icon-color)"
                            >

                            </Icon>
                            <span className="titText">对话记录</span>
                        </div>
                        <Icon
                            sourceType="svg"
                            source={SettingIcon}
                            size={18}
                            color="var(--icon-color)"
                            onClick={() => setIsShowRecordDialog(true)}
                        />
                    </div>
                    <div className="newCov" onClick={onNewCov} style={{ cursor: isLoading ? 'no-drop' : 'pointer' }}>
                        新开对话
                    </div>
                </div>
            }
            {
                isShowSidebar &&
                <div className="covList">
                    {sortedCovList.map(item => {
                        return (
                            <div
                                className={item.id === getSelectId() && !getIsNewCov() ? 'curCov covItem' : 'covItem'}
                                key={item.id}
                                onClick={() => { onSelectCov(item.id) }}
                                style={{ cursor: isLoading ? 'no-drop' : 'pointer' }}
                            >
                                <span className="covName">{item.title}</span>
                                <Popover
                                    title=""
                                    content={
                                        <div className="operationBox">
                                            <div className="operationItem" onClick={() => onRename(item)}>
                                                <Icon
                                                    sourceType="svg"
                                                    source={RenameIcon}
                                                    size={18}
                                                    color="var(--icon-color)"
                                                />
                                                <span className="operationTit">重命名</span>
                                            </div>
                                            <div className="operationItem" onClick={() => onSetTop(item)}>
                                                <Icon
                                                    sourceType="svg"
                                                    source={TopIcon}
                                                    size={18}
                                                    color="var(--icon-color)"
                                                />
                                                <span className="operationTit">{item.isTop ? '取消置顶' : '置顶'}</span>
                                            </div>
                                            <div className="operationItem" onClick={() => { onDeleteHandle(item) }}>
                                                <Icon
                                                    sourceType="svg"
                                                    source={DeleteIcon}
                                                    size={18}
                                                    color="var(--danger-color)"
                                                />
                                                <span className="operationTit">删除</span>
                                            </div>
                                        </div>

                                    }
                                    placement="right"
                                    trigger="click"
                                >
                                    {item.isTop &&
                                        <div className="fixIcon">
                                            <Icon
                                                sourceType="svg"
                                                source={FixIcon}
                                                size={14}
                                                color="var(--icon-muted-color)"
                                            />
                                        </div>}
                                    <div className="covOperation">...</div>
                                </Popover>
                            </div>
                        )

                    })}
                </div>
            }
            {
                isConfirmDialogOpen && <EditTitDialog
                    isConfirmDialogOpen={isConfirmDialogOpen}
                    setIsConfirmDialogOpen={setIsConfirmDialogOpen}
                    covItem={curCov as CovIdListItem}
                />
            }
            {
                 isShowDeleteDialog && <DeleteDialog
                    isShowDeleteDialog={isShowDeleteDialog}
                    setIsShowDeleteDialog={setIsShowDeleteDialog}
                    covItem={curCov}
                />
            }
            <ChatRecordDialog
                isShowRecordDialog={isShowRecordDialog}
                setIsShowRecordDialog={setIsShowRecordDialog}
            />
        </div>
    )
}


interface SidebarProps {
  isLoading: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isLoading }) => {
    const [isShowSidebar, setIsShowSidebar] = useState<boolean>(true)
    const onShowSidebar = () => {
        setIsShowSidebar((value) => !value)
    }

    return (
        <div className={isShowSidebar ? 'sidebar' : 'hiddenSideBar sidebar'}>
            <Conversation
                isShowSidebar={isShowSidebar}
                isLoading={isLoading}
            />
            {/* <img src={ArrowDown} alt="" className="fold-icon" onClick={onShowSidebar} /> */}

            <div className="fold-icon">
                <Tooltip content={`${isShowSidebar ? '收起' : '展开'}`} placement="right" style={{ marginLeft: '10px' }}>
                    <Icon
                        sourceType="svg"
                        source={FoldIcon}
                        size={18}
                        color="var(--icon-color)"
                        onClick={onShowSidebar}
                    />
                </Tooltip>
            </div>
        </div>
    )
}

export default Sidebar
