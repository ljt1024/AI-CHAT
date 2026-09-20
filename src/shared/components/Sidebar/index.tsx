import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Popover from '../Popover'
import ChatRecordDialog from './components/ChatRecordDialog'
import EditTitDialog from './components/EditTitDialog'
import DeleteDialog from './components/DeleteDialog'
import { useChat, useChatDispatch } from '@/app/providers/ChatContext'
import { useLanguage } from '@/app/providers/LanguageContext'
import { getSelectId, storageSelectId, type CovIdListItem } from '@/shared/utils/localMessages'
import './index.css'

function SidebarIcon({ name }: { name: 'search' | 'panel' | 'new' | 'more' | 'records' | 'chat' }) {
  const paths: Record<typeof name, ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="7.5" /><path d="m16 16 5 5" /></>,
    panel: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M9 3v18" /></>,
    new: <><path d="M5 19 3 21l1-6a9 9 0 1 1 4 5" /><path d="M12 7v10m-5-5h10" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    records: <><circle cx="5" cy="6" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="5" cy="18" r="1.5" /><path d="M11 6h9m-9 6h9m-9 6h9" /></>,
    chat: <><path d="M20 11a8 8 0 0 1-8 8H4l-2 3V11a9 9 0 0 1 18 0Z" /><path d="m7 10 3 3 6-6" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const timestamp = (item: CovIdListItem) => {
  for (const value of [item.latestTime, item.createTime]) {
    const time = value ? Date.parse(value) : NaN
    if (Number.isFinite(time)) return time
  }
  return 0
}

export default function Sidebar({ isLoading }: { isLoading: boolean }) {
  const { t, language } = useLanguage()
  const zh = language === 'zh'
  const { covList } = useChat()
  const dispatch = useChatDispatch()
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches)
  const [open, setOpen] = useState(() => !window.matchMedia('(max-width: 768px)').matches)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<CovIdListItem | null>(null)
  const [deleting, setDeleting] = useState<CovIdListItem | null>(null)
  const [records, setRecords] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const collapseRef = useRef<HTMLButtonElement>(null)
  const previousOpen = useRef(open)
  // Refresh date labels after midnight or when returning to a sleeping tab.
  const [today, setToday] = useState(() => new Date().toDateString())

  useEffect(() => {
    dispatch({ type: 'getCovList' })
    const media = window.matchMedia('(max-width: 768px)')
    const onResize = () => { setMobile(media.matches); setOpen(!media.matches) }
    const refreshDate = () => setToday(new Date().toDateString())
    const timer = window.setInterval(refreshDate, 60000)
    media.addEventListener('change', onResize)
    window.addEventListener('focus', refreshDate)
    return () => { media.removeEventListener('change', onResize); window.removeEventListener('focus', refreshDate); window.clearInterval(timer) }
  }, [dispatch])

  useEffect(() => { if (searching && open) searchRef.current?.focus() }, [searching, open])
  useEffect(() => {
    if (previousOpen.current !== open) (open ? collapseRef : expandRef).current?.focus()
    previousOpen.current = open
  }, [open])

  const groups = useMemo(() => {
    const now = new Date(today)
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
    const sorted = [...covList].filter(item => item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
      .sort((a, b) => Number(b.isTop) - Number(a.isTop) || timestamp(b) - timestamp(a))
    const result = new Map<string, CovIdListItem[]>()
    for (const item of sorted) {
      const time = timestamp(item)
      const date = new Date(time)
      const group = item.isTop ? (zh ? '置顶' : 'Pinned')
        : !time ? (zh ? '更早' : 'Earlier')
        : date.toDateString() === now.toDateString() ? (zh ? '今天' : 'Today')
        : date.toDateString() === yesterday.toDateString() ? (zh ? '昨天' : 'Yesterday')
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!result.has(group)) result.set(group, [])
      result.get(group)!.push(item)
    }
    return [...result.entries()]
  }, [covList, query, today, zh])

  const select = (id?: string) => {
    if (isLoading) return
    localStorage.setItem('isNewCov', String(!id))
    if (id) storageSelectId(id)
    dispatch({ type: id ? 'getLastMessages' : 'clearMessages' })
    if (!id) { setQuery(''); setSearching(false) }
    if (mobile) setOpen(false)
  }

  return <>
    {mobile && open && <button type="button" className="sidebar-backdrop" aria-label={zh ? '关闭侧栏' : 'Close sidebar'} onClick={() => setOpen(false)} />}
    <aside className={`sidebar${open ? '' : ' sidebar--collapsed'}`} aria-label={t('sidebar.history')} onKeyDown={event => {
      if (event.key === 'Escape') {
        if (searching) { setQuery(''); setSearching(false) }
        else setOpen(false)
      }
    }}>
      {open ? <>
        <header className="sidebar-header">
          <div className="sidebar-brand"><SidebarIcon name="chat" /><span>AI Chat</span></div>
          <button type="button" className="sidebar-icon-button" aria-label={zh ? '搜索对话' : 'Search chats'} aria-expanded={searching} onClick={() => { setSearching(value => !value); setQuery('') }}><SidebarIcon name="search" /></button>
          <button ref={collapseRef} type="button" className="sidebar-icon-button" aria-label={t('sidebar.collapse')} onClick={() => setOpen(false)}><SidebarIcon name="panel" /></button>
        </header>
        <button type="button" className="newCov" disabled={isLoading} onClick={() => select()}><SidebarIcon name="new" /><span>{zh ? '开启新对话' : 'New chat'}</span></button>
        {searching && <div className="sidebar-search"><SidebarIcon name="search" /><input ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={zh ? '搜索对话标题' : 'Search chat titles'} aria-label={zh ? '搜索对话标题' : 'Search chat titles'} /></div>}
        <nav className="covList" aria-label={zh ? '历史对话' : 'Chat history'}>
          <div className="sidebar-history-tools"><button type="button" className="sidebar-icon-button" disabled={isLoading} aria-label={zh ? '管理对话记录' : 'Manage chat history'} title={zh ? '管理对话记录' : 'Manage chat history'} onClick={() => setRecords(true)}><SidebarIcon name="records" /></button></div>
          {groups.map(([label, items]) => <section className="sidebar-group" key={label} aria-label={label}>
            <h2>{label}</h2>
            {items.map(item => {
              const selected = item.id === getSelectId() && localStorage.getItem('isNewCov') !== 'true'
              return <div className={`covItem${selected ? ' curCov' : ''}`} key={item.id}>
                <button type="button" className="covName" disabled={isLoading} aria-current={selected ? 'page' : undefined} title={item.title} onClick={() => select(item.id)}>{item.title || (zh ? '未命名对话' : 'Untitled chat')}</button>
                <Popover placement="bottom-end" trigger="click" content={<div className="sidebar-operations">
                  <button type="button" disabled={isLoading} onClick={() => setEditing(item)}>{t('sidebar.rename')}</button>
                  <button type="button" disabled={isLoading} onClick={() => dispatch({ type: 'top', id: item.id })}>{item.isTop ? t('sidebar.unpin') : t('sidebar.pin')}</button>
                  <button type="button" disabled={isLoading} className="sidebar-delete" onClick={() => setDeleting(item)}>{t('sidebar.delete')}</button>
                </div>}>
                  <button type="button" className="covOperation sidebar-icon-button" disabled={isLoading} aria-label={`${zh ? '更多操作' : 'More actions'} · ${item.title}`}><SidebarIcon name="more" /></button>
                </Popover>
              </div>
            })}
          </section>)}
          {!groups.length && <p className="sidebar-empty">{query ? (zh ? '没有找到匹配的对话' : 'No matching chats') : (zh ? '还没有对话，开始聊聊吧' : 'Start a conversation')}</p>}
        </nav>
        <button type="button" className="sidebar-footer" disabled={isLoading} onClick={() => setRecords(true)} aria-label={zh ? '打开会话管理' : 'Open chat management'}>
          <span className="sidebar-avatar">AI</span><span className="sidebar-footer-label">{zh ? '我的对话' : 'My chats'}<small>{zh ? `${covList.length} 个对话` : `${covList.length} conversations`}</small></span><SidebarIcon name="more" />
        </button>
      </> : <div className="sidebar-rail">
        <button ref={expandRef} type="button" className="sidebar-icon-button" aria-label={t('sidebar.expand')} onClick={() => setOpen(true)}><SidebarIcon name="panel" /></button>
        {!mobile && <button type="button" className="sidebar-icon-button" disabled={isLoading} aria-label={zh ? '开启新对话' : 'New chat'} onClick={() => select()}><SidebarIcon name="new" /></button>}
      </div>}
    </aside>
    {editing && <EditTitDialog isConfirmDialogOpen setIsConfirmDialogOpen={value => { if (!value) setEditing(null) }} covItem={editing} />}
    {deleting && <DeleteDialog isShowDeleteDialog setIsShowDeleteDialog={value => { if (!value) setDeleting(null) }} covItem={deleting} />}
    <ChatRecordDialog isShowRecordDialog={records} setIsShowRecordDialog={setRecords} />
  </>
}
