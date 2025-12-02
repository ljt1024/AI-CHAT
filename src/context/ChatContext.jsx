import { createContext, useContext, useReducer } from "react";
import { 
    getLastMessages, 
    getCovIdList, 
    storageMessagesTit, 
    storageMessagesTop,
    storageMessagesDelete,
    storageImportMessages,
    getSelectId,
    getMessageByCovId,
    delAllMessages 
} from "@/utils/localMessages"

const ChatContext = createContext(null)

const ChatDispatchContext = createContext(null)

export const ChatProvider = ({ children }) => {
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

const chatReducer = (chatData, action) => {
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
            // 只修改最后一条message
            preMessages[preMessages.length - 1] = messages
            return {
                ...chatData,
                messages: preMessages
            }
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
            const { title, id } = action.item
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
            const preCovList = [...chatData.covList]
            let newCovList = []
            let curCov = null
            storageMessagesTop(id)
            preCovList.map(item => {
                if (item.id === id) {
                    curCov = {
                        ...item,
                        isTop: !item.isTop
                    }
                } else {
                    newCovList.push({
                        ...item,
                        isTop: false
                    })
                }
            })
            newCovList.push(curCov)
            return {
                ...chatData,
                covList: newCovList
            }
        }
        // 删除某个会话
        case 'delete': {
            const { id } = action
            const preCovList = [...chatData.covList]
            let newCovList = []
            preCovList.map(item => {
                if (item.id !== id) {
                    newCovList.push(item)
                }
            })
            storageMessagesDelete(id)
            // 如果删除的是当前选中的需要清空当前的message
            const selectId = getSelectId()
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
            return {
                covList: result.map(item=>{
                    return {
                        covId: item.covId,
                        isTop: item.isTop,
                        title: item.title
                    }
                }),
                messages: selectId ? getMessageByCovId(selectId).curMessage : []
            }
        }
        default: {
            throw Error('Unkown action:' + action.type)
        }
    }
}


