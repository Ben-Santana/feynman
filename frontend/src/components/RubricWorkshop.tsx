import { useRef, useState } from 'react'
import { accountFetch } from '../accounts'
import { aiHeaders } from '../aiPreferences'
import { learningTypeIds, learningTypes, type LearningType } from '../learningTypes.js'
import { levelIds, type ConceptRubric, type Level } from '../learningFlow'
import { generateRubricBatches } from '../rubricGeneration'
import { checklistItems } from '../rubricChecklist.js'
import { MathText } from './PaperReview'
import { LoadingAnimation } from './AccountLoading'

type Generated = { name: string; rubric: ConceptRubric }
const nameLevel = (level: string) => level[0].toUpperCase() + level.slice(1)

// Runs the same /api/rubric call as session setup, so results match what teachers get.
export function RubricWorkshop({ dirtyPrompts }: { dirtyPrompts: boolean }) {
  const [learningType, setLearningType] = useState<LearningType>('quantitative')
  const [target, setTarget] = useState<Level>('analyze')
  const [names, setNames] = useState('Ohm’s law')
  const [instructions, setInstructions] = useState('')
  const [result, setResult] = useState<Generated[] | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const concepts = [...new Set(names.split('\n').map(name => name.trim()).filter(Boolean))]
  const counts = result?.flatMap(concept => levelIds.map(level => checklistItems(concept.rubric[level]).length).filter(Boolean)) ?? []

  async function generate() {
    if (lock.current || !concepts.length || concepts.length > 20) return
    lock.current = true; setBusy(true); setError('')
    const started = Date.now()
    try {
      const generated = await generateRubricBatches(concepts.map(name => ({ name, target })), async (batch, previousRubric) => {
        const response = await accountFetch('/api/rubric', { method: 'POST', signal: AbortSignal.timeout(225000), headers: { ...aiHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ concepts: batch, previousRubric, files: [], learningType, additionalInstructions: instructions.trim() }) })
        let data
        try { data = await response.json() } catch { throw new Error('Could not reach the API. Start the app with npm run dev.') }
        if (!response.ok) throw new Error(data.error || 'Could not generate the rubric.')
        return data
      })
      setResult(generated); setSeconds(Math.round((Date.now() - started) / 1000))
    } catch (reason) {
      setError(reason instanceof Error ? reason.name === 'TimeoutError' ? 'The request timed out. Please retry.' : reason.message : 'Could not generate the rubric.')
    } finally { lock.current = false; setBusy(false) }
  }

  return <div className="developer-playground">
    <aside className="developer-test-config">
      <fieldset disabled={busy}><legend>Learning type</legend><div className="developer-levels">{learningTypeIds.map(id => <button type="button" key={id} aria-pressed={id === learningType} onClick={() => setLearningType(id)}>{learningTypes[id].label}</button>)}</div></fieldset>
      <fieldset disabled={busy}><legend>Target level</legend><div className="developer-levels">{levelIds.map(id => <button type="button" key={id} aria-pressed={id === target} onClick={() => setTarget(id)}>{nameLevel(id)}</button>)}</div></fieldset>
      <label htmlFor="rubric-workshop-concepts">Concepts, one per line</label>
      <textarea id="rubric-workshop-concepts" className="developer-rubric-input" rows={4} disabled={busy} value={names} onChange={event => setNames(event.target.value)} />
      <label htmlFor="rubric-workshop-instructions">Additional instructions</label>
      <textarea id="rubric-workshop-instructions" className="developer-rubric-input" rows={3} maxLength={5000} disabled={busy} value={instructions} onChange={event => setInstructions(event.target.value)} />
      <button type="button" className="send-button developer-start" disabled={busy || !concepts.length || concepts.length > 20} onClick={() => void generate()}>{busy ? <LoadingAnimation label="Generating rubric" compact delayMs={0} /> : result ? 'Regenerate rubric' : 'Generate rubric'}</button>
      {concepts.length > 20 && <p className="developer-warning">Enter up to 20 concepts.</p>}
      {dirtyPrompts && <p className="developer-warning">You have unsaved prompt edits. Save them in the Prompts tab to use them here.</p>}
    </aside>
    <div className="developer-test-workspace">
      {error && <p className="developer-error developer-rubric-error" role="alert">{error}</p>}
      {!result && !error && <div className="developer-empty"><h2>No rubric yet</h2></div>}
      {result && <>
        <p className="developer-muted" role="status">{counts.length ? `${Math.min(...counts)}–${Math.max(...counts)} items per box · ${counts.reduce((sum, count) => sum + count, 0)} items in total · ${seconds}s` : ''}</p>
        <div className="developer-rubric-scroll"><table className="developer-rubric-table">
          <thead><tr><th scope="col">Concept</th>{levelIds.map(level => <th scope="col" key={level}>{nameLevel(level)}</th>)}</tr></thead>
          <tbody>{result.map(concept => <tr key={concept.name}>
            <th scope="row">{concept.name}</th>
            {levelIds.map(level => { const items = checklistItems(concept.rubric[level]); return <td key={level}>{items.length > 0 && <><span className="developer-rubric-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span><ul>{items.map((item, index) => <li key={index}><MathText>{item}</MathText></li>)}</ul></>}</td> })}
          </tr>)}</tbody>
        </table></div>
      </>}
    </div>
  </div>
}
