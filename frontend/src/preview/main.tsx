import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import StampPreview from './PaperStampPreview'

createRoot(document.getElementById('root')!).render(<StrictMode><StampPreview /></StrictMode>)
