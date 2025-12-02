import { useState, useEffect, useRef } from "react"
import Dialog from "@/components/Dialog"

import { useChatDispatch } from "@/context/ChatContext"

import './index.css'

const EditTitDialog = (props) => {
    const { isConfirmDialogOpen, setIsConfirmDialogOpen, covItem } = props
    const [isForce, setIsForce] = useState(false)
    const [chatTit, setChatTit] = useState(covItem?.title || '')
    const dispatch = useChatDispatch()
    const editRef = useRef()
    const inputWrapRef = useRef()
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

    // // 重命名
    // const onRename = (item) => {
    //     setChatTit(item.title)
    //     setCurCov(item)
    //     setIsConfirmDialogOpen(true)
    // }

    // 打开弹窗点击输入框容器需要聚焦输入框
    const focusInput = (e) => {
        editRef.current.focus()
        setIsForce(true)
    }

    // 点击输入框外元素取消聚焦
    const handleOutClick = (e) => {
        if (!inputWrapRef.current?.contains(e.target)) {
            setIsForce(false)
        }
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
                    onInput={e => { setChatTit(e.target.value) }}
                />
                <span className="inputControl">{chatTit.length}/{MAXLENGTH}</span>
            </div>
        </Dialog>
    )
}

export default EditTitDialog