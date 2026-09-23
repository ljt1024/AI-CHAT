import { useMemo, useState } from 'react'
import Dialog from '@/shared/components/Dialog'
import { useChat, useChatDispatch } from '@/app/providers/ChatContext'
import { useLanguage } from '@/app/providers/LanguageContext'
import JsonUploader from '@/shared/components/JsonUploader'
import { exportJson } from '@/shared/utils'
import { getLoclMessages, getCovIdList, type CovIdListItem, type Conversation } from '@/shared/utils/localMessages'
import EditTitDialog from '../EditTitDialog'
import DeleteDialog from '../DeleteDialog'
import './index.css'

interface Props { isShowRecordDialog: boolean; setIsShowRecordDialog: (show: boolean) => void }
const dateValue = (value: string | undefined, locale: string) => { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) }

function RecordRow({ item, locale, onEdit, onDelete, onPin, t }: { item: CovIdListItem; locale: string; onEdit: () => void; onDelete: () => void; onPin: () => void; t: (key: any) => string }) {
  return <article className="record-card"><div className="record-card-main"><div className="record-card-title-row"><h3 title={item.title || t('sidebar.untitled')}>{item.title || t('sidebar.untitled')}</h3>{item.isTop && <span className="record-pin">{t('record.top')}</span>}</div><p className="record-card-id">{item.id}</p><div className="record-card-meta"><span>{t('record.column.latestTime')} · {dateValue(item.latestTime, locale)}</span><span>{item.messageLen} {t('record.messagesUnit')}</span></div></div><div className="record-card-actions"><button type="button" className={item.isTop ? 'record-pinned' : ''} onClick={onPin}>{item.isTop ? '★' : '☆'} {item.isTop ? t('sidebar.unpin') : t('sidebar.pin')}</button><button type="button" onClick={onEdit}>{t('sidebar.rename')}</button><button type="button" className="record-danger" onClick={onDelete}>{t('sidebar.delete')}</button></div></article>
}

const ChatRecordDialog = ({ isShowRecordDialog, setIsShowRecordDialog }: Props) => {
  const { t, dateLocale } = useLanguage(); const { covList } = useChat(); const dispatch = useChatDispatch()
  const [importOpen, setImportOpen] = useState(false); const [importData, setImportData] = useState<CovIdListItem[]>([]); const [importChat, setImportChat] = useState<Conversation[]>([])
  const [editing, setEditing] = useState<CovIdListItem | null>(null); const [deleting, setDeleting] = useState<CovIdListItem | null>(null); const [deleteAll, setDeleteAll] = useState(false)
  const sorted = useMemo(() => [...covList].sort((a, b) => Number(b.isTop) - Number(a.isTop) || (Date.parse(b.latestTime || '') || 0) - (Date.parse(a.latestTime || '') || 0)), [covList])
  const closeImport = () => { setImportOpen(false); setImportData([]); setImportChat([]) }
  const confirmImport = () => { dispatch({ type: 'importChat', data: importChat }); dispatch({ type: 'getCovList' }); closeImport() }
  const exportChat = () => { const stamp = new Date().toISOString().replace(/[.:]/g, '-'); void exportJson(getLoclMessages(), `ai-chat-conversations-${stamp}.json`) }
  return <>
    <Dialog isOpen={isShowRecordDialog} onClose={() => setIsShowRecordDialog(false)} title={t('record.title')} type="confirm" size="large" className="record-dialog" onConfirm={() => setIsShowRecordDialog(false)}>
      <div className="record-intro"><div><p className="record-eyebrow">{t('record.eyebrow')}</p><p>{t('record.subtitle')}</p></div><strong>{covList.length}<small>{t('record.conversationUnit')}</small></strong></div>
      <div className="record-toolbar"><div className="record-toolbar-group"><button type="button" className="record-primary" onClick={exportChat}>↓ <span>{t('record.export')}</span></button><button type="button" onClick={() => setImportOpen(true)}>↑ <span>{t('record.import')}</span></button></div><button type="button" className="record-delete-all" disabled={!covList.length} onClick={() => setDeleteAll(true)}>{t('record.deleteAll')}</button></div>
      <div className="record-list" aria-label={t('record.title')}>{sorted.length ? sorted.map(item => <RecordRow key={item.id} item={item} locale={dateLocale} t={t} onEdit={() => setEditing(item)} onDelete={() => setDeleting(item)} onPin={() => dispatch({ type: 'top', id: item.id })} />) : <div className="record-empty"><span>✦</span><h3>{t('record.emptyTitle')}</h3><p>{t('record.emptyHint')}</p></div>}</div>
    </Dialog>
    <Dialog isOpen={importOpen} onClose={closeImport} title={t('record.importTitle')} type="confirm" size="medium" className="import-dialog" onConfirm={confirmImport} isDisabledConfirm={!importData.length} confirmText={t('record.importConfirm')}>
      {!importData.length ? <><div className="import-heading"><span className="import-icon">JSON</span><div><h3>{t('record.importHeading')}</h3><p>{t('record.importHint')}</p></div></div><JsonUploader onJsonUpload={(data: Conversation[]) => { setImportChat(data); setImportData(getCovIdList(data)) }} maxFileSize={2 * 1024 * 1024} /></> : <><div className="import-ready"><span>✓</span><div><strong>{t('record.importReady', { count: importData.length })}</strong><p>{t('record.importMergeHint')}</p></div><button type="button" onClick={() => { setImportData([]); setImportChat([]) }}>{t('record.clearData')}</button></div><div className="import-preview">{importData.map(item => <div className="import-item" key={item.id}><span>{item.title || t('sidebar.untitled')}</span><small>{item.messageLen} {t('record.messagesUnit')} · {dateValue(item.latestTime, dateLocale)}</small></div>)}</div></>}
    </Dialog>
    {editing && <EditTitDialog isConfirmDialogOpen setIsConfirmDialogOpen={open => { if (!open) setEditing(null) }} covItem={editing} />}{deleting && <DeleteDialog isShowDeleteDialog setIsShowDeleteDialog={open => { if (!open) setDeleting(null) }} covItem={deleting} />}{deleteAll && <DeleteDialog isShowDeleteDialog setIsShowDeleteDialog={open => setDeleteAll(open)} covItem={null} type={1} />}
  </>
}
export default ChatRecordDialog
