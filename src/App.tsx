import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ChatAI from './views/Chat/index.tsx'
import ShareMsg from './views/ShareMsg/index.tsx'

function App() {

  return (
      <Router>
        <Routes>
          <Route path="/ai" element={<ChatAI />} />
          <Route path="/share" element={<ShareMsg />} />
        </Routes>
      </Router>
  )
}

export default App
