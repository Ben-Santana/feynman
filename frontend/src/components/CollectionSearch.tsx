import { useId, useRef, type ReactNode } from 'react'
import { TooltipButton } from './TooltipButton'
import './CollectionSearch.css'

type SearchFilters = {
  label: string
  options: readonly string[]
  selected: readonly string[]
  onToggle: (option: string) => void
}

function Icon({ name }: { name: 'search' | 'filter' | 'close' | 'plus' }) {
  return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    {name === 'search' ? <><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></>
      : name === 'filter' ? <path d="M3 5h14M6 10h8M8 15h4" />
      : name === 'close' ? <path d="m6 6 8 8m0-8-8 8" />
      : <path d="M10 4v12M4 10h12" />}
  </svg>
}

export function CollectionAddButton({ label, text, onClick, disabled }: { label: string; text?: string; onClick: () => void; disabled?: boolean }) {
  return <TooltipButton type="button" className={`dashboard-new-session collection-add${text ? ' collection-add-labeled' : ''}`} aria-label={label} tooltip={label} onClick={onClick} disabled={disabled}><Icon name="plus" />{text}</TooltipButton>
}

export function CollectionSearch({ label, value, onChange, filters, placeholder = label, maxLength, children }: {
  label: string; value: string; onChange: (value: string) => void; filters?: SearchFilters; placeholder?: string; maxLength?: number; children?: ReactNode
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const filterPanel = useRef<HTMLDivElement>(null)

  return <div className="collection-search">
    <label className="collection-search-icon" htmlFor={id}><Icon name="search" /></label>
    <div className="collection-search-content">
      <div className="collection-search-terms">
        {filters?.selected.map(option => <button type="button" className="collection-search-tag" key={option} aria-label={`Remove ${option} filter`} onClick={() => { input.current?.focus(); filters.onToggle(option) }}>
          {option}<Icon name="close" />
        </button>)}
        <input id={id} ref={input} type="search" aria-label={label} placeholder={placeholder} value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} />
      </div>
      {children}
      {filters && <>
        <TooltipButton type="button" className="collection-search-icon" aria-label={`Filter by ${filters.label.toLowerCase()}`} tooltip={`Filter by ${filters.label.toLowerCase()}`} popoverTarget={`${id}-filters`} onClick={event => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const panel = filterPanel.current
          if (!panel || panel.matches(':popover-open')) return
          panel.style.setProperty('--filter-top', `${bounds.bottom + 6}px`)
          panel.style.setProperty('--filter-right', `${Math.max(8, window.innerWidth - bounds.right)}px`)
          panel.style.setProperty('--filter-height', `${Math.min(320, Math.max(0, window.innerHeight - bounds.bottom - 14))}px`)
          if (window.innerHeight - bounds.bottom < 200 && bounds.top > window.innerHeight - bounds.bottom) {
            panel.style.setProperty('--filter-top', 'auto')
            panel.style.setProperty('--filter-bottom', `${window.innerHeight - bounds.top + 6}px`)
            panel.style.setProperty('--filter-height', `${Math.min(320, bounds.top - 14)}px`)
          } else panel.style.removeProperty('--filter-bottom')
        }}><Icon name="filter" /></TooltipButton>
        <div ref={filterPanel} id={`${id}-filters`} className="collection-search-filters" popover="auto">
          <fieldset><legend>{filters.label}</legend>
            {filters.options.map(option => <label key={option}>
              <input type="checkbox" checked={filters.selected.includes(option)} onChange={() => filters.onToggle(option)} />{option}
            </label>)}
          </fieldset>
        </div>
      </>}
    </div>
  </div>
}
