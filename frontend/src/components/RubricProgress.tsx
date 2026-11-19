import { rubricMath } from '../rubricMath'
import { MathText } from './PaperReview'
import { levelIds, targetCount, type Concept } from '../learningFlow'
import { checklistItems } from '../rubricChecklist.js'

export function RubricProgress({ concept }: { concept: Concept }) {
  return <details className="rubric-progress">
    <summary>Rubric checklist</summary>
    <p>Items are checked when supported by your answers. Skipped items score 0 unless you teach them later.</p>
    <div className="rubric-progress-levels">{levelIds.slice(0, targetCount(concept.target)).map((level, index) => {
      const assessment = concept.assessments?.[level] ?? (!concept.assessments && index === concept.passed && !concept.assessment?.complete ? concept.assessment : null)
      const items = checklistItems(concept.rubric[level])
      return <section key={level}><h3>{level[0].toUpperCase() + level.slice(1)}</h3><ol>{items.map((item, itemIndex) => {
        const judgment = assessment?.criteria.find(criterion => criterion.aspect === item)
        const checked = !judgment?.skipped && (judgment?.status === 'supported' || (!judgment && index < concept.passed))
        const status = judgment?.skipped ? 'Skipped' : checked ? 'Demonstrated' : judgment?.status === 'flawed' ? 'Needs revision' : judgment?.status === 'needs_clarification' ? 'Needs clarification' : 'Not yet demonstrated'
        return <li key={itemIndex}><label><input type="checkbox" checked={checked} disabled aria-label={`${item}: ${status}`} /><span><MathText>{rubricMath(item)}</MathText><small>{status}</small></span></label></li>
      })}</ol></section>
    })}</div>
  </details>
}
