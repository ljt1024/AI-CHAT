import { v4 as uuidv4 } from 'uuid'
import { mergeArrays } from '@/utils'

// 类型定义
export interface Message {
    content: string;
    role: 'user' | 'assistant';
    timestamp?: string;
    reasoning_content?: string;
    isBot?: boolean;
    isError?: boolean;
    isLoading?: boolean;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
    };
}

export interface Conversation {
    covId: string;
    data: Message[];
    covTitle?: string;
    isTop?: boolean;
}

export interface CovIdListItem {
    id: string;
    title: string;
    isTop: boolean;
    createTime?: string;
    latestTime?: string;
    messageLen: number;
}

// 获取本地chat数据
export const getLoclMessages = (): Conversation[] => {
    const messages = localStorage.getItem('messages');
    return messages ? JSON.parse(messages) : [];
}

// 页面刷新 读取存储的已经选择的covId 获取消息列表
// 页面退出，清除缓存covId
// 待定 ** 默认获取会话列表中的最新一条数据进行展示 **
export const getLastMessages = (): Message[] => {
    let localMessages = getLoclMessages()
    if (localMessages.length === 0 || localStorage.getItem('isNewCov') === 'true') {
        return []
    }
    const currentSelectId = getSelectId()
    if (currentSelectId) {
        let selectMessages = getMessageByCovId(currentSelectId).curMessage
        return selectMessages?.data || []
    } else {
        return []
        // const newMessage = localMessages[localMessages.length - 1]
        // selectCovId = newMessage.covId
        // return newMessage.data
    }
}

//数据结构
// messages: [
//   {covId: 'uuid', data: [content: '']},
//   {covId: 'uuid', data: [content: '']},
// ]

// 存储新消息
export const storageMessages = (newMessage: Message): void => {
    let localMessages = getLoclMessages()
    const currentSelectId = localStorage.getItem('selectCovId')
    if (!currentSelectId) return
    
    const result = getMessageByCovId(currentSelectId)
    const curMessageIndx = result.curMessageIndx
    const curMessage = localMessages[curMessageIndx]?.data
    if (curMessage) {
        curMessage.push(newMessage)
        console.log('存储新消息：', localMessages)
        localStorage.setItem('messages', JSON.stringify(localMessages));
    }
}

// 获取会话列表或者导入后的会话格式化返回， 
export const getCovIdList = (importMessages?: Conversation[]): CovIdListItem[] => {
    let localMessages = importMessages ? importMessages : getLoclMessages()
    const covIdList: CovIdListItem[] = []
    // 默认新开会话title取第一条提问的title， 修改title后则取修改后的title
    localMessages.forEach((item: Conversation) => {
        covIdList.push({
            id: item.covId,
            title: item.covTitle ? item.covTitle : item.data[0]?.content || '',
            isTop: item.isTop || false,
            createTime: item.data[0]?.timestamp,
            latestTime: item.data[item.data.length - 1]?.role === 'user' ? item.data[item.data.length - 1].timestamp : item.data[item.data.length - 2]?.timestamp,
            messageLen: item.data.length 
        })
    });
    return covIdList
}

// 根据covId获取指定的消息列表
export const getMessageByCovId = (covId: string) => {
    let localMessages = getLoclMessages()
    const res = {
        curMessage: {} as Conversation | null,
        curMessageIndx: -1
    }
    for (let i = 0; i < localMessages.length; i++) {
        if (localMessages[i].covId === covId) {
            res.curMessage = localMessages[i]
            res.curMessageIndx = i
            break
        }
    }
    return res
}

// 第一次请求chat,初始化会话,并选中新的会话,
// 如果有置顶会话，则新开对话需要在置顶会话之后
export const newChat = () => {
    let localMessages = getLoclMessages()
    const newList = [...localMessages]
    const lastCov = newList[newList.length - 1]
    const newCovId = uuidv4()
    const newItem = {
        covId: newCovId,
        data: [],
        title: '',
        isTop: false
    }
    if (lastCov && lastCov.isTop) {
        localMessages.splice(-1, 0 , newItem)
    } else {
        localMessages.push(newItem)
    }

    localStorage.setItem('messages', JSON.stringify(localMessages));
    storageSelectId(newCovId)
}

// 存储当前的会话id
export const storageSelectId = (id: string): void => {
    localStorage.setItem('selectCovId', id)
}

// 获取当前会话的id
export const getSelectId = (): string | null => {
    return localStorage.getItem('selectCovId')
}

// 存储修改title后的messages
export const storageMessagesTit = (index: number, newTitle: string): void => {
    let localMessages = getLoclMessages()
    localMessages[index].covTitle = newTitle
    localStorage.setItem('messages', JSON.stringify(localMessages));
}

// 存储置顶取消置顶后的messages
export const storageMessagesTop = (id: string): void => {
    let localMessages = getLoclMessages()
    let newList: Conversation[] = []
    for (let i = 0; i < localMessages.length; i++) {
        if (localMessages[i].covId === id) {
            newList.push(localMessages[i])
            localMessages[i].isTop = true
        } else {
            if (localMessages[i].isTop) {
                newList.push(localMessages[i])
            }
        }
    }
    for (let i = 0; i < localMessages.length; i++) {
        if (localMessages[i].covId !== id && !localMessages[i].isTop) {
            newList.push(localMessages[i])
        }
    }
    localStorage.setItem('messages', JSON.stringify(newList));
}

// 删除某个会话
export const storageMessagesDelete = (id: string): void => {
    let localMessages = getLoclMessages()
    let newList: Conversation[] = []
    localMessages.map(item => {
        if (item.covId !== id) {
            newList.push(item)
        }
    })
    // 如果删除的是当前选中的会话id，需要清空选中的会话id
    if (id === getSelectId()) {
        localStorage.removeItem('selectCovId')
    }
    localStorage.setItem('messages', JSON.stringify(newList));
}

// 导入数据存储
export const storageImportMessages = (newMessages: Conversation[]): Conversation[] => {
    // 相同id的覆盖处理
    let localMessages = getLoclMessages()
    const result = mergeArrays(localMessages, newMessages)
    localStorage.setItem('messages', JSON.stringify(result));
    return result
} 

// 删除全部数据
export const delAllMessages = ()=> {
    localStorage.removeItem('selectCovId')
    localStorage.removeItem('messages')
}