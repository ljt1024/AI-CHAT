import { useChatDispatch } from "@/context/ChatContext"
import { CovIdListItem } from "@/utils/localMessages"
import Dialog from "@/components/Dialog"

interface DeleteDialogProps {
    isShowDeleteDialog: boolean;
    setIsShowDeleteDialog: (show: boolean) => void;
    covItem: CovIdListItem | null;
    type?: number;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({ isShowDeleteDialog, setIsShowDeleteDialog, covItem, type = 0 }) => {
    const dispatch = useChatDispatch()

    const handleConfirmDelete = () => {
        if (type === 0 && covItem) {
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