import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AccessGate from './components/AccessGate.tsx'
import { defaultTheme, setTheme } from './theme.ts'

setTheme(defaultTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccessGate><App /></AccessGate>
  </StrictMode>,
)
