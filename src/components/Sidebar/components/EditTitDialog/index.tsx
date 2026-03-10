import { useState, useEffect, useRef } from "react"
import Dialog from "@/components/Dialog"
import { useChatDispatch } from "@/context/ChatContext"
import { CovIdListItem } from "@/utils/localMessages"

import './index.css'

interface EditTitDialogProps {
    isConfirmDialogOpen: boolean;
    setIsConfirmDialogOpen: (show: boolean) => void;
    covItem: CovIdListItem;
}

const EditTitDialog: React.FC<EditTitDialogProps> = ({ isConfirmDialogOpen, setIsConfirmDialogOpen, covItem }) => {
    const [isForce, setIsForce] = useState(false)
    const [chatTit, setChatTit] = useState(covItem?.title || '')
    const dispatch = useChatDispatch()
    const editRef = useRef<HTMLInputElement>(null)
    const inputWrapRef = useRef<HTMLDivElement>(null)
    const MAXLENGTH = 30

    useEffect(() => {
        window.addEventListener('click', handleOutClick)
        return () => {
            window.removeEventListener('click', handleOutClick)
        }
    }, [])

    // 确认修改title
    const handleConfirm = () => {
        dispatch({
            type: 'editCovTitle',
            item: {
                id: covItem.id,
                title: chatTit
            }
        })
        setIsConfirmDialogOpen(false)
    }

    // 打开弹窗点击输入框容器需要聚焦输入框
    const focusInput = (_: React.MouseEvent<HTMLDivElement>) => {
        editRef.current?.focus()
        setIsForce(true)
    }

    // 点击输入框外元素取消聚焦
    const handleOutClick = (e: MouseEvent) => {
        if (!inputWrapRef.current?.contains(e.target as Node)) {
            setIsForce(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setChatTit(e.target.value)
    }

    return (
        <Dialog
            isOpen={isConfirmDialogOpen}
            onClose={() => setIsConfirmDialogOpen(false)}
            title="编辑对话名称"
            type="confirm"
            onConfirm={handleConfirm}
        >
            <div
                className={`editContent ${isForce && 'forceWrap'}`}
                onClick={focusInput}
                ref={inputWrapRef}
            >
                <input
                    ref={editRef}
                    type="text"
                    className="editInput"
                    maxLength={MAXLENGTH}
                    value={chatTit}
                    onInput={handleInputChange}
                />
                <span className="inputControl">{chatTit.length}/{MAXLENGTH}</span>
            </div>
        </Dialog>
    )
}

export default EditTitDialog