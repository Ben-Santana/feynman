import { useEffect, useId, useRef, useState } from 'react'
import type { CharacterAppearance } from '../characterAppearance'
import { dashboardBanner } from '../dashboardAppearance'
import { Bloub } from './Bloub'
import { CourseCover } from './CourseCover'
import { TooltipButton } from './TooltipButton'

export function DashboardHeader({ appearance, onCustomizeAvatar, onCreateSession, onCreateCourse }: {
  appearance: CharacterAppearance; onCustomizeAvatar: () => void; onCreateSession: () => void; onCreateCourse?: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const createId = useId()
  const createControl = useRef<HTMLDivElement>(null)
  const createButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!createOpen) return
    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !createControl.current?.contains(event.target)) setCreateOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [createOpen])

  function closeCreate() {
    setCreateOpen(false)
    createButton.current?.focus()
  }

  return <header className="dashboard-home-header">
    <CourseCover banner={dashboardBanner(appearance.color)} className={`dashboard-banner dashboard-banner-${appearance.color}`} />
    <div className="dashboard-banner-footer">
      <div className="dashboard-avatar-stage">
        <TooltipButton type="button" className="dashboard-avatar" aria-label={`Customize ${appearance.name}`} tooltip="Customize avatar" tooltipFollowPointer onClick={onCustomizeAvatar}>
          <Bloub mode="studio" appearance={appearance} expression="attentive" showControls={false} followPointer />
        </TooltipButton>
      </div>
      <div className="dashboard-create" ref={createControl} onBlur={event => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setCreateOpen(false)
      }} onKeyDown={event => {
        if (createOpen && event.key === 'Escape') {
          event.stopPropagation()
          closeCreate()
        }
      }}>
        <button ref={createButton} type="button" className="dashboard-new-session" aria-expanded={createOpen} aria-controls={createId} onClick={() => setCreateOpen(open => !open)}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
          Create
        </button>
        <div id={createId} className="dashboard-create-options" hidden={!createOpen}>
          <button type="button" onClick={() => { closeCreate(); onCreateSession() }}>Session</button>
          <button type="button" disabled={!onCreateCourse} onClick={() => { closeCreate(); onCreateCourse?.() }}>Course</button>
        </div>
      </div>
    </div>
  </header>
}
