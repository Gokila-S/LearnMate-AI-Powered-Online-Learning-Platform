import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Styles
import './index.css'

// App & utilities
import App from './App.jsx'
import './utils/debugLogger.js'; // Debug logger (dev aid)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
