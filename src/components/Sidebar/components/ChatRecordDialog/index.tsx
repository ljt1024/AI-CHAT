import { useMemo, useState } from 'react'
import Dialog from '@/components/Dialog'
import Table from '@/components/Table'
import { useChat, useChatDispatch } from "@/context/ChatContext"
import { useLanguage } from "@/context/LanguageContext"
import DeleteIcon from "@/assets/icons/delete.svg?react"
import RenameIcon from "@/assets/icons/rename.svg?react"
import Icon from "@/components/Icon"
import JsonUploader from '@/components/JsonUploader'
import { exportJson } from "@/utils"
import { getLoclMessages, getCovIdList, CovIdListItem, Conversation } from "@/utils/localMessages"
import EditTitDialog from "../EditTitDialog"
import DeleteDialog from '../DeleteDialog'

import './index.css'

interface ChatRecordDialogProps {
    isShowRecordDialog: boolean;
    setIsShowRecordDialog: (show: boolean) => void;
}

const ChatRecordDialog: React.FC<ChatRecordDialogProps> = ({ isShowRecordDialog, setIsShowRecordDialog }) => {
    const { t, dateLocale } = useLanguage()
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
    const [isShowDeleteDialog, setIsShowDeleteDialog] = useState(false)
    const [isShowUploader, setIsShowUploader] = useState(false)
    const [covItem, setCovItem] = useState<CovIdListItem | null>(null)
    const [importData, setImportData] = useState<CovIdListItem[]>([])
    const [importChat, setImportChat] = useState<Conversation[]>([])
    const [delType, setDelType] = useState(0) // 0 删除单个, 1全部删除
    const { covList } = useChat()
    const dispatch = useChatDispatch()

    const sortedCovList = useMemo(() => {
        const getTimeValue = (time?: string) => {
            if (!time) return 0
            const timestamp = new Date(time).getTime()
            return Number.isNaN(timestamp) ? 0 : timestamp
        }

        return [...covList].sort((a, b) => {
            // 第一优先级：置顶会话永远在上面
            if (a.isTop !== b.isTop) {
                return a.isTop ? -1 : 1
            }

            // 第二优先级：最新会话时间倒序（最近在最上）
            const latestDiff = getTimeValue(b.latestTime) - getTimeValue(a.latestTime)
            if (latestDiff !== 0) {
                return latestDiff
            }

            // 兜底：创建时间倒序，避免同时间出现不稳定顺序
            return getTimeValue(b.createTime) - getTimeValue(a.createTime)
        })
    }, [covList])

    const handleRecordConfirm = () => {
        setIsShowRecordDialog(false)
    }

    const handleImportConfirm = ()=> {
        dispatch({
            type: 'importChat',
            data: importChat
        })
        dispatch({
            type: 'getCovList'
        })
       onCloseUploader()
    }

    const handleEdit = (item: CovIdListItem) => {
        setIsConfirmDialogOpen(true)
        setCovItem(item)
    }

    const handleDelete = (item: CovIdListItem) => {
        setIsShowDeleteDialog(true)
        setCovItem(item)
        setDelType(0)
    }

    const handleDeleteAll = ()=> {
        setIsShowDeleteDialog(true)
        setDelType(1)
    }

    const exportChat = () => {
        const data = getLoclMessages()
        const fileName = new Date().toLocaleString().replace(/\//g, '-').replace(/:/g, '.')
        exportJson(data, `chat_storage_data_${fileName}.json`).finally(() => {
            console.log('导出结束')
        })
    }

    const handleJsonUpload = (jsonData: Conversation[], filename: string) => {
        console.log('上传的JSON数据:', jsonData);
        console.log('文件名:', filename);
        const initCovList = getCovIdList(jsonData)
        setImportData(initCovList)
        setImportChat(jsonData)
    };

    // 清空导入的数据
    const onClearImport = () => {
        setImportData([])
    }

    const onCloseUploader = ()=> {
        onClearImport()
        setImportChat([])
        setIsShowUploader(false)
    }

    // 列定义
    const columns = [
        {
            key: 'id',
            title: 'ID',
            width: '240px',
            render: (_: any, row: CovIdListItem) => (
                <div className='idWrap'>
                    <div>{row.id}</div>
                    {
                        row.isTop &&
                        <div className="topTag">{t('record.top')}</div>
                    }
                </div>
            )
        },
        {
            key: 'title',
            title: t('record.column.name'),
        },
        {
            key: 'createTime',
            title: t('record.column.createTime'),
            width: '180px',
            render: (value: any) => (
                <span>{new Date(value).toLocaleString(dateLocale)}</span>
            )
        },
        {
            key: 'latestTime',
            title: t('record.column.latestTime'),
            width: '180px',
            render: (value: any) => (
                <span>{new Date(value).toLocaleString(dateLocale)}</span>
            )
        },
        {
            key: 'messageLen',
            title: t('record.column.count'),
            width: '100px',
        },
        {
            key: 'operate',
            title: t('record.column.actions'),
            width: '80px',
            render: (_: any, column: CovIdListItem) => (
                <div>
                    <Icon
                        sourceType="svg"
                        source={RenameIcon}
                        size={16}
                        color="var(--icon-color)"
                        onClick={() => { handleEdit(column) }}
                    />
                    <Icon
                        sourceType="svg"
                        source={DeleteIcon}
                        size={16}
                        style={{ marginLeft: '6px' }}
                        color="var(--danger-color)"
                        onClick={() => { handleDelete(column) }}
                    />
                </div>
            )
        }
    ];

    const importColums = [
        {
            key: 'id',
            title: 'ID',
            width: '240px',
        },
        {
            key: 'title',
            title: t('record.column.name'),
        },
        {
            key: 'createTime',
            title: t('record.column.createTime'),
            render: (value: any) => (
                <span>{new Date(value).toLocaleString(dateLocale)}</span>
            )
        },
        {
            key: 'latestTime',
            title: t('record.column.latestTime'),
            render: (value: any) => (
                <span>{new Date(value).toLocaleString(dateLocale)}</span>
            )
        },
        {
            key: 'messageLen',
            title: t('record.column.count'),
        },
        // {
        //     key: 'operate',
        //     title: '操作',
        //     render: () => (
        //         <div>
        //             <Icon
        //                 sourceType="svg"
        //                 source={RenameIcon}
        //                 size={16}
        //                 color="var(--text-color)"
        //             />
        //             <Icon
        //                 sourceType="svg"
        //                 source={DeleteIcon}
        //                 size={16}
        //                 style={{ marginLeft: '6px' }}
        //                 color="var(--danger-color)"
        //             />
        //         </div>
        //     )
        // }
    ]

    return (
        <>
            <Dialog
                isOpen={isShowRecordDialog}
                onClose={() => setIsShowRecordDialog(false)}
                title={t('record.title')}
                type="confirm"
                size="large"
                className='reacordDialog'
                onConfirm={handleRecordConfirm}
            >
                <div className='globalHandle'>
                    <button onClick={() => { exportChat() }}>{t('record.export')}</button>
                    <button onClick={() => { setIsShowUploader(true) }}>{t('record.import')}</button>
                    <button style={{ backgroundColor: 'var(--danger-color)' }} onClick={()=> { handleDeleteAll()}}>{t('record.deleteAll')}</button>
                </div>
                <Table
                    columns={columns}
                    data={sortedCovList}
                    defaultPageSize={1000}
                    striped={true}
                    hover={true}
                    bordered={false}
                    showPagination={false}
                />
            </Dialog>

            <Dialog
                isOpen={isShowUploader}
                onClose={onCloseUploader}
                title={t('record.importTitle')}
                type="confirm"
                size="small"
                className='reacordDialog'
                onConfirm={handleImportConfirm}
                isDisabledConfirm={importData.length === 0}
            >
                {
                    importData.length === 0 &&
                    <JsonUploader
                        onJsonUpload={handleJsonUpload}
                        maxFileSize={2 * 1024 * 1024} // 2MB
                    />
                }
                {
                    importData.length > 0 &&
                    <>
                        <div className='globalHandle'>
                            <button style={{ backgroundColor: 'var(--danger-color)' }} onClick={() => { onClearImport() }}>{t('record.clearData')}</button>
                        </div>
                        <Table
                            columns={importColums}
                            data={importData}
                            defaultPageSize={1000}
                            striped={true}
                            hover={true}
                            bordered={false}
                            showPagination={false}
                        />
                    </>

                }
            </Dialog>
            {
                isConfirmDialogOpen && covItem && <EditTitDialog
                    isConfirmDialogOpen={isConfirmDialogOpen}
                    setIsConfirmDialogOpen={setIsConfirmDialogOpen}
                    covItem={covItem}
                />
            }
            {
                isShowDeleteDialog && <DeleteDialog
                    isShowDeleteDialog={isShowDeleteDialog}
                    setIsShowDeleteDialog={setIsShowDeleteDialog}
                    covItem={covItem}
                    type={delType}
                />
            }
        </>
    )
}


export default ChatRecordDialog
