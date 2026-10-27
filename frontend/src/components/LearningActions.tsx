import type { LearningAction } from '../learningActions'

export function LearningActions({ busy, needsCheck, canFinish, canRevise, onAction, onRevise }: {
  busy: boolean; needsCheck: boolean; canFinish?: boolean; canRevise?: boolean
  onAction: (action: LearningAction) => void; onRevise?: () => void
}) {
  if (!needsCheck && !canRevise && !canFinish) return null
  return <div className="learning-actions">
    {needsCheck && <><p>Review is assistance. Try a new question to demonstrate understanding.</p><button type="button" disabled={busy} onClick={() => onAction('check')}>Try an independent check</button></>}
    {canRevise && <button type="button" disabled={busy} onClick={onRevise}>Revise review</button>}
    {canFinish && <button type="button" disabled={busy} onClick={() => onAction('finish')}>Finish assessment</button>}
  </div>
}
