import { useState } from 'react'
import { updateDisplayPreferences, type DisplayPreferences } from '../displayPreferences'
import { useDisplayPreferences } from '../useDisplayPreferences'
import { matchesSetting } from '../settingsSearch'
import './DisplaySettings.css'

const sizeOptions = [
  { value: 'small', label: 'Small', size: '.95rem' },
  { value: 'default', label: 'Default', size: '1.15rem' },
  { value: 'large', label: 'Large', size: '1.35rem' },
  { value: 'extra-large', label: 'Extra large', size: '1.55rem' },
] as const
const fontOptions = [
  { value: 'default', label: 'Default', family: '"Fredoka", ui-rounded, system-ui, sans-serif' },
  { value: 'sans', label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
  { value: 'serif', label: 'Georgia', family: 'Georgia, "Times New Roman", serif' },
] as const

function SelectionMark() {
  return <span className="display-selection-mark" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 8 2.5 2.5L12 5" /></svg></span>
}
function DisplaySwitch({ id, checked, onChange, description }: { id: string; checked: boolean; onChange: () => void; description?: string }) {
  return <button id={id} className="display-switch" type="button" role="switch" aria-checked={checked} aria-labelledby={`${id}-label`} aria-describedby={description} onClick={onChange}><span className="display-switch-thumb" aria-hidden="true" /></button>
}

export function DisplaySettings({ query = '' }: { query?: string }) {
  const preferences = useDisplayPreferences()
  const [storageUnavailable, setStorageUnavailable] = useState(false)
  function update(patch: Partial<DisplayPreferences>) {
    setStorageUnavailable(!updateDisplayPreferences(patch))
  }
  return <section className="display-settings" aria-labelledby="display-settings-title">
    <header><h2 id="display-settings-title">Display</h2></header>
    {matchesSetting('darkMode', query) && <div className="display-setting-row">
      <label id="display-dark-mode-label" htmlFor="display-dark-mode">Dark mode</label>
      <DisplaySwitch id="display-dark-mode" checked={preferences.theme === 'dark'} onChange={() => update({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })} />
    </div>}
    {matchesSetting('fontSize', query) && <fieldset className="display-option-section">
      <legend>Text size</legend>
      <div className="display-size-options">{sizeOptions.map(option => <label key={option.value} className="display-choice">
        <input type="radio" name="display-font-size" value={option.value} checked={preferences.fontSize === option.value} onChange={() => update({ fontSize: option.value })} />
        <span className="display-choice-body"><span className="display-size-sample" style={{ fontSize: option.size }} aria-hidden="true">Aa</span><span className="display-choice-label">{option.label}</span><SelectionMark /></span>
      </label>)}</div>
    </fieldset>}
    {matchesSetting('fontFamily', query) && <fieldset className="display-option-section">
      <legend>Font</legend>
      <div className="display-font-options">{fontOptions.map(option => <label key={option.value} className="display-choice">
        <input type="radio" name="display-font-family" value={option.value} checked={preferences.fontFamily === option.value} onChange={() => update({ fontFamily: option.value })} />
        <span className="display-choice-body"><span className="display-font-sample" style={{ fontFamily: option.family }} aria-hidden="true">Aa</span><span className="display-choice-label">{option.label}</span><SelectionMark /></span>
      </label>)}</div>
    </fieldset>}
    {matchesSetting('boldWordStarts', query) && <div className="display-setting-row">
      <div><label id="display-bold-word-starts-label" htmlFor="display-bold-word-starts">Bold word beginnings</label><p id="display-bold-description">Emphasize word beginnings throughout the app.</p></div>
      <DisplaySwitch id="display-bold-word-starts" checked={preferences.boldWordStarts} description="display-bold-description" onChange={() => update({ boldWordStarts: !preferences.boldWordStarts })} />
    </div>}
    <div className="display-reading-preview" aria-labelledby="display-preview-title">
      <h3 id="display-preview-title">Reading preview</h3>
      <p>Learning starts with a question. Explain an idea in your own words, then explore it with an example.</p>
    </div>
    {storageUnavailable && <p className="display-storage-notice" role="status">Changes apply to this tab. Browser storage is unavailable, so they may reset when you reload.</p>}
  </section>
}
