import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ChatAI from './views/Chat'
import ShareMsg from './views/ShareMsg'

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
