import { useEffect, useRef } from 'react'
import { learningTypes, type LearningType } from '../learningTypes.js'

export function LearningTypeChangeDialog({ learningType, onConfirm, onCancel }: {
  learningType: LearningType
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className="learning-type-change-dialog" role="alertdialog" aria-labelledby="type-change-title" aria-describedby="type-change-description" onCancel={event => { event.preventDefault(); onCancel() }}>
    <h2 id="type-change-title">Are you sure?</h2>
    <p id="type-change-description">Changing to <strong>{learningTypes[learningType].label}</strong> will clear the rubric for every concept. Your concepts and target levels will be kept.</p>
    <div className="learning-type-change-actions">
      <button type="button" className="setup-secondary" autoFocus onClick={onCancel}>Cancel</button>
      <button type="button" className="send-button" onClick={onConfirm}>Change type and clear rubric</button>
    </div>
  </dialog>
}
