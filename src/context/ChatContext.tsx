import React, { createContext, useContext, useReducer, ReactNode } from "react";
import { 
    getLastMessages, 
    getCovIdList, 
    storageMessagesTit, 
    storageMessagesTop,
    storageMessagesDelete,
    storageImportMessages,
    getSelectId,
    getMessageByCovId,
    delAllMessages,
    Message,
    Conversation,
    CovIdListItem
} from "@/utils/localMessages"

// 类型定义
interface ChatData {
    covList: CovIdListItem[];
    messages: Message[];
}

interface ChatAction {
    type: string;
    messages?: Message | Message[];
    item?: { title: string; id: string };
    id?: string;
    data?: any;
}

const ChatContext = createContext<ChatData | null>(null)

const ChatDispatchContext = createContext<React.Dispatch<ChatAction> | null>(null)

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [chatData, dispatch] = useReducer(chatReducer, initialChatData)

    return (
        <ChatContext value={chatData}>
            <ChatDispatchContext value={dispatch}>
                {children}
            </ChatDispatchContext>
        </ChatContext>
    )
}

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}

export const useChatDispatch = () => {
    const context = useContext(ChatDispatchContext);
    if (!context) {
        throw new Error('useChatDispatch must be used within a ChatProvider');
    }
    return context;
}

const initialChatData = {
    covList: [],
    messages: []
}

const chatReducer = (chatData: ChatData, action: ChatAction): ChatData => {
    switch (action.type) {
        // 获取历史消息
        case 'getLastMessages': {
            const messages = getLastMessages()
            return {
                ...chatData,
                messages: [...messages] // 防止引用
            }
        }
        // 添加消息
        case 'addMessages': {
            const messages = action.messages
            const preMessages = [...chatData.messages]
            //用户发送消息时候需要存储发送的消息，以及回复响应之前的加载文案
            if (Array.isArray(messages)) {
                return {
                    ...chatData,
                    messages: [...preMessages, ...messages]
                }
            }
            if (messages) {
                // 只修改最后一条message
                preMessages[preMessages.length - 1] = messages
                return {
                    ...chatData,
                    messages: preMessages
                }
            }
            return chatData;
        }
        // 获取会话列表
        case 'getCovList': {
            const covList = getCovIdList()
            return {
                ...chatData,
                covList: [...covList]
            }
        }
        // 清空会话的消息
        case 'clearMessages': {
            return {
                ...chatData,
                messages: []
            }
        }
        // 修改会话title
        case 'editCovTitle': {
            const { title, id } = action.item || {}
            if (!title || !id) return chatData;
            const preCovList = [...chatData.covList]
            return {
                ...chatData,
                covList: preCovList.map((item, index) => {
                    if (item.id === id) {
                        storageMessagesTit(index, title)
                        return {
                            ...item,
                            title,
                        }
                    } else {
                        return item
                    }
                })
            }
        }
        // 置顶会话
        case 'top': {
            const id = action.id
            if (!id) return chatData;
            storageMessagesTop(id)
            // 重新获取会话列表，确保顺序正确
            const covList = getCovIdList()
            return {
                ...chatData,
                covList: [...covList]
            }
        }
        // 删除某个会话
        case 'delete': {
            const { id } = action
            if (!id) return chatData;
            const preCovList = [...chatData.covList]
            let newCovList: CovIdListItem[] = []
            preCovList.map(item => {
                if (item.id !== id) {
                    newCovList.push(item)
                }
            })
            const selectId = getSelectId()
            // 如果删除的是当前选中的需要清空当前的message
            storageMessagesDelete(id)
            return {
                covList: newCovList,
                messages: selectId === id ? [] : chatData.messages
            }
        }
        // 删除全部会话
        case 'deleteAll': {
            delAllMessages()
            return {
                covList: [],
                messages: []
            }
        }
        // 导入会话
        case 'importChat' : {
            const { data } = action
            const result = storageImportMessages(data)
            const selectId = getSelectId()
            const covList = result.map((item: Conversation) => {
                return {
                    id: item.covId,
                    title: item.covTitle || item.data[0]?.content || '',
                    isTop: item.isTop || false,
                    messageLen: item.data.length,
                    createTime: item.data[0]?.timestamp,
                    latestTime: item.data[item.data.length - 1]?.timestamp
                }
            })
            const curMessage = selectId ? getMessageByCovId(selectId).curMessage : null
            return {
                covList,
                messages: curMessage?.data || []
            }
        }
        default: {
            throw Error('Unkown action:' + action.type)
        }
    }
}


