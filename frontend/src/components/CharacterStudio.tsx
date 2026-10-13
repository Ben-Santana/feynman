import { useState } from 'react'
import { accessories, accessorySlots, characterColors, characterShapes, defaultAppearance, equipAccessory, normalizeCharacterName, type AccessorySlot, type CharacterAppearance } from '../characterAppearance'
import { Bloub, type EmotionId } from './Bloub'
import { BackButton } from './BackButton'
import { TooltipButton } from './TooltipButton'
import './CharacterStudio.css'

type StudioTab = 'accessories' | 'color' | 'shape'
const categories: { id: StudioTab; name: string }[] = [
  { id: 'color', name: 'Color' }, { id: 'shape', name: 'Shape' }, { id: 'accessories', name: 'Accessories' },
]
const moods: { id: EmotionId; name: string }[] = [
  { id: 'attentive', name: 'Calm' }, { id: 'confused', name: 'Curious' }, { id: 'excited', name: 'Happy' },
]
function CategoryIcon({ category }: { category: StudioTab }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {category === 'color' ? <><path d="M12 3a9 9 0 1 0 0 18h1.3a2.2 2.2 0 0 0 1.6-3.7 1.5 1.5 0 0 1 1.1-2.6h1.4A3.6 3.6 0 0 0 21 11.1 8.5 8.5 0 0 0 12 3Z" /><circle cx="7.5" cy="10" r=".9" fill="currentColor" /><circle cx="11" cy="6.8" r=".9" fill="currentColor" /><circle cx="15.8" cy="8" r=".9" fill="currentColor" /><circle cx="7.5" cy="15" r=".9" fill="currentColor" /></> : category === 'shape' ? <path d="M9 3h6a3 3 0 0 1 2.6 1.5l3 5.2a3 3 0 0 1 0 3l-3 5.2a3 3 0 0 1-2.6 1.5H9a3 3 0 0 1-2.6-1.5l-3-5.2a3 3 0 0 1 0-3l3-5.2A3 3 0 0 1 9 3Z" /> : <><circle cx="6.5" cy="12" r="4.5" /><circle cx="17.5" cy="12" r="4.5" /><path d="M11 12q1-2 2 0M2 11 1 9m21 2 1-2" /></>}
  </svg>
}
function Pencil() { return <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 4 4M4 12l9-9a2.1 2.1 0 0 1 3 3l-9 9-4 1Z" /></svg> }
function MoodEyes({ mood }: { mood: EmotionId }) {
  return <svg viewBox="0 0 24 20" aria-hidden="true" fill="currentColor">
    {mood === 'excited' ? <><rect x="5" y="3" width="5" height="14" rx="2.5" /><rect x="14" y="3" width="5" height="14" rx="2.5" /></> : mood === 'confused' ? <><rect x="5" y="5" width="5" height="10" rx="2.5" /><circle cx="16.5" cy="9" r="2.5" /></> : <><rect x="5" y="5" width="4" height="10" rx="2" /><rect x="15" y="5" width="4" height="10" rx="2" /></>}
  </svg>
}

export function CharacterStudio({ appearance, onSave, onCancel }: {
  appearance: CharacterAppearance; onSave: (appearance: CharacterAppearance) => void; onCancel: () => void
}) {
  const [draft, setDraft] = useState(appearance)
  const [tab, setTab] = useState<StudioTab>('accessories')
  const [slot, setSlot] = useState<AccessorySlot>('glasses')
  const [expression, setExpression] = useState<EmotionId>('attentive')
  const [followPointer, setFollowPointer] = useState(false)
  const [error, setError] = useState('')
  const [nameInput, setNameInput] = useState(() => normalizeCharacterName(appearance.name))
  const changed = JSON.stringify({ ...draft, name: normalizeCharacterName(nameInput) }) !== JSON.stringify(appearance)
  function finishName() {
    const name = normalizeCharacterName(nameInput)
    setDraft(current => ({ ...current, name }))
    setNameInput(name)
  }
  function save() {
    try { onSave({ ...draft, name: normalizeCharacterName(nameInput) }) } catch { setError('Could not save. Check your browser’s storage settings and try again.') }
  }
  function chooseAccessory(id: Parameters<typeof equipAccessory>[2]) {
    setDraft(current => equipAccessory(current, slot, id))
    setError('')
  }
  return <section className="character-studio">
    <header className="studio-header">
      <BackButton onClick={onCancel} destination="previous page" />
      {changed && <TooltipButton className="studio-unsaved-indicator" tooltip="Unsaved changes" tooltipVariant="warning" aria-label="Unsaved changes"><span aria-hidden="true" /></TooltipButton>}
    </header>
    <div className="studio-layout">
      <aside className="studio-preview" aria-label="Character preview">
        <div className="studio-stage" onPointerEnter={event => { if (event.pointerType === 'mouse') setFollowPointer(true) }} onPointerLeave={() => setFollowPointer(false)}>
        <div className="studio-moods" role="group" aria-label="Preview expression">
          {moods.map(mood => <TooltipButton type="button" key={mood.id} tooltip={mood.name} aria-label={`Preview ${mood.name.toLowerCase()} expression`} aria-pressed={expression === mood.id} onClick={() => setExpression(mood.id)}><MoodEyes mood={mood.id} /></TooltipButton>)}
        </div>
          <div className="studio-character-shadow" aria-hidden="true" />
          <div className="studio-character"><Bloub mode="studio" appearance={draft} expression={expression} showControls={false} followPointer={followPointer} /></div>
        </div>
        <div className="studio-name">
          <label className="studio-name-field"><input className="studio-name-input" aria-label="Character name" value={nameInput} maxLength={32} onChange={event => { setNameInput(event.target.value); setError('') }} onBlur={finishName} onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
            if (event.key === 'Escape') { event.preventDefault(); setNameInput(draft.name) }
          }} /><Pencil /></label>
        </div>

      </aside>
      <div className="studio-workbench">
        <div className="studio-tabs" role="group" aria-label="Customization category">
          {categories.map(category => <button key={category.id} type="button" title={category.name} aria-label={category.name} aria-pressed={tab === category.id} onClick={() => setTab(category.id)}><CategoryIcon category={category.id} /></button>)}
        </div>
        <div className="studio-options" key={tab}>
          {tab === 'color' && <div className="studio-color-grid" role="group" aria-label="Body color">{characterColors.map(item => <button className={`studio-color-card ${draft.color === item.id ? 'is-selected' : ''}`} type="button" key={item.id} aria-label={item.name} aria-pressed={draft.color === item.id} onClick={() => { setDraft(current => ({ ...current, color: item.id })); setError('') }}><span className="studio-item-art" aria-hidden="true"><Bloub mode="studio" static appearance={{ ...draft, color: item.id }} showControls={false} expression="attentive" /></span></button>)}</div>}
          {tab === 'shape' && <div className="studio-item-grid" role="group" aria-label="Body shape">{characterShapes.map(item => <button className={`studio-item-card ${draft.shape === item.id ? 'is-selected' : ''}`} key={item.id} type="button" aria-label={item.name} aria-pressed={draft.shape === item.id} onClick={() => { setDraft(current => ({ ...current, shape: item.id })); setError('') }}><span className="studio-item-art" aria-hidden="true"><Bloub mode="studio" static appearance={{ ...draft, shape: item.id }} showControls={false} expression="attentive" /></span></button>)}</div>}
          {tab === 'accessories' && <>
            <div className="studio-slot-tabs" role="group" aria-label="Accessory type">{accessorySlots.map(item => <button type="button" key={item.id} aria-pressed={slot === item.id} onClick={() => setSlot(item.id)}>{item.name}{draft.accessories[item.id] && <span className="studio-slot-dot" aria-label="Equipped" />}</button>)}</div>
            <div className="studio-item-grid studio-accessory-grid" role="group" aria-label={accessorySlots.find(item => item.id === slot)!.name} key={slot}>
              <button type="button" className={`studio-item-card ${!draft.accessories[slot] ? 'is-selected' : ''}`} aria-pressed={!draft.accessories[slot]} onClick={() => chooseAccessory(null)}><span className="studio-item-art" aria-hidden="true"><Bloub mode="studio" static previewSlot={slot} appearance={equipAccessory(draft, slot, null)} expression="attentive" showControls={false} /></span><span>None</span></button>
              {accessories.filter(item => item.slot === slot).map(item => <button type="button" key={item.id} className={`studio-item-card ${draft.accessories[slot] === item.id ? 'is-selected' : ''}`} aria-pressed={draft.accessories[slot] === item.id} onClick={() => chooseAccessory(item.id)}><span className="studio-item-art" aria-hidden="true"><Bloub mode="studio" static previewSlot={slot} appearance={equipAccessory(draft, slot, item.id)} expression="attentive" showControls={false} /></span><span>{item.name}</span></button>)}
            </div>
          </>}
        </div>
        <div className="studio-actions">
          {error && <p role="alert" className="studio-error">{error}</p>}
          <div className="studio-action-row"><button className="studio-reset" type="button" aria-label="Reset look" title="Reset look" onClick={() => { setDraft(defaultAppearance); setNameInput(defaultAppearance.name); setError('') }}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6" /></svg></button><div><button type="button" className="studio-cancel" onClick={onCancel}>Cancel</button><button type="button" className="studio-save" onClick={save}>Save character<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10h12m-5-5 5 5-5 5" /></svg></button></div></div>
        </div>
      </div>
    </div>
  </section>
}
