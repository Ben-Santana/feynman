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

export function SkipRubricButton({ item, busy, onSkip }: { item: string; busy: boolean; onSkip: () => void }) {
  return <button className="level-divider-continue" type="button" disabled={busy} aria-label={`Skip this item: ${item}`} title={`${item} — skipped items do not count as demonstrated.`} onClick={onSkip}>Skip</button>
}
