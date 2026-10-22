import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import './Select.css'

type SelectOption = { value: string; label: string }

export function Select({ label, value, options, onChange }: {
  label: string
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
}) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const search = useRef({ text: '', time: 0 })
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selected = options.findIndex(option => option.value === value)

  useEffect(() => {
    if (!open) return
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function show(index = Math.max(selected, 0)) {
    search.current = { text: '', time: 0 }
    setActive(index)
    setOpen(true)
  }

  function choose(index: number) {
    if (!options[index]) return
    onChange(options[index].value)
    setOpen(false)
    trigger.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!options.length) return
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault()
        if (!open) show(selected >= 0 ? selected : event.key === 'ArrowDown' ? 0 : options.length - 1)
        else setActive(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
        return
      case 'Home':
      case 'End':
        event.preventDefault()
        show(event.key === 'Home' ? 0 : options.length - 1)
        return
      case 'Enter':
      case ' ':
        if (event.key === ' ' && search.current.text && Date.now() - search.current.time < 700) break
        event.preventDefault()
        if (open) choose(active)
        else show()
        return
      case 'Escape':
        if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false) }
        return
      case 'Tab':
        setOpen(false)
        return
    }
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    const now = Date.now()
    const text = (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase()
    search.current = { text, time: now }
    const query = [...text].every(letter => letter === text[0]) ? text[0] : text
    const start = open ? active : selected
    const match = options.findIndex((_, offset) => options[(start + 1 + offset) % options.length].label.toLowerCase().startsWith(query))
    if (match >= 0) setActive((start + 1 + match) % options.length)
    else if (!open) setActive(Math.max(selected, 0))
    setOpen(true)
  }

  return <div className="custom-select" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <span className="custom-select-label" id={`${id}-label`}>{label}</span>
    <button ref={trigger} type="button" className="custom-select-trigger" role="combobox"
      aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-haspopup="listbox"
      aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      disabled={!options.length} onClick={() => open ? setOpen(false) : show()} onKeyDown={onKeyDown}>
      <span id={`${id}-value`}>{options[selected]?.label ?? 'Select an option'}</span>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
    {open && <div ref={list} className="custom-select-list" id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option"
        aria-selected={option.value === value} className="custom-select-option" data-active={index === active}
        onPointerMove={() => setActive(index)} onPointerDown={event => { if (event.pointerType === 'mouse') event.preventDefault() }} onClick={() => choose(index)}>
        <span>{option.label}</span>
        {option.value === value && <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>)}
    </div>}
  </div>
}
