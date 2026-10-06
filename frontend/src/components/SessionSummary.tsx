import { BackButton } from './BackButton'
import { learningTypes, type LearningType } from '../learningTypes.js'
import { levelIds, targetCount, type Concept, type Level } from '../learningFlow'
import { checklistItems } from '../rubricChecklist.js'

function SummaryIcon({ name }: { name: 'check' | 'arrow' | 'chevron' | 'book' }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M19 12H5m7-7-7 7 7 7" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    book: <><path d="M12 5v15M3 4h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4v15h-4a7 7 0 0 0-5 2 7 7 0 0 0-5-2H3Z" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

const levelLabel = (level: Level) => level[0].toUpperCase() + level.slice(1)
const passedLevels = (concept: Concept) => levelIds.slice(0, Math.min(concept.passed, targetCount(concept.target)))

export function SummaryUnavailable({ hasSession, onBack, onContinue }: { hasSession: boolean; onBack: () => void; onContinue: () => void }) {
  return <section className="summary-page" aria-labelledby="summary-title">
    <nav className="back-navigation summary-nav" aria-label="Summary navigation"><BackButton onClick={onBack} destination="sessions" /></nav>
    <div className="summary-shell">
      <div className="summary-empty">
        <span className="summary-empty-icon"><SummaryIcon name="book" /></span>
        <p className="summary-eyebrow">Session summary</p>
        <h1 id="summary-title">{hasSession ? 'Summary not ready yet' : 'Start your first session'}</h1>
        <p>{hasSession ? 'Complete your session goals to see your summary.' : 'Your summary will appear after you complete a session.'}</p>
        <button type="button" className="summary-new-session" onClick={onContinue}>{hasSession ? 'Continue learning' : 'Start a session'}<span><SummaryIcon name="arrow" /></span></button>
      </div>
  </div></section>
}

function AssessmentDetails({ concept, learningType }: { concept: Concept; learningType: LearningType }) {
  const assessments = passedLevels(concept).flatMap(level => {
    const assessment = concept.assessments?.[level] ?? (levelIds[concept.passed - 1] === level ? concept.assessment : null)
    if (!assessment) return []
    const quotes = [...new Set([...assessment.criteria, assessment.task].flatMap(item => item.evidence.map(evidence => evidence.quote)).filter(Boolean))]
    return [{ level, reason: assessment.reason, quotes }]
  })
  if (!assessments.length && !concept.finalSummary && typeof concept.analysisGrade !== 'number') return null

  return <details className="summary-assessment">
    <summary><SummaryIcon name="chevron" /><span>Assessment details</span></summary>
    <div className="summary-assessment-content">
      {assessments.map(({ level, reason, quotes }) => <section key={level}>
        <h4>{levelLabel(level)} assessment</h4>
        {reason && <p>{reason}</p>}
        {quotes.length > 0 && <details className="summary-evidence"><summary>Supporting evidence <span>{quotes.length}</span></summary>{quotes.map(quote => <blockquote key={quote}>{quote}</blockquote>)}</details>}
      </section>)}
      {concept.finalSummary && <section><h4>Session feedback</h4><p>{concept.finalSummary}</p></section>}
      {learningType === 'quantitative' && typeof concept.analysisGrade === 'number' && <p className="summary-grade">Analyze assessment <strong>{concept.analysisGrade}%</strong></p>}
    </div>
  </details>
}

export function SessionSummary({ title, learningType, concepts, onBack, onNewSession }: { title: string; learningType: LearningType; concepts: Concept[]; onBack: () => void; onNewSession: () => void }) {
  const completedConcepts = concepts.filter(concept => concept.passed >= targetCount(concept.target)).length
  const completedLevels = concepts.reduce((count, concept) => count + passedLevels(concept).length, 0)
  const completedGoals = concepts.reduce((count, concept) => count + passedLevels(concept).reduce((total, level) => total + checklistItems(concept.rubric[level]).length, 0), 0)
  const studyFurther = concepts.flatMap(concept => levelIds.slice(concept.passed, targetCount(concept.target)).map(level => ({ id: concept.id, concept: concept.name, level, criteria: checklistItems(concept.rubric[level]) })))
  const complete = concepts.length > 0 && !studyFurther.length

  return <section className="summary-page" aria-labelledby="summary-title">
    <nav className="back-navigation summary-nav" aria-label="Summary navigation"><BackButton onClick={onBack} destination="sessions" /></nav>
    <div className="summary-shell">

      <header className="summary-header">
        <div className="summary-header-copy">
          <p className="summary-eyebrow">Session summary</p>
          <h1 id="summary-title">{title}</h1><p className="summary-learning-type">{learningTypes[learningType].label}</p>
        </div>
      </header>

      <dl className="summary-stats" aria-label="Session achievements">
        <div><dt>{completedConcepts === 1 ? 'Concept completed' : 'Concepts completed'}</dt><dd>{completedConcepts.toLocaleString()}</dd></div>
        <div><dt>{completedLevels === 1 ? 'Learning level passed' : 'Learning levels passed'}</dt><dd>{completedLevels.toLocaleString()}</dd></div>
        <div><dt>{completedGoals === 1 ? 'Goal demonstrated' : 'Goals demonstrated'}</dt><dd>{completedGoals.toLocaleString()}</dd></div>
      </dl>

      <div className="summary-grid">
        <section className="summary-learning" aria-labelledby="summary-strong-title">
          <div className="summary-section-heading"><span className="summary-section-icon"><SummaryIcon name="book" /></span><h2 id="summary-strong-title">What you know well</h2></div>
          <div className="summary-concepts">{concepts.map((concept, index) => {
            const levels = passedLevels(concept)
            const goalCount = levels.reduce((count, level) => count + checklistItems(concept.rubric[level]).length, 0)
            return <details className="summary-concept" key={concept.id} open={concepts.length <= 3 || index === 0}>
              <summary className="summary-concept-heading">
                <span className="summary-concept-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="summary-concept-title"><h3>{concept.name}</h3><span>{goalCount} {goalCount === 1 ? 'goal' : 'goals'} demonstrated</span></span>
                <span className="summary-concept-chevron"><SummaryIcon name="chevron" /></span>
              </summary>
              <div className="summary-concept-content">
                {levels.map(level => <section className="summary-level" key={level} aria-label={`${levelLabel(level)} goals for ${concept.name}`}>
                  <div className="summary-level-heading"><h4>{levelLabel(level)}</h4></div>
                  <ul className="summary-goals" role="list">{checklistItems(concept.rubric[level]).map((item, itemIndex) => <li key={itemIndex}><span className="summary-goal-check"><SummaryIcon name="check" /></span><span>{item}</span></li>)}</ul>
                </section>)}
                {!levels.length && <p className="summary-no-goals">No levels have been completed for this concept yet.</p>}
                <AssessmentDetails concept={concept} learningType={learningType} />
              </div>
            </details>
          })}</div>
        </section>

        <aside className="summary-sidebar" aria-label="Next steps">
          <section className={`summary-next${complete ? ' summary-next-complete' : ''}`} aria-labelledby="summary-next-title">
            <h2 id="summary-next-title">{complete ? 'All goals met.' : 'What to practice'}</h2>
            {!complete && <ul className="summary-next-goals">{studyFurther.map(item => <li key={`${item.id}-${item.level}`}><strong>{item.concept} · {levelLabel(item.level)}</strong><ul>{item.criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul></li>)}</ul>}
          </section>
          <section className="summary-keep-going" aria-labelledby="summary-keep-title">
            <h2 id="summary-keep-title">Make it stick.</h2>
            <p>Explain a concept tomorrow without your notes.</p>
            <button type="button" className="summary-new-session" onClick={onNewSession}>Start a new session <span><SummaryIcon name="arrow" /></span></button>
          </section>
        </aside>
      </div>
    </div>
  </section>
}
