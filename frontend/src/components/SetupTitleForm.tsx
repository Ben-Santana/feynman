import type { ReactNode } from 'react'

export function SetupTitleForm({ heading, headingLevel = 2, inputId, inputLabel, value, onChange, onSubmit, actionLabel, placeholder, disabled = false, invalid = false, validationAttempt, feedback, error, children }: {
  heading: string; headingLevel?: 1 | 2; inputId: string; inputLabel: string; value: string; onChange: (value: string) => void; onSubmit: () => void; actionLabel: string; placeholder?: string; disabled?: boolean; invalid?: boolean; validationAttempt?: number; feedback?: ReactNode; error?: string; children?: ReactNode
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return <form className="setup-slide setup-title" aria-labelledby={`${inputId}-heading`} aria-busy={disabled} noValidate onSubmit={event => { event.preventDefault(); if (!disabled) onSubmit() }}>
    <Heading id={`${inputId}-heading`}>{heading}</Heading>
    <div className="setup-title-field">
      <label htmlFor={inputId}>{inputLabel}</label>
      <input id={inputId} value={value} onChange={event => onChange(event.target.value)} maxLength={120} autoFocus placeholder={placeholder} disabled={disabled} aria-invalid={invalid || undefined} aria-describedby={invalid && error ? `${inputId}-error` : undefined} className={invalid ? 'validation-field' : undefined} />
    </div>
    {children}
    <div className="setup-actions"><div className="validation-action">
      <button key={validationAttempt} className={`send-button${invalid ? ' validation-shake' : ''}`} disabled={disabled}>{actionLabel}</button>
      {feedback}
    </div></div>
    {error && <p id={`${inputId}-error`} className="chat-error" role="alert">{error}</p>}
  </form>
}
