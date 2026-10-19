import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { learningTypeIds, type LearningType } from '../learningTypes.js'
import { LoadingAnimation } from './AccountLoading'
import { loadedClassModelPreview, preloadClassModelPreview } from './learning-type/classModelLoader'
import { classProfiles, emphasisLevels } from './learning-type/profiles'
import './learning-type/LearningTypeSelector.css'

export function LearningTypeSelector({ value, onContinue }: {
  value: LearningType | null
  onContinue: (value: LearningType) => void
}) {
  const [selected, setSelected] = useState<LearningType>(value ?? learningTypeIds[0])
  const [hovered, setHovered] = useState<LearningType | null>(null)
  const [focused, setFocused] = useState<LearningType | null>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const [descriptionHeight, setDescriptionHeight] = useState(50)
  const [Preview, setPreview] = useState(loadedClassModelPreview)
  const [previewReady, setPreviewReady] = useState(false)
  const [previewUnavailable, setPreviewUnavailable] = useState(false)
  const ready = previewReady || previewUnavailable
  const onPreviewStatus = useCallback((status: 'loading' | 'ready' | 'failed') => {
    if (status !== 'loading') setPreviewReady(true)
  }, [])
  const expanded = focused ?? hovered ?? selected
  const profile = classProfiles[selected]

  useEffect(() => {
    let disposed = false
    void preloadClassModelPreview().then(component => {
      if (!disposed) setPreview(() => component)
    }).catch(() => { if (!disposed) setPreviewUnavailable(true) })
    return () => { disposed = true }
  }, [])

  useLayoutEffect(() => {
    const descriptions = optionsRef.current?.querySelectorAll<HTMLElement>('.class-option-description')
    if (!descriptions) return
    const measure = () => setDescriptionHeight(Math.ceil(Math.max(...Array.from(descriptions, element => element.getBoundingClientRect().height))))
    const observer = new ResizeObserver(measure)
    descriptions.forEach(element => observer.observe(element))
    measure()
    return () => observer.disconnect()
  }, [])

  return <form className={`setup-slide setup-class-type${ready ? '' : ' class-picker-pending'}`} aria-busy={!ready} data-picker-ready={ready} onSubmit={event => { event.preventDefault(); if (ready) onContinue(selected) }}>
    {!ready && <div className="class-picker-loading"><LoadingAnimation label="Loading class types" /></div>}
    <div className="class-picker-grid" inert={!ready} aria-hidden={!ready}>
      <section className="class-preview" aria-label={`${profile.name} class preview`}>
        <div className="class-model-stage">
          {Preview && <Preview position={learningTypeIds.indexOf(selected)} onStatusChange={onPreviewStatus} />}
          {previewUnavailable && <div className="class-model-fallback" role="img" aria-label="3D preview unavailable">{['∴', '∑', '⚗', '◇'][learningTypeIds.indexOf(selected)]}</div>}
        </div>
        <section className="class-properties" aria-labelledby="class-emphasis-heading">
          <h3 id="class-emphasis-heading">Level emphasis</h3>
          <div className="class-emphasis-list">{emphasisLevels.map(({ id, label }, levelIndex) => {
            const score = profile.emphasis[id]
            return <div className="class-emphasis" key={id} style={{ '--indicator-delay': `${levelIndex * 45}ms` } as CSSProperties}>
              <div className="class-emphasis-label"><span>{label}</span></div>
              <div className="level-slider-track class-emphasis-track" role="meter" aria-label={`${label} emphasis`} aria-valuemin={1} aria-valuemax={4} aria-valuenow={score} aria-valuetext={`${score} out of 4`}>
                <span className="level-slider-fill class-emphasis-fill" style={{ width: `${score * 25}%` }} />
                {[1, 2, 3, 4].map(tick => <span className="level-slider-stop" aria-hidden="true" key={tick} />)}
              </div>
            </div>
          })}</div>
        </section>
      </section>
      <fieldset className="class-options">
        <legend className="class-options-heading">Class type</legend>
        <div className="class-option-list" ref={optionsRef} style={{
          '--description-height': `${descriptionHeight}px`,
          gridTemplateRows: learningTypeIds.map(type => type === expanded
            ? 'minmax(0, calc(var(--collapsed-height) + var(--description-height)))'
            : 'minmax(0, var(--collapsed-height))').join(' '),
        } as CSSProperties}>{learningTypeIds.map(type => <label key={type}
          className={`class-option${type === selected ? ' class-option-selected' : ''}${type === expanded ? ' class-option-expanded' : ''}`}
          onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(type) }}
          onPointerLeave={() => setHovered(null)}>
          <input type="radio" name="class-type" value={type} checked={type === selected} onChange={() => setSelected(type)} onFocus={() => { setFocused(type); setHovered(null) }} onBlur={() => setFocused(null)} onKeyDown={() => setHovered(null)} aria-labelledby={`class-option-${type}-title`} aria-describedby={`class-option-${type}-description`} />
          <span className="class-option-copy">
            <span className="class-option-title" id={`class-option-${type}-title`}>{classProfiles[type].name}</span>
            <span className="class-option-details"><span className="class-option-description" id={`class-option-${type}-description`}><span>{classProfiles[type].description}</span></span></span>
          </span>
          <span className="class-option-indicator" aria-hidden="true"><span /></span>
        </label>)}</div>
      </fieldset>
    </div>
    <footer className="setup-actions class-picker-actions" inert={!ready} aria-hidden={!ready}>
      <button type="submit" disabled={!ready} className="send-button class-picker-continue">Continue <span aria-hidden="true">→</span></button>
    </footer>
  </form>
}
