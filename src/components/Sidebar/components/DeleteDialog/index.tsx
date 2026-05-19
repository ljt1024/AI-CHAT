import { useChatDispatch } from "@/context/ChatContext"
import { useLanguage } from "@/context/LanguageContext"
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
    const { t } = useLanguage()

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
            title={type === 0 ? t('delete.singleTitle') : t('delete.allTitle')}
            type="confirm"
            confirmButtonStyle={{ backgroundColor: 'var(--danger-color)', outline: 'none' }}
            onConfirm={handleConfirmDelete}
        >
            <div className="deleteTip">
                {type === 0 ? t('delete.singleContent') : t('delete.allContent')}
            </div>
        </Dialog>
    )
}

export default DeleteDialog
