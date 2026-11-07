import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AccountGate } from './components/AccountGate.tsx'
import { ToastProvider } from './components/Toast.tsx'
import { ConfirmProvider } from './components/ConfirmDialog.tsx'
import { initializeDisplayPreferences } from './displayPreferences.ts'

initializeDisplayPreferences()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider><ConfirmProvider><AccountGate>{(account, onProfileUpdated, authMode) => <App key={account.id} account={account} onProfileUpdated={onProfileUpdated} authMode={authMode} />}</AccountGate></ConfirmProvider></ToastProvider>
  </StrictMode>,
)
