import type { LearningAction } from '../learningActions'

export function LearningActions({ busy, canFinish, canRevise, onAction, onRevise }: {
  busy: boolean; canFinish?: boolean; canRevise?: boolean
  onAction: (action: LearningAction) => void; onRevise?: () => void
}) {
  if (!canRevise && !canFinish) return null
  return <div className="learning-actions">
    {canRevise && <button type="button" disabled={busy} onClick={onRevise}>Revise review</button>}
    {canFinish && <button type="button" disabled={busy} onClick={() => onAction('finish')}>Finish assessment</button>}
  </div>
}
