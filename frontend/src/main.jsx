import React from 'react'
import ReactDOM from 'react-dom/client' // Thêm dòng này để định nghĩa ReactDOM
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary' // Đảm bảo TX đã tạo file này
import './index.css'

// Cách render mới của React 18+
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)