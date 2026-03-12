import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ChatProvider } from './context/ChatContext.tsx'
import { LanguageProvider } from './context/LanguageContext.tsx'
import { ThemeProvider, applyTheme, getPreferredTheme } from './context/ThemeContext.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to find the root element')
}

applyTheme(getPreferredTheme())

createRoot(rootElement).render(
  <LanguageProvider>
    <ThemeProvider>
      <ChatProvider>
        <App />
      </ChatProvider>
    </ThemeProvider>
  </LanguageProvider>
)
