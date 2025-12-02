import { useState } from 'react'
import Dialog from '@/components/Dialog'
import Table from '@/components/Table'
import { useChat, useChatDispatch } from "@/context/ChatContext"
import DeleteIcon from "@/assets/icons/delete.svg?react"
import RenameIcon from "@/assets/icons/rename.svg?react"
import Icon from "@/components/Icon"
import JsonUploader from '@/components/JsonUploader'
import { exportJson } from "@/utils"
import { getLoclMessages, getCovIdList } from "@/utils/localMessages"
import EditTitDialog from "../EditTitDialog"
import DeleteDialog from '../DeleteDialog'

import './index.css'

const ChatRecordDialog = (props) => {
    const { isShowRecordDialog, setIsShowRecordDialog } = props
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
    const [isShowDeleteDialog, setIsShowDeleteDialog] = useState(false)
    const [isShowUploader, setIsShowUploader] = useState(false)
    const [covItem, setCovItem] = useState(null)
    const [importData, setImportData] = useState([])
    const [importChat, setImportChat] = useState([])
    const [delType, setDelType] = useState(0) // 0 删除单个, 1全部删除
    const { covList } = useChat()
    const dispatch = useChatDispatch()

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

    const handleEdit = (item) => {
        setIsConfirmDialogOpen(true)
        setCovItem(item)
    }

    const handleDelete = (item) => {
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

    const handleJsonUpload = (jsonData, filename) => {
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
            render: (value, row) => (
                <div className='idWrap'>
                    <div>{row.id}</div>
                    {
                        row.isTop &&
                        <div className="topTag">置顶</div>
                    }
                </div>
            )
        },
        {
            key: 'title',
            title: '对话名称',
        },
        {
            key: 'createTime',
            title: '创建时间',
            render: (value) => (
                <span>{new Date(value).toLocaleString()}</span>
            )
        },
        {
            key: 'latestTime',
            title: '最新对话时间',
            render: (value) => (
                <span>{new Date(value).toLocaleString()}</span>
            )
        },
        {
            key: 'messageLen',
            title: '对话条数',
        },
        {
            key: 'operate',
            title: '操作',
            render: (_, column) => (
                <div>
                    <Icon
                        sourceType="svg"
                        source={RenameIcon}
                        size={16}
                        color="var(--text-color)"
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
            title: '对话名称',
        },
        {
            key: 'createTime',
            title: '创建时间',
            render: (value) => (
                <span>{new Date(value).toLocaleString()}</span>
            )
        },
        {
            key: 'latestTime',
            title: '最新对话时间',
            render: (value) => (
                <span>{new Date(value).toLocaleString()}</span>
            )
        },
        {
            key: 'messageLen',
            title: '对话条数',
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
        <Dialog
            isOpen={isShowRecordDialog}
            onClose={() => setIsShowRecordDialog(false)}
            title="对话记录"
            type="confirm"
            size="large"
            className='reacordDialog'
            onConfirm={handleRecordConfirm}
        >
            <div className='globalHandle'>
                <button onClick={() => { exportChat() }}>导出</button>
                <button onClick={() => { setIsShowUploader(true) }}>导入</button>
                <button style={{ backgroundColor: 'var(--danger-color)' }} onClick={()=> { handleDeleteAll()}}>删除全部会话</button>
            </div>
            <Table
                columns={columns}
                data={[...covList].reverse()}
                defaultPageSize={1000}
                striped={true}
                hover={true}
                bordered={false}
                showPagination={false}
            />

            <Dialog
                isOpen={isShowUploader}
                onClose={onCloseUploader}
                title="导入会话"
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
                            <button style={{ backgroundColor: 'var(--danger-color)' }} onClick={() => { onClearImport() }}>清空数据</button>
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
                isConfirmDialogOpen && <EditTitDialog
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
        </Dialog>
    )
}


export default ChatRecordDialog