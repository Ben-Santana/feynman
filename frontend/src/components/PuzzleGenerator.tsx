import { useCallback, useEffect, useRef, useState } from 'react'
import { accountFetch } from '../accounts'
import { aiHeaders, fruitFlySelected } from '../aiPreferences'
import './ApplySimulations.css'
import './PuzzleGenerator.css'

type Experiment = { control: { label: string; unit: string; min: number; max: number; initialValue: number }; measurement: { label: string; unit: string }; minObservations: number; instruction: string }
type Puzzle = {
  runId: string; title: string; topic: string; problem: string; previewHtml: string; figureCode: string
  provider: string; model: string; promptVersion: string; generatedAt: string; repaired: boolean
  input: { kind: 'number' | 'choice'; label: string; unit: string; min: number; max: number; initialValue: number | null; choices: { value: number; label: string }[] }
  experiment?: Experiment | null
  solution: { value: number; tolerance: number; explanation: string }; feedback: { success: string; failure: string }; checks: string[]; limitation: string
}
const displayNumber = (value: number | null) => value === null ? '' : value !== 0 && Math.abs(value) < .001 ? value.toExponential(2) : Number(value.toFixed(3))

type Prompt = { version: string; prompt: string; schema: unknown }
const examples = [
  { label: 'Torque', description: 'A torque puzzle: a 4 kg load is fixed 3 m left of a pivot. Students drag a 6 kg counterweight on the right to balance a weightless beam. Allow any distance from 1 to 6 m. Hold the beam level until Check answer releases it.' },
  { label: 'Ohm’s law', description: 'A 6 V source supplies an ideal zero-resistance lamp that needs exactly 0.20 A. Offer 15, 30, and 60 ohm resistors to drag into a green socket. Only one may be installed. The lamp stays off until Check answer; overcurrent protection keeps it off for too much current.' },
  { label: 'Investigate a component', description: 'Make a circuit investigation where the student changes the voltage across a mystery component and reads the current on an ammeter. After observing several voltage/current pairs, they must decide whether the component is ohmic or non-ohmic. The component has a fixed, physically consistent I–V relationship. Show current live, but only grade the final classification on Check answer.' },
  { label: 'A new subject', description: 'Make a conservation of energy puzzle with a marble on a ramp. Students choose the marble’s release height to reach a target speed at the bottom. Use a frictionless track and explicit givens. Dragging sets height; Check answer releases the marble. Include a satisfying finish at the correct speed.' },
]
async function api<T>(body?: unknown, signal?: AbortSignal): Promise<T> {
  const interrupted = 'The connection to the puzzle server was interrupted. It may be restarting. Your description is kept. Try again.'
  let response: Response
  try {
    response = await accountFetch('/api/developer/puzzles', { method: body === undefined ? 'GET' : 'POST', headers: { ...aiHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal })
  } catch (reason) {
    if (signal?.aborted) throw signal.reason
    if (reason instanceof TypeError) throw new Error(interrupted)
    throw reason
  }
  let data
  try { data = await response.json() } catch {
    if (signal?.aborted) throw signal.reason
    throw new Error(response.status >= 500 ? interrupted : 'The puzzle server returned an unreadable response. Your description is kept. Try again.')
  }
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : response.status >= 500 ? interrupted : 'Puzzle generation failed. Please retry.')
  return data as T
}
export function PuzzleGenerator({ active = true }: { active?: boolean }) {
  const [description, setDescription] = useState('')
  const [result, setResult] = useState<Puzzle | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [promptError, setPromptError] = useState('')
  const [loadingPrompt, setLoadingPrompt] = useState(false)
  const [copyState, setCopyState] = useState('')
  const controller = useRef<AbortController | null>(null)
  const promptController = useRef<AbortController | null>(null)
  const lock = useRef(false)
  useEffect(() => () => { controller.current?.abort(); promptController.current?.abort() }, [])
  async function loadPrompt() {
    if (loadingPrompt) return
    setLoadingPrompt(true); setPromptError('')
    const request = new AbortController(); promptController.current = request
    try { setPrompt(await api<Prompt>(undefined, AbortSignal.any([request.signal, AbortSignal.timeout(15000)]))) }
    catch (reason) { if (!request.signal.aborted) setPromptError(reason instanceof Error ? reason.message : 'Could not load the prompt.') }
    finally { if (!request.signal.aborted) setLoadingPrompt(false) }
  }
  async function generate() {
    if (lock.current || !description.trim() || fruitFlySelected()) return
    lock.current = true; setBusy(true); setError('')
    const request = new AbortController(); controller.current = request
    try {
      const generated = await api<Puzzle>({ description: description.trim() }, AbortSignal.any([request.signal, AbortSignal.timeout(240000)]))
      if (!request.signal.aborted) setResult(generated)
    } catch (reason) { if (!request.signal.aborted) setError(reason instanceof Error ? reason.name === 'TimeoutError' ? 'Generation took too long. Try a shorter description.' : reason.message : 'Could not generate the puzzle.') }
    finally { lock.current = false; setBusy(false) }
  }
  async function copyPrompt() {
    if (!prompt) return
    try { await navigator.clipboard.writeText(`${prompt.prompt}\n\nRESPONSE SCHEMA\n${JSON.stringify(prompt.schema, null, 2)}`); setCopyState('Copied') }
    catch { setCopyState('Select and copy the prompt below.') }
  }
  return <div className="puzzle-generator">
    <header><h2>Puzzle generator</h2></header>
    <form className="puzzle-generator-form" onSubmit={event => { event.preventDefault(); void generate() }}>
      <label htmlFor="puzzle-description">Puzzle description</label>
      <textarea id="puzzle-description" rows={5} maxLength={8000} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the concept, scenario, what the student can move, and what they need to solve." disabled={busy} />
      <div className="puzzle-description-examples"><span>Examples:</span>{examples.map(item => <button key={item.label} type="button" disabled={busy} onClick={() => setDescription(item.description)}>{item.label}</button>)}</div>
      <div className="puzzle-generator-actions"><button className="apply-check" type="submit" disabled={busy || !description.trim() || fruitFlySelected()}>{busy ? 'Generating puzzle…' : 'Generate puzzle'}</button>{busy && <button type="button" onClick={() => controller.current?.abort()}>Cancel</button>}<span>Uses the provider and model selected in AI settings.</span></div>
      <p className="puzzle-context-note">Includes your description, the generation prompt, and the three demo sources as reference context.</p>
      {busy && <p role="status">Building the scene and validating its input and solution. This can take a few minutes.</p>}
      {fruitFlySelected() && <p className="puzzle-generator-error">Choose ChatGPT or Anthropic in AI settings to generate puzzles.</p>}
      {error && <p className="puzzle-generator-error" role="alert">{error}</p>}
    </form>
    <details className="puzzle-prompt" onToggle={event => { if (event.currentTarget.open) void loadPrompt() }}>
      <summary>Generation prompt</summary>
      {loadingPrompt && <p role="status">Loading prompt…</p>}
      {promptError && <p role="alert">{promptError} <button type="button" onClick={() => void loadPrompt()}>Retry</button></p>}
      {prompt && <><div className="puzzle-prompt-actions"><span>{prompt.version} · Replace {'{{PUZZLE_DESCRIPTION}}'} with your description.</span><button type="button" onClick={() => void copyPrompt()}>{copyState || 'Copy prompt'}</button></div><pre tabIndex={0}>{prompt.prompt}{'\n\nRESPONSE SCHEMA\n'}{JSON.stringify(prompt.schema, null, 2)}</pre></>}
    </details>
    {result && <GeneratedPuzzle key={result.runId} puzzle={result} active={active} />}
  </div>
}
function GeneratedPuzzle({ puzzle, active }: { puzzle: Puzzle; active: boolean }) {
  const article = useRef<HTMLElement>(null)
  const shown = useRef(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const failed = useRef(false)
  const [value, setValue] = useState<number | null>(puzzle.input.initialValue)
  const [draft, setDraft] = useState<string | null>(null)
  const [experimentValue, setExperimentValue] = useState<number | null>(puzzle.experiment?.control.initialValue ?? null)
  const [experimentDraft, setExperimentDraft] = useState<string | null>(null)
  const [observations, setObservations] = useState<number[]>(puzzle.experiment ? [puzzle.experiment.control.initialValue] : [])
  const [checked, setChecked] = useState(false)
  const [solved, setSolved] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [ready, setReady] = useState(false)
  const [sceneError, setSceneError] = useState('')
  const [instance, setInstance] = useState(0)
  const current = useRef({ puzzle, solved })
  useEffect(() => { current.current = { puzzle, solved } }, [puzzle, solved])
  useEffect(() => {
    if (!active || shown.current) return
    shown.current = true
    article.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [active])
  const setExperimentControl = useCallback((next: number, preserveDraft = false) => {
    const control = puzzle.experiment?.control
    if (!control || !Number.isFinite(next)) return
    const bounded = Math.max(control.min, Math.min(control.max, next))
    setExperimentValue(bounded); if (!preserveDraft) setExperimentDraft(null)
    setChecked(false); setSolved(false)
    setObservations(previous => previous.some(sample => Math.abs(sample - bounded) < (control.max - control.min) * 1e-6) || previous.length >= 12 ? previous : [...previous, bounded])
  }, [puzzle.experiment])
  function setAnswer(next: number | null) { setValue(next); setDraft(null); setChecked(false); setSolved(false) }
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.data?.channel !== current.current.puzzle.runId) return
      const { type, value: next, message } = event.data
      if (type === 'puzzle-ready' && !failed.current) setReady(true)
      if (type === 'puzzle-error') { failed.current = true; setReady(false); setSceneError(typeof message === 'string' ? message.slice(0, 300) : 'The generated scene failed.') }
      if (current.current.solved) return
      if (type === 'puzzle-experiment-value' && current.current.puzzle.experiment && typeof next === 'number' && Number.isFinite(next)) { setExperimentControl(next); return }
      if (type !== 'puzzle-value') return
      const input = current.current.puzzle.input
      if (next === null && input.kind === 'choice') setAnswer(null)
      else if (typeof next === 'number' && Number.isFinite(next)) {
        if (input.kind === 'choice' && !input.choices.some(choice => choice.value === next)) return
        setAnswer(Math.max(input.min, Math.min(input.max, next)))
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [setExperimentControl])
  useEffect(() => { if (ready) frame.current?.contentWindow?.postMessage({ channel: puzzle.runId, type: 'puzzle-state', config: { value, experimentValue, observations, checked, solved, attempt } }, '*') }, [puzzle.runId, value, experimentValue, observations, checked, solved, attempt, ready])
  useEffect(() => {
    if (!active || ready || sceneError) return
    const timer = window.setTimeout(() => { failed.current = true; setSceneError('The scene did not start. Try resetting or generating it again.') }, 15000)
    return () => window.clearTimeout(timer)
  }, [active, ready, sceneError, instance])
  function reset() { failed.current = false; setValue(puzzle.input.initialValue); setDraft(null); setChecked(false); setSolved(false); setAttempt(0); setExperimentValue(puzzle.experiment?.control.initialValue ?? null); setExperimentDraft(null); setObservations(puzzle.experiment ? [puzzle.experiment.control.initialValue] : []); setReady(false); setSceneError(''); setInstance(n => n + 1) }
  const parsed = draft === null ? value : draft.trim() ? Number(draft) : null
  const inputValid = parsed !== null && Number.isFinite(parsed) && parsed >= puzzle.input.min && parsed <= puzzle.input.max && (puzzle.input.kind !== 'choice' || puzzle.input.choices.some(choice => choice.value === parsed))
  const experimentNumber = experimentDraft === null ? experimentValue : experimentDraft.trim() ? Number(experimentDraft) : null
  const experimentValid = !puzzle.experiment || experimentNumber !== null && Number.isFinite(experimentNumber) && experimentNumber >= puzzle.experiment.control.min && experimentNumber <= puzzle.experiment.control.max
  const enoughObservations = !puzzle.experiment || observations.length >= puzzle.experiment.minObservations
  const valid = inputValid && experimentValid && enoughObservations
  function check() { if (!valid || parsed === null) return; setValue(parsed); setDraft(null); setChecked(true); setAttempt(n => n + 1); setSolved(puzzle.input.kind === 'choice' ? parsed === puzzle.solution.value : Math.abs(parsed - puzzle.solution.value) <= puzzle.solution.tolerance) }
  return <article ref={article} className="apply-experiment generated-puzzle">
    <div className="apply-experiment-title"><h3>{puzzle.title}</h3><button type="button" onClick={reset}>Reset</button></div>
    <p className="apply-topic">Topic: {puzzle.topic}</p><div className="apply-problem"><h4>Problem</h4><p>{puzzle.problem}</p></div>
    {puzzle.experiment && <p className="puzzle-experiment-instruction">{puzzle.experiment.instruction}</p>}
    <div className="apply-scene"><label className="apply-answer"><span>{puzzle.experiment?.control.label ?? puzzle.input.label}</span><div>{!puzzle.experiment && puzzle.input.kind === 'choice' ? <select aria-label={puzzle.input.label} value={value ?? ''} disabled={solved} onChange={event => setAnswer(event.target.value === '' ? null : Number(event.target.value))}><option value="">—</option>{puzzle.input.choices.map(choice => <option key={choice.value} value={choice.value} title={choice.label}>{puzzle.input.unit ? choice.value : choice.label}</option>)}</select> : <input style={{ width: `${Math.max(2, Math.min(8, String(puzzle.experiment ? experimentDraft ?? displayNumber(experimentValue) : draft ?? displayNumber(value)).length + .5))}ch` }} type="number" step="any" inputMode="decimal" min={puzzle.experiment?.control.min ?? puzzle.input.min} max={puzzle.experiment?.control.max ?? puzzle.input.max} aria-label={puzzle.experiment?.control.label ?? puzzle.input.label} value={puzzle.experiment ? experimentDraft ?? displayNumber(experimentValue) : draft ?? displayNumber(value)} disabled={solved} onFocus={event => event.currentTarget.select()} onChange={event => {
      const next = event.target.valueAsNumber
      setChecked(false)
      if (puzzle.experiment) {
        setExperimentDraft(event.target.value)
        if (Number.isFinite(next) && next >= puzzle.experiment.control.min && next <= puzzle.experiment.control.max) setExperimentControl(next, true)
      } else {
        setDraft(event.target.value)
        if (Number.isFinite(next) && next >= puzzle.input.min && next <= puzzle.input.max) setValue(next)
      }
    }} onBlur={() => {
      if (puzzle.experiment) {
        if (experimentDraft?.trim() && Number.isFinite(Number(experimentDraft))) setExperimentControl(Number(experimentDraft))
        setExperimentDraft(null)
      } else {
        if (draft?.trim() && Number.isFinite(Number(draft))) setValue(Math.max(puzzle.input.min, Math.min(puzzle.input.max, Number(draft))))
        setDraft(null)
      }
    }} />}<small>{puzzle.experiment?.control.unit ?? puzzle.input.unit}</small></div></label>
      <iframe key={instance} ref={frame} sandbox="allow-scripts" referrerPolicy="no-referrer" title={`${puzzle.topic}: ${puzzle.title}`} srcDoc={puzzle.previewHtml} />
      {!ready && <span className="apply-scene-loading">{sceneError ? 'Scene unavailable' : 'Loading puzzle…'}</span>}
    </div>
    {sceneError && <p className="puzzle-generator-error" role="alert">The generated scene could not run: {sceneError}</p>}
    <div className="apply-affordance-key"><span><i className="is-grab" />{puzzle.experiment ? 'Drag the red control' : 'Drag the red areas'}</span>{!puzzle.experiment && <span><i className="is-drop" />Green marks a target</span>}</div>
    {puzzle.experiment && <fieldset className="puzzle-conclusion" disabled={solved}>
      <legend>{puzzle.input.label}</legend>
      {puzzle.input.kind === 'choice' ? <div className="puzzle-conclusion-choices">{puzzle.input.choices.map(choice => <button key={choice.value} type="button" aria-pressed={value === choice.value} onClick={() => setAnswer(choice.value)}>{choice.label}</button>)}</div> : <label>{puzzle.input.label}<input type="number" step="any" aria-label={puzzle.input.label} min={puzzle.input.min} max={puzzle.input.max} value={draft ?? value ?? ''} onChange={event => { setDraft(event.target.value); setChecked(false); const next = event.target.valueAsNumber; if (Number.isFinite(next) && next >= puzzle.input.min && next <= puzzle.input.max) setValue(next) }} /> {puzzle.input.unit}</label>}
      <p>{Math.min(observations.length, puzzle.experiment.minObservations)} of {puzzle.experiment.minObservations} observation settings sampled.</p>
    </fieldset>}
    <footer className="apply-footer"><div className="apply-result" role="status"><strong>{solved ? 'Challenge complete' : checked ? 'Try another answer' : 'Find a solution'}</strong><p>{checked ? solved ? puzzle.feedback.success : puzzle.feedback.failure : puzzle.experiment ? enoughObservations ? 'Choose your conclusion, then check your answer.' : 'Vary the control to gather evidence before checking your conclusion.' : 'Set your answer. Check answer runs the experiment.'}</p></div><button className="apply-check" type="button" disabled={!ready || !valid || solved} onClick={check}>Check answer</button></footer>
    <details className="apply-dev-notes"><summary>Generation details and solution</summary><p>{puzzle.provider} · {puzzle.model} · {puzzle.promptVersion}{puzzle.repaired ? ' · Repaired after validation' : ''}</p><p>{puzzle.solution.explanation}</p><p>Answer: {puzzle.input.kind === 'choice' ? puzzle.input.choices.find(choice => choice.value === puzzle.solution.value)?.label : puzzle.solution.value} {puzzle.input.unit} · Tolerance: ±{puzzle.solution.tolerance} {puzzle.input.unit}</p><p>Checked: {puzzle.checks.join('; ')}. {puzzle.limitation}</p><details><summary>Scene source</summary><pre>{puzzle.figureCode}</pre></details></details>
  </article>
}
