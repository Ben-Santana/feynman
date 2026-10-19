import type { ButtonHTMLAttributes } from 'react'
import './SaveButton.css'

export function SaveButton({ saving = false, disabled, children = 'Save', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { saving?: boolean }) {
  return <button {...props} type={type} className={`save-button ${className}`} disabled={disabled || saving} aria-busy={saving}>
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></svg>
    {saving ? 'Saving…' : children}
  </button>
}
