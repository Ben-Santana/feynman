import { learningTypes, type LearningType } from '../learningTypes.js'
import { ConfirmDialog } from './ConfirmDialog'

export function LearningTypeChangeDialog({ learningType, onConfirm, onCancel }: {
  learningType: LearningType
  onConfirm: () => void
  onCancel: () => void
}) {
  return <ConfirmDialog title="Are you sure?" confirmLabel="Hold to clear rubric" onConfirm={onConfirm} onCancel={onCancel}>
    Changing to <strong>{learningTypes[learningType].label}</strong> will clear the rubric for every concept. Your concepts and target levels will be kept.
  </ConfirmDialog>
}
