import { createContext, useContext, type ReactNode } from 'react'

export type ConfirmRequest = { title: string; description: ReactNode; confirmLabel: string }

export const ConfirmContext = createContext<((request: ConfirmRequest) => Promise<boolean>) | null>(null)

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) throw new Error('useConfirm requires a ConfirmProvider')
  return confirm
}
