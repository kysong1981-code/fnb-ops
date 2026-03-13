import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// 모바일에서 숫자 인풋 스크롤로 값 변경되는 것 방지
document.addEventListener('wheel', (e) => {
  if (e.target?.type === 'number') {
    e.target.blur()
  }
}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
