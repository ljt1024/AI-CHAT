import { MessagePopProvider } from './shared/components/MessagePop';
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ChatProvider } from './app/providers/ChatContext.tsx'
import { LanguageProvider } from './app/providers/LanguageContext.tsx'
import { ThemeProvider, applyTheme, getPreferredTheme } from './app/providers/ThemeContext.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to find the root element')
}

applyTheme(getPreferredTheme())

createRoot(rootElement).render(
  <LanguageProvider>
    <ThemeProvider>
      <ChatProvider>
        <MessagePopProvider><App /></MessagePopProvider>
      </ChatProvider>
    </ThemeProvider>
  </LanguageProvider>
)
