import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type UserRole = 'student' | 'instructor' | 'admin'
export type SignupRole = Exclude<UserRole, 'admin'>
export type AccountAuthMode = 'email' | 'wpi'
export type AccountProfile = { id: string; email: string; display_name: string; created_at: string; updated_at: string; last_login_at: string | null }
export type Account = AccountProfile & { role: UserRole; approved: boolean; consent_required?: boolean }
let client: SupabaseClient | undefined
let active: Account | null = null
let lifecycle = new AbortController()
export function supabase(): SupabaseClient {
  const env = import.meta.env ?? {}
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('Accounts are not configured. Contact the app administrator.')
  client ??= createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.any([lifecycle.signal, AbortSignal.timeout(30000), ...(init.signal ? [init.signal] : [])]) }) },
  })
  return client
}
export function currentAccount() { return active }
export function accountSignal() { return lifecycle.signal }
export function activateAccount(account: Account | null) {
  if (active?.id !== account?.id) { lifecycle.abort(); lifecycle = new AbortController() }
  active = account
}
export function requireAccount() {
  if (!active) throw new Error('Sign in to your account.')
  return active
}
export async function accountFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const signal = lifecycle.signal
  const { data, error } = await supabase().auth.getSession()
  signal.throwIfAborted()
  if (error || !data.session) throw new Error('Your login expired. Sign in again.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return fetch(path, { ...init, headers, signal: init.signal ? AbortSignal.any([signal, init.signal]) : signal })
}
export async function signInWithWpi(client = supabase(), origin = window.location.origin) {
  const { error } = await client.auth.signInWithOAuth({ provider: 'azure', options: { scopes: 'email', redirectTo: `${origin}/account/callback` } })
  if (error) throw error
}
export async function loadAccountAuthMode(client = supabase()): Promise<AccountAuthMode> {
  const { data, error } = await client.rpc('get_account_auth_mode')
  if (error || (data !== 'email' && data !== 'wpi')) throw new Error('Sign-in is not configured. Contact the app administrator.')
  return data
}
function accountEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized) || normalized.length > 254) throw new Error('Enter a valid email address.')
  return normalized
}
function checkPassword(password: string) {
  if (password.length < 12) throw new Error('Choose a password with at least 12 characters.')
}
export async function signInWithEmail(email: string, password: string, client = supabase()) {
  const { error } = await client.auth.signInWithPassword({ email: accountEmail(email), password })
  if (error) throw error
}
export async function signUpWithEmail(email: string, password: string, role: SignupRole, client = supabase()) {
  checkPassword(password)
  if (role !== 'student' && role !== 'instructor') throw new Error('Choose Instructor or Student.')
  const { data, error } = await client.auth.signUp({ email: accountEmail(email), password, options: { data: { role } } })
  if (error) throw error
  if (!data.session) await signInWithEmail(email, password, client)
}
export async function requestPasswordReset(email: string, client = supabase(), origin = window.location.origin) {
  const { error } = await client.auth.resetPasswordForEmail(accountEmail(email), { redirectTo: `${origin}/account/reset-password` })
  if (error) throw error
}
export async function savePendingAccountRole(role: SignupRole, client = supabase()): Promise<SignupRole> {
  if (role !== 'student' && role !== 'instructor') throw new Error('Choose Instructor or Student.')
  const { data, error } = await client.rpc('set_pending_account_role', { new_role: role })
  if (error?.code === 'PGRST202') throw new Error('Account setup is incomplete. Contact the app administrator to enable account changes.')
  if (error?.code === '42501') throw new Error('Your account status changed. Refresh the page before making changes.')
  if (error || (data !== 'student' && data !== 'instructor')) throw new Error('Could not update your account type. Please retry.')
  return data
}
export async function updateAccountPassword(password: string, client = supabase()) {
  checkPassword(password)
  const { error } = await client.auth.updateUser({ password })
  if (error) throw error
}
export async function saveAccountDisplayName(account: Account, name: string, client = supabase()): Promise<Account> {
  const displayName = name.trim()
  if (!displayName || Array.from(displayName).length > 100) throw new Error('Enter a display name between 1 and 100 characters.')
  const signal = accountSignal()
  const { data, error } = await client.from('profiles')
    .update({ display_name: displayName }).eq('id', account.id)
    .select('display_name, updated_at').abortSignal(signal).single()
  signal.throwIfAborted()
  if (error || !data) throw new Error('Could not save your profile. Please try again.')
  return { ...account, display_name: data.display_name, updated_at: data.updated_at }
}
export async function completeAccountCallback(url: URL, client = supabase(), replaceUrl = (path: string) => window.history.replaceState(null, '', path)) {
  if (url.searchParams.has('error')) throw new Error('Sign-in was cancelled or denied. Please try again.')
  const code = url.searchParams.get('code')
  if (!code || url.searchParams.getAll('code').length !== 1) throw new Error('The sign-in link is incomplete. Please try again.')
  const { error } = await client.auth.exchangeCodeForSession(code)
  if (error) throw new Error('The sign-in link expired or could not be verified. Please try again.')
  replaceUrl(url.pathname === '/account/reset-password' ? '/account/reset-password' : '/dashboard')
}

export function navigateAccountPage(path: string) {
  window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export async function downloadSignedConsent(targetId?: string) {
  const response = await accountFetch(targetId ? `/api/admin/users/${encodeURIComponent(targetId)}/consent` : '/api/account/consent')
  if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Could not download your agreement.') }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = 'signed-consent.pdf'; link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}

