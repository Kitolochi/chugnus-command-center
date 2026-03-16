import React from 'react'
import ReactDOM from 'react-dom/client'
import { installElectronMock } from './lib/electronMock'
import App from './App'
import './index.css'

// When running in a browser (not Electron), install mock API so UI doesn't crash
installElectronMock()

// Prevent unhandled promise rejections from killing the renderer process
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandled rejection]', e.reason)
  e.preventDefault()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
