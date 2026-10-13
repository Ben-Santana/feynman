import { useEffect, useRef, useState } from 'react'
import { aiHeaders, fruitFlySelected } from '../aiPreferences'
import { ChatText } from './ChatText'

type Fixture = { id: string; title: string; topic: string; level: string; group?: string; aspects: string[]; rubricGeneration?: { generatedAt: string; provider: string; model: string; promptVersion: string; pipeline: string }; messages: { role: string; content: string }[] }
function FixedConversation({ fixture, open = false }: { fixture: Fixture; open?: boolean }) {
  return <details open={open}><summary>Fixed conversation</summary>
    <dl className="comparison-input-labels"><dt>Test folder</dt><dd>{fixture.group || 'FCI Direct Test'}</dd><dt>Concepts</dt><dd>{fixture.topic}</dd><dt>Learning level</dt><dd>{fixture.level[0].toUpperCase() + fixture.level.slice(1)}</dd></dl>
    <h4 className="comparison-rubric-heading">Rubric items</h4><ol>{fixture.aspects.map(aspect => <li key={aspect}>{aspect}</li>)}</ol>
    {fixture.rubricGeneration && <p className="developer-muted">Generated once through the rubric pipeline and saved · {fixture.rubricGeneration.provider} / {fixture.rubricGeneration.model} · {new Date(fixture.rubricGeneration.generatedAt).toLocaleString()}</p>}
    <div className="comparison-transcript">{fixture.messages.map((message, index) => <p key={index}><strong>{message.role === 'user' ? 'Student' : 'Feynman'}:</strong> {message.content}</p>)}</div>
  </details>
}
type QuestionPlan = { targetQuote: string; rubricItem: string; objective: string; scenario: string; assumptions: string[]; heldFixed: string[]; varied: string[]; construction: string; prerequisitesSatisfied: string; limitations: string[]; responseSignals: { hypothesis: string; responsePattern: string; interpretation: string }[] }
type Strategy = { id: string; title?: string; family?: string; objective: string; construction?: string; interpretation?: string; constructionRules?: string[]; interpretationRules?: string[]; examples?: { level: string; context: string; question: string; diagnosticPurpose: string }[] }
type Result = { runId: string; generatedAt: string; model: string; provider: string; corpusVersion: string; promptVersion: string; case: Fixture; baseline: { message: string; assessment: unknown }; enhanced: { message: string; fallback?: boolean } | null; state?: unknown; candidates?: unknown; exampleContext?: unknown[]; selection?: { rationale: string } | null; strategy?: Strategy | null; questionPlan?: QuestionPlan | null; coverageGap?: { stage: string; reason: string } | null; notice?: string; calls: unknown[] }
const storageKey = 'feynman-question-comparisons-v1'
// Remove inventory-source metadata from earlier saved results and their call logs.
function removeInventorySource(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/,?\s*"source"\s*:\s*\{\s*"page"\s*:\s*\d+,\s*"items"\s*:\s*\[[\d,\s]*\]\s*\}/g, '')
  if (Array.isArray(value)) return value.map(removeInventorySource)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => !(key === 'source' && item && typeof item === 'object' && 'page' in item && 'items' in item)).map(([key, item]) => [key, removeInventorySource(item)]))
}
function readHistory(): Result[] {
  try { const data = removeInventorySource(JSON.parse(localStorage.getItem(storageKey) || '[]')); return Array.isArray(data) ? data.filter(item => typeof item?.runId === 'string' && typeof item?.baseline?.message === 'string' && Array.isArray(item?.case?.messages)).slice(0, 20) : [] } catch { return [] }
}
async function api<T>(body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/developer/question-comparison', { signal, headers: { ...aiHeaders(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Comparison failed.')
  return data
}
export function QuestionComparison({ dirtyPrompts }: { dirtyPrompts: boolean }) {
  const [cases, setCases] = useState<Fixture[]>([])
  const [selected, setSelected] = useState('')
  const [history, setHistory] = useState<Result[]>(readHistory)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [storageNotice, setStorageNotice] = useState('')
  const [version, setVersion] = useState('')
  const lock = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const fixture = cases.find(item => item.id === selected)
  const groups = [...new Set(cases.map(item => item.group || 'FCI Direct Test'))]
  const folderCases = cases.filter(item => item.group === fixture?.group)
  useEffect(() => {
    const abort = new AbortController()
    api<{ cases: Fixture[]; corpusVersion: string }>(undefined, abort.signal).then(data => { setCases(data.cases); setSelected(data.cases[0]?.id || ''); setVersion(data.corpusVersion) }).catch(reason => { if (!abort.signal.aborted) setError(String(reason.message || reason)) })
    return () => { abort.abort(); controller.current?.abort() }
  }, [])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Report the outcome of synchronizing history to external browser storage.
    try { localStorage.setItem(storageKey, JSON.stringify(history)); setStorageNotice('') } catch { setStorageNotice('Browser storage is full or unavailable. Results remain visible for this visit.') }
  }, [history])
  async function run(scope: 'selected' | 'folder' | 'all') {
    if (lock.current || !fixture) return
    lock.current = true; setError('')
    const abort = new AbortController(); controller.current = abort
    try {
      for (const item of scope === 'all' ? cases : scope === 'folder' ? folderCases : [fixture]) {
        setBusy(item.title)
        const result = await api<Result>({ caseId: item.id }, AbortSignal.any([abort.signal, AbortSignal.timeout(300000)]))
        setHistory(previous => [result, ...previous].slice(0, 20))
      }
    } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.name === 'TimeoutError' ? 'Comparison timed out. Completed results are retained; retry the case.' : reason.message : 'Comparison failed.') }
    finally { lock.current = false; setBusy(''); controller.current = null }
  }
  return <div className="question-comparison">
    <header><h2>Question strategy comparison</h2><p>Fixed concepts, transcripts, and student answers. Each run compares one next question using the same rubric assessment and selected provider/model.</p><p className="developer-muted">Strategy database · {version}. Derived strategies are experimental. Inputs repeat; model outputs may vary.</p></header>
    <div className="comparison-config">
      <label htmlFor="comparison-case">Fixed test conversation</label><select id="comparison-case" value={selected} disabled={Boolean(busy)} onChange={event => setSelected(event.target.value)}>{groups.map(group => <optgroup key={group} label={group}>{cases.filter(item => (item.group || 'FCI Direct Test') === group).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>)}</select>
      <div className="comparison-actions"><button className="send-button" disabled={!fixture || Boolean(busy) || fruitFlySelected()} onClick={() => void run('selected')}>Run comparison</button><button className="developer-button-secondary" disabled={!fixture || Boolean(busy) || fruitFlySelected()} onClick={() => void run('folder')}>Run folder ({folderCases.length} cases)</button><button className="developer-button-secondary" disabled={!fixture || Boolean(busy) || fruitFlySelected()} onClick={() => void run('all')}>Run all {cases.length} cases</button>{busy && <button className="developer-button-secondary" onClick={() => controller.current?.abort()}>Cancel</button>}</div>
      {fixture?.group === 'FCI Indirect Test' && <p className="developer-config-note">Adjacent topics test how reusable diagnostic strategies adapt beyond their original examples.</p>}
      {fixture?.group?.toLowerCase() === 'ece indirect test' && <p className="developer-config-note">No electrical inventory has been added. These cases test reusable question strategies with an explicit electrical adaptation, or a logged rubric fallback when no suitable application fits.</p>}
      {busy && <p role="status">Comparing: {busy}…</p>}
      {fruitFlySelected() && <p className="developer-warning">Select ChatGPT or Anthropic in AI settings for this comparison.</p>}
      {dirtyPrompts && <p className="developer-warning">Unsaved prompt edits are excluded. Both branches use the saved prompts.</p>}
      {error && <p className="developer-error" role="alert">{error}</p>}
      {storageNotice && <p role="status">{storageNotice}</p>}
      {fixture && <FixedConversation fixture={fixture} open />}
    </div>
    <div className="comparison-history-heading"><h3>Saved paired results ({history.length}/20)</h3><button className="developer-button-secondary" disabled={Boolean(busy) || !history.length} onClick={() => setHistory([])}>Clear results</button></div>
    {!history.length && <p className="developer-muted">Run a case to see both questions side by side. The latest 20 results are saved in this browser.</p>}
    {history.map(result => <article className="comparison-result" key={result.runId}>
      <header><h3>{result.case.title}</h3><p>{result.case.group || 'FCI Direct Test'} · {new Date(result.generatedAt).toLocaleString()} · {result.provider} / {result.model}</p><small>Corpus {result.corpusVersion} · Saved prompt version {result.promptVersion}</small></header>
      <div className="comparison-questions"><section><h4>Feynman · Default</h4><ChatText>{result.baseline.message}</ChatText></section><section><h4>Feynman · {result.enhanced?.fallback ? 'Rubric fallback' : 'Strategy database'}</h4>{result.enhanced ? <ChatText>{result.enhanced.message}</ChatText> : <p>{result.notice}</p>}</section></div>
      {result.coverageGap && <section className="comparison-coverage-gap"><h4>Strategy coverage gap · {result.coverageGap.stage}</h4><p>{result.coverageGap.reason}</p><p>The default rubric question was reused; no database match was claimed.</p></section>}
      <section className="comparison-strategy" aria-label="Question strategy used">
        <h4>Question strategy used</h4>
        {result.strategy ? <dl className="comparison-strategy-details">
          <dt>Strategy</dt><dd>{result.strategy.title || result.strategy.family || result.strategy.id}</dd>
          <dt>Database record</dt><dd>{result.strategy.id}</dd>
          <dt>Purpose</dt><dd>{result.strategy.objective}</dd>
          {result.selection?.rationale && <><dt>Why selected</dt><dd>{result.selection.rationale}</dd></>}
          {!result.questionPlan && result.strategy.construction && <><dt>Earlier construction</dt><dd>{result.strategy.construction}</dd></>}
          {!result.questionPlan && result.strategy.interpretation && <><dt>Earlier interpretation</dt><dd>{result.strategy.interpretation}</dd></>}
        </dl> : <p>{result.notice || 'No question strategy was selected for this result.'}</p>}
        {result.questionPlan && <>
          <h4 className="comparison-plan-heading">Adapted diagnostic plan</h4>
          <dl className="comparison-strategy-details">
            <dt>Student claim</dt><dd>{result.questionPlan.targetQuote}</dd>
            <dt>Rubric item</dt><dd>{result.questionPlan.rubricItem}</dd>
            <dt>Diagnostic target</dt><dd>{result.questionPlan.objective}</dd>
            <dt>Concrete scenario</dt><dd>{result.questionPlan.scenario}</dd>
            {result.questionPlan.assumptions.length > 0 && <><dt>Assumptions</dt><dd>{result.questionPlan.assumptions.join('; ')}</dd></>}
            {result.questionPlan.heldFixed.length > 0 && <><dt>Held fixed</dt><dd>{result.questionPlan.heldFixed.join('; ')}</dd></>}
            {result.questionPlan.varied.length > 0 && <><dt>Changed condition</dt><dd>{result.questionPlan.varied.join('; ')}</dd></>}
            <dt>Question construction</dt><dd>{result.questionPlan.construction}</dd>
            <dt>Prerequisites</dt><dd>{result.questionPlan.prerequisitesSatisfied}</dd>
            {result.questionPlan.limitations.length > 0 && <><dt>Limits</dt><dd>{result.questionPlan.limitations.join('; ')}</dd></>}
          </dl>
          <details><summary>What different answers could reveal</summary><ul>{result.questionPlan.responseSignals.map((signal, index) => <li key={index}><strong>{signal.hypothesis}:</strong> {signal.responsePattern}<p>{signal.interpretation}</p></li>)}</ul></details>
          <details><summary>Reusable strategy rules</summary><pre>{JSON.stringify({ construction: result.strategy?.constructionRules, interpretation: result.strategy?.interpretationRules }, null, 2)}</pre></details>
          {result.strategy?.examples && <details><summary>Illustrative questions for this strategy</summary>{result.strategy.examples.map((example, index) => <section key={index}><p><strong>Context:</strong> {example.context}</p><p><strong>Example question:</strong> {example.question}</p><p><strong>Purpose:</strong> {example.diagnosticPurpose}</p></section>)}</details>}
          {result.exampleContext && <details><summary>All reviewed example context ({result.exampleContext.length})</summary><pre>{JSON.stringify(result.exampleContext, null, 2)}</pre></details>}
        </>}
        {result.strategy && !result.questionPlan && !result.coverageGap && <p className="developer-muted">This earlier saved run predates explicit topic-specific adaptation.</p>}
      </section>
      <FixedConversation fixture={result.case} />
      <details><summary>Shared rubric assessment and diagnostic state</summary><pre>{JSON.stringify({ assessment: result.baseline.assessment, state: result.state }, null, 2)}</pre></details>
      <details><summary>Retrieval candidates and model calls</summary><pre>{JSON.stringify({ candidates: result.candidates, coverageGap: result.coverageGap, calls: result.calls }, null, 2)}</pre></details>
    </article>)}
  </div>
}
