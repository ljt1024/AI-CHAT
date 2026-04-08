import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = 'zh' | 'en';

const LANGUAGE_STORAGE_KEY = 'appLanguage';

type TranslationValue = string;
type TranslationKey = keyof typeof translations.zh;
type TranslationParams = Record<string, string | number | undefined>;

const translations = {
  zh: {
    'dialog.defaultTitle': '提示',
    'dialog.confirm': '确定',
    'dialog.cancel': '取消',
    'dialog.close': '关闭对话框',
    'header.placeholder': '请选择模型',
    'header.switchModel': '切换模型',
    'header.selectModelTitle': '选择模型',
    'header.modelsLoading': '模型加载中...',
    'header.noModels': '暂无可用模型',
    'header.tag.stream': '流式',
    'header.tag.nonStream': '非流式',
    'header.tag.vision': '图片理解',
    'header.tag.thinking': '深度思考',
    'header.tag.disabled': '未启用',
    'header.noDescription': '暂无模型描述',
    'header.cancelShare': '取消分享',
    'language.label': '语言',
    'language.switchToZh': '切换到中文',
    'language.switchToEn': '切换到英文',
    'theme.switchToLight': '切换到明亮模式',
    'theme.switchToDark': '切换到暗黑模式',
    'chat.defaultDescription': '默认推理模型',
    'chat.loading': '思考中...',
    'chat.serverBusy': '⚠️ 服务器繁忙, 请稍后再试！',
    'chat.subtitle': '你的AI问答助手',
    'input.placeholder': '请输入你的问题...',
    'input.uploading': '文件上传中...',
    'input.upload': '上传文件',
    'input.removeFile': '移除{name}',
    'input.onlyImageError': '当前模型仅支持上传图片文件',
    'input.thinkingLabel': '深度思考',
    'input.enableThinking': '开启深度思考',
    'input.disableThinking': '关闭深度思考',
    'sidebar.history': '对话记录',
    'sidebar.newConversation': '新开对话',
    'sidebar.rename': '重命名',
    'sidebar.pin': '置顶',
    'sidebar.unpin': '取消置顶',
    'sidebar.delete': '删除',
    'sidebar.collapse': '收起',
    'sidebar.expand': '展开',
    'record.title': '对话记录',
    'record.export': '导出',
    'record.import': '导入',
    'record.deleteAll': '删除全部会话',
    'record.importTitle': '导入会话',
    'record.clearData': '清空数据',
    'record.top': '置顶',
    'record.column.name': '对话名称',
    'record.column.createTime': '创建时间',
    'record.column.latestTime': '最新对话时间',
    'record.column.count': '对话条数',
    'record.column.actions': '操作',
    'delete.singleTitle': '删除',
    'delete.allTitle': '删除全部',
    'delete.singleContent': '确定删除此条对话记录吗？此操作不可逆，请谨慎操作',
    'delete.allContent': '确定删除全部对话记录吗？此操作不可逆，请谨慎操作',
    'edit.title': '编辑对话名称',
    'share.previewAlt': '预览',
    'share.save': '保存',
    'share.close': '关闭',
    'share.generating': '图片生成中',
    'share.saveImage': '保存图片',
    'message.copySuccess': '复制成功',
    'message.copy': '复制',
    'message.retry': '重试',
    'message.share': '分享',
    'message.inputTokens': '输入token',
    'message.outputTokens': '输出token',
    'message.expandContent': '展开内容',
    'json.selectJson': '请选择JSON文件',
    'json.maxFileSize': '文件大小不能超过 {size}KB',
    'json.parseError': '无法解析JSON文件: {message}',
    'json.readError': '读取文件时发生错误',
    'json.processing': '正在处理...',
    'json.dropHint': '点击或拖放JSON文件到这里',
    'json.fileSizeHint': '最大文件大小: {size}KB',
    'table.filter': '筛选 {title}',
    'table.noData': '暂无数据',
    'table.summary': '显示 {start} 到 {end} 条，共 {total} 条',
    'table.pageSize5': '5 条/页',
    'table.pageSize10': '10 条/页',
    'table.pageSize20': '20 条/页',
    'table.pageSize50': '50 条/页',
    'table.first': '首页',
    'table.prev': '上一页',
    'table.page': '第 {current} 页 / 共 {total} 页',
    'table.next': '下一页',
    'table.last': '末页',
    'screenshot.error': '图片生成异常'
  },
  en: {
    'dialog.defaultTitle': 'Notice',
    'dialog.confirm': 'Confirm',
    'dialog.cancel': 'Cancel',
    'dialog.close': 'Close dialog',
    'header.placeholder': 'Select a model',
    'header.switchModel': 'Models',
    'header.selectModelTitle': 'Choose Model',
    'header.modelsLoading': 'Loading models...',
    'header.noModels': 'No models available',
    'header.tag.stream': 'Streaming',
    'header.tag.nonStream': 'Non-stream',
    'header.tag.vision': 'Vision',
    'header.tag.thinking': 'Thinking',
    'header.tag.disabled': 'Disabled',
    'header.noDescription': 'No description available',
    'header.cancelShare': 'Cancel Share',
    'language.label': 'Language',
    'language.switchToZh': 'Switch to Chinese',
    'language.switchToEn': 'Switch to English',
    'theme.switchToLight': 'Switch to Light Mode',
    'theme.switchToDark': 'Switch to Dark Mode',
    'chat.defaultDescription': 'Default reasoning model',
    'chat.loading': 'Thinking...',
    'chat.serverBusy': '⚠️ Server is busy, please try again later!',
    'chat.subtitle': 'Your AI conversation assistant',
    'input.placeholder': 'Ask anything...',
    'input.uploading': 'Uploading file...',
    'input.upload': 'Upload file',
    'input.removeFile': 'Remove {name}',
    'input.onlyImageError': 'This model only supports image uploads',
    'input.thinkingLabel': 'Thinking',
    'input.enableThinking': 'Enable deep thinking',
    'input.disableThinking': 'Disable deep thinking',
    'sidebar.history': 'Conversations',
    'sidebar.newConversation': 'New Chat',
    'sidebar.rename': 'Rename',
    'sidebar.pin': 'Pin',
    'sidebar.unpin': 'Unpin',
    'sidebar.delete': 'Delete',
    'sidebar.collapse': 'Collapse',
    'sidebar.expand': 'Expand',
    'record.title': 'Conversation Records',
    'record.export': 'Export',
    'record.import': 'Import',
    'record.deleteAll': 'Delete All',
    'record.importTitle': 'Import Conversations',
    'record.clearData': 'Clear Data',
    'record.top': 'Pinned',
    'record.column.name': 'Conversation Name',
    'record.column.createTime': 'Created At',
    'record.column.latestTime': 'Latest Message',
    'record.column.count': 'Messages',
    'record.column.actions': 'Actions',
    'delete.singleTitle': 'Delete',
    'delete.allTitle': 'Delete All',
    'delete.singleContent': 'Delete this conversation? This action cannot be undone.',
    'delete.allContent': 'Delete all conversations? This action cannot be undone.',
    'edit.title': 'Edit Conversation Name',
    'share.previewAlt': 'Preview',
    'share.save': 'Save',
    'share.close': 'Close',
    'share.generating': 'Generating image',
    'share.saveImage': 'Save Image',
    'message.copySuccess': 'Copied',
    'message.copy': 'Copy',
    'message.retry': 'Retry',
    'message.share': 'Share',
    'message.inputTokens': 'Input tokens',
    'message.outputTokens': 'Output tokens',
    'message.expandContent': 'Expand content',
    'json.selectJson': 'Please select a JSON file',
    'json.maxFileSize': 'File size must not exceed {size}KB',
    'json.parseError': 'Failed to parse JSON: {message}',
    'json.readError': 'An error occurred while reading the file',
    'json.processing': 'Processing...',
    'json.dropHint': 'Click or drag a JSON file here',
    'json.fileSizeHint': 'Max file size: {size}KB',
    'table.filter': 'Filter {title}',
    'table.noData': 'No data',
    'table.summary': 'Showing {start} to {end} of {total}',
    'table.pageSize5': '5 / page',
    'table.pageSize10': '10 / page',
    'table.pageSize20': '20 / page',
    'table.pageSize50': '50 / page',
    'table.first': 'First',
    'table.prev': 'Prev',
    'table.page': 'Page {current} / {total}',
    'table.next': 'Next',
    'table.last': 'Last',
    'screenshot.error': 'Failed to generate image'
  }
} satisfies Record<AppLanguage, Record<string, TranslationValue>>;

const getStoredLanguage = (): AppLanguage | null => {
  if (typeof window === 'undefined') return null;
  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return storedLanguage === 'zh' || storedLanguage === 'en' ? storedLanguage : null;
};

const formatMessage = (template: string, params?: TranslationParams) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ''));
};

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  dateLocale: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<AppLanguage>(() => getStoredLanguage() || 'zh');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, params) => {
      const template = translations[language][key] || translations.zh[key] || key;
      return formatMessage(template, params);
    },
    dateLocale: language === 'zh' ? 'zh-CN' : 'en-US'
  }), [language]);

  return <LanguageContext value={value}>{children}</LanguageContext>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  return context;
};
