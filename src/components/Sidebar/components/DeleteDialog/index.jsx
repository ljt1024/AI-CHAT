import { useChatDispatch } from "@/context/ChatContext"
import Dialog from "@/components/Dialog"

const DeleteDialog = (props) => {
    const { isShowDeleteDialog, setIsShowDeleteDialog, covItem, type = 0 } = props
    const dispatch = useChatDispatch()

    const handleConfirmDelete = () => {
        if (type === 0) {
            dispatch({
                type: 'delete',
                id: covItem.id
            })
        } else {
            dispatch({
                type: 'deleteAll'
            })
        }
        setIsShowDeleteDialog(false)
    }

    return (
        <Dialog
            isOpen={isShowDeleteDialog}
            onClose={() => setIsShowDeleteDialog(false)}
            title={type === 0 ? '删除' : '删除全部'}
            type="confirm"
            confirmButtonStyle={{ backgroundColor: 'var(--danger-color)', outline: 'none' }}
            onConfirm={handleConfirmDelete}
        >
            <div className="deleteTip">
                确定删除{type === 0 ? '此条' : '全部'}对话记录吗？此操作不可逆，请谨慎操作
            </div>
        </Dialog>
    )
}

export default DeleteDialog