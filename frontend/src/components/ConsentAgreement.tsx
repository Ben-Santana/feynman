import { useState, type FormEvent } from 'react'
import { accountFetch, downloadSignedConsent, supabase } from '../accounts'
import './ConsentAgreement.css'

export function ConsentAgreement({ onSigned }: { onSigned: () => void }) {
  const [signature, setSignature] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError('')
    try {
      const response = await accountFetch('/api/account/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signature, accepted, agreementVersion: 'informed-consent-v1' }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not save your agreement.')
      setSigned(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your agreement.') }
    finally { setSaving(false) }
  }
  return <main className="account-login consent-page"><section aria-labelledby="consent-title"><div className="account-card">
    <header className="account-heading"><h1 id="consent-title">{signed ? 'Agreement signed' : 'Research consent'}</h1></header>
    {signed ? <>
      <p role="status">Your signed agreement has been saved.</p>
      <button className="consent-download" disabled={saving} onClick={() => {
        setSaving(true); setError('')
        void downloadSignedConsent().catch(reason => setError(reason.message)).finally(() => setSaving(false))
      }}>Download signed agreement</button>
      <button onClick={onSigned}>Continue</button>
    </> : <>
      <div className="consent-document-heading"><span>Informed Consent Agreement</span><a href="/consent/informed-consent-v1.pdf" target="_blank" rel="noreferrer">Open PDF ↗</a></div>
      <object className="consent-document" data="/consent/informed-consent-v1.pdf" type="application/pdf" aria-label="Informed Consent Agreement, two pages">
        <p><a href="/consent/informed-consent-v1.pdf" target="_blank" rel="noreferrer">Read the consent agreement (PDF)</a> before signing.</p>
      </object>
      <form onSubmit={event => void submit(event)}>
        <label htmlFor="consent-signature">Full name<input id="consent-signature" autoComplete="name" required maxLength={100} value={signature} disabled={saving} onChange={event => setSignature(event.target.value)} aria-describedby="consent-signature-hint" /></label>
        <p id="consent-signature-hint" className="consent-hint">Type your full name as your electronic signature.</p>
        <label className="consent-check"><input type="checkbox" required checked={accepted} disabled={saving} onChange={event => setAccepted(event.target.checked)} /><span>I have read the agreement, had the opportunity to ask questions, and voluntarily consent to participate. I agree to use my typed name as my electronic signature.</span></label>
        <button disabled={saving || !accepted || !signature.trim()}>{saving ? 'Saving agreement…' : 'Sign agreement'}</button>
      </form>
      <div className="account-links"><button type="button" className="account-secondary" disabled={saving} onClick={() => {
        setSaving(true); setError('')
        void supabase().auth.signOut().then(({ error }) => { if (error) throw error }).catch(reason => setError(reason.message)).finally(() => setSaving(false))
      }}>Decline and sign out</button></div>
    </>}
    {error && <p className="account-error" role="alert">{error}</p>}
  </div></section></main>
}
