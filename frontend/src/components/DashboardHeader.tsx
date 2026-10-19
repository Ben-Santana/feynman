import type { CharacterAppearance } from '../characterAppearance'
import { dashboardBanner } from '../dashboardAppearance'
import { Bloub } from './Bloub'
import { CourseCover } from './CourseCover'
import { TooltipButton } from './TooltipButton'

export function DashboardHeader({ appearance, onCustomizeAvatar, onCreateSession }: { appearance: CharacterAppearance; onCustomizeAvatar: () => void; onCreateSession: () => void }) {
  return <header className="dashboard-home-header">
    <CourseCover banner={dashboardBanner(appearance.color)} className={`dashboard-banner dashboard-banner-${appearance.color}`} />
    <div className="dashboard-banner-footer">
      <div className="dashboard-avatar-stage">
        <TooltipButton type="button" className="dashboard-avatar" aria-label={`Customize ${appearance.name}`} tooltip="Customize avatar" tooltipFollowPointer onClick={onCustomizeAvatar}>
          <Bloub mode="studio" appearance={appearance} expression="attentive" showControls={false} followPointer />
        </TooltipButton>
      </div>
      <button type="button" className="dashboard-new-session" onClick={onCreateSession}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>Custom session</button>
    </div>
  </header>
}
