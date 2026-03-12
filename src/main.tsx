import React from 'react'
import ReactDOM from 'react-dom/client'
import { installElectronMock } from './lib/electronMock'
import App from './App'
import './index.css'

// When running in a browser (not Electron), install mock API so UI doesn't crash
installElectronMock()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
