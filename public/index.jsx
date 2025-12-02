import { useState, useEffect, useRef } from 'react';
import ChatHeaderOperate from '../../components/ChatHeaderOperate';
import MessageItem from '../../components/MessageItem';
import Sidebar from '../../components/Sidebar';
import Share from '../../components/Share';
import ArrowDownIcon from '../../assets/arrowDown.svg';
// import { useLocalMessages } from '../../hooks/useLocalMessages'
import { MessagePopProvider } from '../../components/MessagePop'
import { useChat, useChatDispatch } from '../../context/ChatContext';
import { newChat, storageMessages } from '../../utils/localMessages'

import './chat.css';

let controller = null
let signal = null
function initAbortController() {
  controller = new AbortController();
  signal = controller.signal;
}
initAbortController()
// const controller = new AbortController();
// const signal = controller.signal;

const ChatAI = () => {
  // const [messages, setMessages] = useState([]);
  //  const { messages, covList, setMessages, getLastMessages, storageMessages, newChat, getCovIdList } = useLocalMessages()
  // const { covList, setMessages, getLastMessages, storageMessages, newChat, getCovIdList } = useLocalMessages()
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShowScrollBtn, setIsShowScrollBtn] = useState(false)
  const [isShowShare, setIsShowShare] = useState(false)
  const messagesEndRef = useRef(null);
  const messagesRef = useRef(null);
  const [imgRef, setImgRef] = useState(null)
  const { messages } = useChat()
  const dispatch = useChatDispatch()

  const handleInputChange = (value) => {
    setInputText(value);
  }
  // const storageMessages = (newMessage) => {
  //   const lastMessages = localStorage.getItem('messages') ? JSON.parse(localStorage.getItem('messages')) : [];
  //   lastMessages.push(newMessage);
  //   localStorage.setItem('messages', JSON.stringify(lastMessages));
  // }

  // const getLastMessages = () => {
  //   const lastMessages = localStorage.getItem('messages') ? JSON.parse(localStorage.getItem('messages')) : [];
  //   setMessages(lastMessages)
  // }

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({});
  };

  // const onscrollEnd = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }

  const clearMessage = () => {
    // setMessages([])
  }

  const selectMessage = () => {
    getLastMessages()
  }



  useEffect(() => {
    // getLastMessages()
    dispatch({type: 'getLastMessages'})
    const showSrollBtnHeight = 200
    const messagesRefCurrent = messagesRef.current
    messagesRefCurrent.addEventListener('scroll', () => {
      const bottomHeight = messagesRefCurrent.scrollHeight - messagesRefCurrent.scrollTop - messagesRefCurrent.clientHeight
      setIsShowScrollBtn(bottomHeight >= showSrollBtnHeight)
    })

    return () => {
      messagesRefCurrent.removeEventListener('scroll', () => {})
    }
  }, [])

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  let news = {
    content: '思考中...',
    reasoning_content: '',
    isBot: true,
    timestamp: '',
    isLoading: true
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const newMessage = {
      content: inputText,
      role: 'user',
      timestamp: new Date().toISOString()
    };

    // const isNewCov = localStorage.getItem('isNewCov')
    // if (isNewCov ]] !isNewCov ) {
    //     newChat()
    // }

    if (messages.length === 0) {
      newChat()
    }

    storageMessages(newMessage)
    setMessages(prev => [...prev, newMessage, news]);
    setInputText('');
    setIsLoading(true);


    try {
      // 调用你的 AI 接口
      // 本地服务 http://30.7.219.4:3001/api/deepseek/chat
      // 线上服务 http://118.31.167.0:3001/api/deepseek/chat
      const response = await fetch('http://118.31.167.0:3001/api/deepseek/chat', {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: "text/event-stream", Authentication: 'bearer' },
        body: JSON.stringify({
          messages: [newMessage],
          "model": "deepseek-reasoner",
          "frequency_penalty": 0,
          "max_tokens": 2048,
          "presence_penalty": 0,
          "response_format": {
            "type": "text"
          },
          "stop": null,
          "stream": true,
          "stream_options": null,
          "temperature": 1,
          "top_p": 1,
          "tools": null,
          "tool_choice": "none",
          "logprobs": false,
          "top_logprobs": null
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      news = {
        content: '',
        reasoning_content: '',
        isBot: true,
        timestamp: new Date().toISOString(),
        usage: null,
        isLoading: true
      }

      // 持续读取流数据
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        } // 流结束
        // console.log("字节流", value);
        const chunk = decoder.decode(value);
        // SSE 事件以双换行分隔
        const events = chunk.split("\n\n");
        for (const event of events) {
          if (event.trim() === "") continue;
          parseSSEEvent(event);
        }
      }
      storageMessages(news)
      // 更新会话列表
      getCovIdList()
      localStorage.setItem('isNewCov', false)
    } catch (error) {
      console.log(error)
      if (error.name === "AbortError") {
        console.log('请求被中断')
      } else {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            content: '⚠️ 服务器繁忙, 请稍后再试！',
            isBot: true,
            isError: true
          };
          return newMessages;
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  let flag = false
  const parseSSEEvent = (event) => {
    const lines = event;
    try {
      let str = lines.split(": ")[1]
      // sse最终以'data: [DONE]'结束
      if (str === '[DONE]') {
        news.isLoading = false
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = news;
          return newMessages;
        });
        return
      }
      let data = JSON.parse(str);
      if (data.usage) {
        news.usage = data.usage
      }

      // 正式回复内容
      if (data.choices[0].delta.content !== null) {
        if (flag) {
          news.content += '\n\n'
        }
        news.content += data.choices[0].delta.content
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = news;
          return newMessages;
        });
        flag = false
        // 思考内容
      } else {
        flag = true
        news.reasoning_content += data.choices[0].delta.reasoning_content
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = news;
          return newMessages;
        });
      }
    } catch (error) {
      console.log(error)
    }
  }

  const onStopSSE = () => {
    console.log('停止请求')
    controller.abort();
    initAbortController()
  }


  return (
    <MessagePopProvider>
      <div className="chat-container">
        <Sidebar
          isLoading={isLoading}
        />
        {/* {isShowShare && <div className='shareCancel' onClick={() => setIsShowShare(false)}>取消分享</div>}
        {!isShowShare && <ThemeSwitcher />} */}
        <div className='messages-content'>
          <ChatHeaderOperate isShowShare={isShowShare} onCancelShare={setIsShowShare} />
          <div className='messages-scollWrap' ref={messagesRef}>
            <div className="messages-wrap">
              {messages.map((msg, index) => (
                <MessageItem
                  msg={msg}
                  key={index}
                  isLoading={isLoading}
                  imgRef={imgRef}
                  index={index}
                  setIsShowShare={setIsShowShare}
                />
              ))}
              {isLoading && (
                <div className="typing-indicator">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {
            isShowShare && <Share getImgRef={ref => setImgRef(ref)} setIsShowShare={setIsShowShare} />
          }

          <form className="input-area" onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="输入你的问题..."
              disabled={isLoading}
            />
            {
              !isLoading ?
                <button type="submit" disabled={isLoading}>
                  发送
                </button>
                :
                <button className='stop-btn' onClick={onStopSSE}>
                  停止
                </button>
            }
          </form>

          {isShowScrollBtn &&
            <div className="chatScrollBottom" onClick={() => {
              scrollToBottom()
            }}>
              <img src={ArrowDownIcon} alt="" />
            </div>}
        </div>
      </div>
    </MessagePopProvider>
  );
};

export default ChatAI;

