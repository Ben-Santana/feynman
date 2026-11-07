import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { HoldButton } from './HoldButton'
import { ConfirmContext, type ConfirmRequest } from './useConfirm'

export function ConfirmDialog({ title, children, confirmLabel, busy = false, error = '', onConfirm, onCancel, secondaryAction }: {
  title: string; children: ReactNode; confirmLabel: string; busy?: boolean; error?: string; onConfirm: () => void
  /** Leave out to require a decision: Escape then does nothing and no Cancel button shows. */
  onCancel?: () => void
  /** Replaces the Cancel button. */
  secondaryAction?: { label: string; onClick: () => void }
}) {
  const secondary = secondaryAction ?? (onCancel && { label: 'Cancel', onClick: onCancel })
  const dialog = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} className="confirm-dialog" role="alertdialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); if (!busy) onCancel?.() }} onClose={() => { if (!onCancel) dialog.current?.showModal() }}>
    <h2 id={`${id}-title`}>{title}</h2>
    <p id={`${id}-description`}>{children}</p>
    {error && <p className="confirm-dialog-error" role="alert">{error}</p>}
    <div className="confirm-dialog-actions">
      {secondary && <button type="button" className="setup-secondary" autoFocus disabled={busy} onClick={secondary.onClick}>{secondary.label}</button>}
      <HoldButton disabled={busy} onConfirm={onConfirm}>{confirmLabel}</HoldButton>
    </div>
  </dialog>
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmRequest & { id: number }) | null>(null)
  const settle = useRef<((confirmed: boolean) => void) | null>(null)
  const nextId = useRef(0)
  const confirm = useCallback((next: ConfirmRequest) => new Promise<boolean>(resolve => {
    settle.current?.(false)
    settle.current = resolve
    setRequest({ ...next, id: ++nextId.current })
  }), [])
  function finish(confirmed: boolean) {
    settle.current?.(confirmed)
    settle.current = null
    setRequest(null)
  }
  return <ConfirmContext.Provider value={confirm}>
    {children}
    {request && <ConfirmDialog key={request.id} title={request.title} confirmLabel={request.confirmLabel} onConfirm={() => finish(true)} onCancel={() => finish(false)}>{request.description}</ConfirmDialog>}
  </ConfirmContext.Provider>
}
