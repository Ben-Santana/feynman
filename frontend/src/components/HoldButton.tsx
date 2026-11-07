import { type ComponentPropsWithRef } from 'react'
import { useHold } from './useHold'
import './HoldButton.css'

/** Runs onConfirm once the press has filled the button; releasing early drains it back down. */
export function HoldButton({ children, className = '', disabled, onConfirm, ...props }: Omit<ComponentPropsWithRef<'button'>, 'onClick' | 'type'> & { onConfirm: () => void }) {
  const hold = useHold<HTMLButtonElement>({ disabled, onConfirm })
  return <button {...props} ref={hold.ref} type="button" className={`hold-button ${className}`} disabled={disabled} {...hold.handlers}>
    <span>{children}</span>
    <span className="hold-button-fill" aria-hidden="true"><span>{children}</span></span>
  </button>
}
