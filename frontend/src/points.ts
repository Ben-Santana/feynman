import { useSyncExternalStore } from 'react'
import { accountSignal, requireAccount, supabase } from './accounts.ts'

/** points is null for admins, whose balance is unlimited. */
export type Wallet = { points: number | null; owned: string[] }
type WalletState = { wallet: Wallet | null; error: string }

export function createWalletStore({ client = supabase, getAccount = requireAccount, getSignal = accountSignal } = {}) {
  let state: WalletState = { wallet: null, error: '' }
  let accountId = ''
  let latest = 0
  const listeners = new Set<() => void>()
  function publish(next: WalletState) {
    state = next
    listeners.forEach(listener => listener())
  }
  function startRequest() {
    const id = getAccount().id
    if (id !== accountId) { accountId = id; publish({ wallet: null, error: '' }) }
    return ++latest
  }

  async function refreshWallet() {
    const request = startRequest(), signal = getSignal()
    const { data, error } = await client().rpc('cosmetic_wallet').abortSignal(signal)
    if (signal.aborted || request !== latest) return
    publish(error ? { ...state, error: 'Could not load your points. Reload to try again.' } : { wallet: data as Wallet, error: '' })
  }
  async function purchaseCosmetic(item: string) {
    const request = startRequest(), signal = getSignal()
    const { data, error } = await client().rpc('purchase_cosmetic', { target_item: item }).abortSignal(signal)
    signal.throwIfAborted()
    if (error) {
      void refreshWallet()
      throw new Error(error.code === '23514' ? 'Not enough points.' : 'Could not complete the purchase. Try again.')
    }
    if (request === latest) publish({ wallet: data as Wallet, error: '' })
    else void refreshWallet()
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  return { refreshWallet, purchaseCosmetic, subscribe, getState: () => state }
}

const store = createWalletStore()
export const { refreshWallet, purchaseCosmetic } = store
export const useWallet = () => useSyncExternalStore(store.subscribe, store.getState)
