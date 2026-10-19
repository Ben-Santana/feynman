import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AccountGate } from './components/AccountGate.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { initializeDisplayPreferences } from './displayPreferences.ts'

initializeDisplayPreferences()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider><AccountGate>{(account, onProfileUpdated, authMode) => <App key={account.id} account={account} onProfileUpdated={onProfileUpdated} authMode={authMode} />}</AccountGate></ToastProvider>
  </StrictMode>,
)
