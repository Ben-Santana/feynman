import { MathText, type Paper, type Review } from './PaperReview'
import { paperParts } from './paperContent'

export function ReviewFeedback({ paper, review }: { paper: Paper; review: Review }) {
  const exercises = paper.papers?.length ? paper.papers : [paper]
  const grades = review.grades || (review.grade ? [{ paperId: paper.id, grade: review.grade, selectedSteps: review.selectedSteps || [] }] : [])
  const marked = grades.flatMap((grade, paperIndex) => grade.selectedSteps.map(stepNumber => ({
    paperIndex,
    stepNumber,
    text: paperParts(exercises[paperIndex]).steps[stepNumber - 1],
  }))).filter(step => step.text)

  return <div className="review-feedback" aria-label={marked.length ? 'Steps marked incorrect' : 'Paper review follow-up'}>
    {marked.length ? <>
      <div className="review-feedback-heading"><span className="review-feedback-icon" aria-hidden="true">✎</span><div><strong>Steps you marked incorrect</strong><small>Explain what is wrong and how you would correct each one.</small></div></div>
      <ol className="review-feedback-list">{marked.map(({ paperIndex, stepNumber, text }) => <li key={`${paperIndex}-${stepNumber}`} className="review-feedback-step"><span className="review-feedback-label">Paper {paperIndex + 1} · Step {stepNumber}</span><div className="review-feedback-text"><MathText>{text}</MathText></div></li>)}</ol>
    </> : <div className="review-feedback-heading"><span className="review-feedback-icon" aria-hidden="true">✓</span><div><strong>All papers marked Pass</strong><small>Tell me how you checked the steps.</small></div></div>}
  </div>
}
