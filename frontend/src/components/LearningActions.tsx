import type { LearningAction } from '../learningActions'

export function LearningActions({ busy, canFinish, canRevise, onAction, onRevise }: {
  busy: boolean; canFinish?: boolean; canRevise?: boolean
  onAction: (action: LearningAction) => void; onRevise?: () => void
}) {
  if (!canRevise && !canFinish) return null
  return <div className="learning-actions">
    {canRevise && <button type="button" disabled={busy} onClick={onRevise}>Change my grade</button>}
    {canFinish && <button type="button" disabled={busy} onClick={() => onAction('finish')}>Finish assessment</button>}
  </div>
}

export function SkipRubricButton({ busy, onSkip, onContinue }: { busy: boolean; onSkip: () => void; onContinue: () => void }) {
  return <div className="learning-actions">
    <button className="level-divider-continue" type="button" disabled={busy} onClick={onSkip}>Yes, skip this</button>
    <button className="level-divider-continue" type="button" disabled={busy} onClick={onContinue}>No, keep going</button>
  </div>
}
