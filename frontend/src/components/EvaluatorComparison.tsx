import { accountFetch } from '../accounts'
import { useEffect, useRef, useState } from 'react'
import { aiHeaders, fruitFlySelected } from '../aiPreferences'
import { FixedConversation } from './QuestionComparison'
import { evaluatorHistoryLimit, loadEvaluatorHistory, saveEvaluatorHistory, runEvaluatorBatch } from '../evaluatorComparisonRuns'
import { comparisonHeadline, evaluatorLabel, refinedEligibilityForDisplay } from '../evaluatorResultText'

type Fixture = { id: string; title: string; description?: string; group: string; topic: string; level: string; aspects: string[]; messages: { role: string; content: string; paper?: { markdown: string }; review?: { explanation: string; grades?: { grade: string; selectedSteps: number[] }[] } }[]; evaluatorCriteria?: { id: string; text: string; required: boolean; requiresIndependent: boolean; requiresTransfer: boolean; components: { id: string; text: string }[] }[] }
type Observation = { id: string; messageId: string; messageIndex: number; quote: string; relevance: string; assistance: string; assistanceAssessed?: boolean; componentIds: string[] }
type Judgment = { criterionId: string; status: string; proposedStatus: string; result: string; reasoning: string; opportunity: string; reason: string; required: boolean; abstentionReason: string; unresolvedComponents: string[]; blockers: string[]; observations: Observation[]; contradictions: { messageId: string; quote: string; reason: string }[] }
type Refined = { judgments: Judgment[]; reason: string; nextEvidenceObjective: string; validationIssues: { criterionId: string; code: string; messageId: string }[]; completion: { eligible: boolean; blockers: { criterionId: string | null; code: string }[] } }
type LegacyJudgment = { aspect?: string; status: string; result: string; evidence: { quote: string; messageIndex: number }[] }
type Legacy = { complete: boolean; reason: string; nextQuestionFocus: string; criteria: LegacyJudgment[]; task: LegacyJudgment }
type Run = { runId: string; generatedAt: string; evaluatorVersion: string; promptVersion: string; provider: string; model: string; skipped?: string; definitions: { id: string; text: string; required: boolean; components?: { id: string; text: string }[] }[]; legacy: { assessment: Legacy | null; error?: string }; refined: { assessment: Refined | null; error?: string }; shadow: { status: string; wouldBlock?: boolean; error?: string; reason?: string; assessment?: Refined; differences?: { criterionId: string; primaryStatus: string; reviewStatus: string; reason: string }[] }; comparison?: { completionDiffers: boolean | null; policyDiffers: boolean; note: string }; calls: { branch: string; name: string; durationMs: number; error?: string }[]; deferred: string[]; limitations: string[] }
type Screening = { status: string; outcome?: string; checks?: { name: string; expected: boolean | string[]; actual: boolean | string | null; passed: boolean }[] }
type AblationVariant = { durationMs: number; incrementalDurationMs?: number; error?: string; confirmationStatus?: string; reviewStatus?: string } & ({ format: 'legacy'; assessment: Legacy | null } | { format: 'refined'; assessment: Refined | null })
const ablationLabels = { existingFirst: 'Existing first pass', existingConfirmed: 'Existing confirmed result', leanRefined: 'Lean refined primary', refinedWithShadow: 'Refined plus shadow' }
type AblationKey = keyof typeof ablationLabels
type SavedRun = Run & { case: Fixture; refinedSchema?: string; options?: { mode: string; shadow: boolean }; ablation?: { variants: Record<AblationKey, AblationVariant>; timing: string }; screening?: { legacy: Screening; refined: Screening; shadow?: Screening; policySensitive?: boolean; ablation?: Record<AblationKey, Screening> } }
const format = (value: unknown) => JSON.stringify(value, null, 2)
function downloadResults(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([format(value)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function request<T>(body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await accountFetch('/api/developer/evaluator-comparison', { signal, headers: { ...aiHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Evaluator comparison failed.')
  return data as T
}

export function EvaluatorComparison({ dirtyPrompts }: { dirtyPrompts: boolean }) {
  const [cases, setCases] = useState<Fixture[]>([])
  const [selected, setSelected] = useState('')
  const [initialHistory] = useState(() => loadEvaluatorHistory<SavedRun>())
  const [history, setHistory] = useState<SavedRun[]>(initialHistory.entries)
  const [storageNotice, setStorageNotice] = useState(initialHistory.notice)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [mode, setMode] = useState<'comparison' | 'ablation'>('comparison')
  const [shadow, setShadow] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const lock = useRef(false)
  const groups = [...new Set(cases.map(c => c.group))]
  const fixture = cases.find(c => c.id === selected)
  const folderCases = cases.filter(c => c.group === fixture?.group)
  useEffect(() => {
    const abort = new AbortController()
    request<{ cases: Fixture[] }>(undefined, abort.signal).then(data => {
      setCases(data.cases); setError('')
      if (data.cases[0]) setSelected(data.cases[0].id)
    }).catch(reason => { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load cases.') }).finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [reload])
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (history === initialHistory.entries) return
    // oxlint-disable-next-line react/set-state-in-effect -- Report the outcome of writing comparison history to browser storage.
    setStorageNotice(saveEvaluatorHistory(history))
  }, [history, initialHistory])
  async function run(scope: 'selected' | 'folder' | 'all') {
    if (lock.current) return
    setError('')
    if (fruitFlySelected()) { setError('Select a connected language model in AI settings to compare evaluators.'); return }
    if (!fixture) return
    lock.current = true
    const abort = new AbortController(); controller.current = abort
    try {
      await runEvaluatorBatch(scope === 'all' ? cases : scope === 'folder' ? folderCases : [fixture],
        (item, signal) => request<Run>({ caseId: item.id, mode, shadow }, AbortSignal.any([signal, AbortSignal.timeout(210000)])),
        (item, result) => setHistory(previous => [{ ...result, case: structuredClone(item) }, ...previous].slice(0, evaluatorHistoryLimit)),
        (item, index, total) => setBusy(`${index}/${total}: ${item.title}`), abort.signal)
    } catch (reason) { setError(`${abort.signal.aborted ? 'Comparison cancelled.' : reason instanceof Error ? reason.message : 'Comparison failed.'} Completed results are retained.`) }
    finally { lock.current = false; setBusy(''); controller.current = null }
  }
  return <div className="question-comparison evaluator-comparison">
    <header><h2>Evaluator comparison</h2><p>Compare the existing evaluator with the lean refined evidence contracts on the same transcript. This tool does not advance learning sessions.</p><p className="developer-muted">Fixtures are authored smoke tests, not professor-scored benchmarks. Experimental shadow review is off by default. Four-way ablation explicitly includes it and reuses the same first-pass evidence.</p></header>
    {dirtyPrompts && <p className="developer-notice">Unsaved prompt edits are excluded. The existing evaluator uses saved prompts; refined instructions are versioned in evaluatorComparison.js.</p>}
    <div className="evaluator-controls"><label htmlFor="evaluator-mode">Evaluation mode</label><select id="evaluator-mode" value={mode} disabled={Boolean(busy)} onChange={event => setMode(event.target.value as 'comparison' | 'ablation')}><option value="comparison">Comparison — shadow off by default</option><option value="ablation">Four-way ablation — includes shadow review</option></select>{mode === 'comparison' && <label><input type="checkbox" checked={shadow} disabled={Boolean(busy)} onChange={event => setShadow(event.target.checked)} /> Run experimental shadow review</label>}<p className="developer-muted">{mode === 'ablation' ? 'Compare existing first pass, existing confirmed result, lean refined primary, and a hypothetical refined result with a shadow veto. Review runs only for eligible refined primaries. Nothing advances a learning session.' : 'The existing evaluator keeps its current confirmation policy. The lean refined primary retains every deterministic completion safeguard.'}</p></div>
    <div className="evaluator-controls"><label htmlFor="evaluator-case">Test conversation</label><select id="evaluator-case" value={selected} disabled={loading || Boolean(busy)} onChange={event => {
      setSelected(event.target.value)
    }}>{groups.map(group => <optgroup key={group} label={group}>{cases.filter(c => c.group === group).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</optgroup>)}</select>
      {fixture?.description && <p className="developer-muted">{fixture.description}</p>}
      <div className="evaluator-actions"><button type="button" className="send-button" disabled={loading || Boolean(busy) || !fixture} onClick={() => void run('selected')}>Run comparison</button><button type="button" className="developer-button-secondary" disabled={loading || Boolean(busy) || !folderCases.length} onClick={() => void run('folder')}>Run folder ({folderCases.length} cases)</button><button type="button" className="developer-button-secondary" disabled={loading || Boolean(busy) || !cases.length} onClick={() => void run('all')}>Run all {cases.length} cases</button>{busy && <button type="button" onClick={() => controller.current?.abort()}>Cancel</button>}{!busy && error && <button type="button" onClick={() => { setLoading(true); setReload(value => value + 1) }}>Reload cases</button>}</div>
      {fixture && <FixedConversation key={fixture.id} fixture={fixture} open />}
      {fixture?.evaluatorCriteria && <details><summary>Evaluator requirements</summary><ul>{fixture.evaluatorCriteria.map(c => <li key={c.id}>{c.text} · Required{c.requiresIndependent && ' · Independent evidence required'}{c.requiresTransfer && ' · Transfer required'}{c.components.length > 1 && <ul>{c.components.map(p => <li key={p.id}>{p.text}</li>)}</ul>}</li>)}</ul></details>}
      {fixture?.messages.some(m => m.paper || m.review) && <details><summary>Submitted papers and review</summary>{fixture.messages.map((m, i) => <div key={i}>{m.paper && <pre className="evaluator-paper-text">{m.paper.markdown}</pre>}{m.review && <>{m.review.grades?.map((g, j) => <p key={j}>Paper {j + 1}: {g.grade}{g.selectedSteps.length ? `; marked steps ${g.selectedSteps.join(', ')}` : ''}</p>)}{m.review.explanation && <p>{m.review.explanation}</p>}</>}</div>)}</details>}
    </div>
    {busy && <p role="status">Comparing {busy}. Each case may take up to three minutes. Completed results are saved as the batch progresses.</p>}
    {error && <p className="developer-error" role="alert">{error}</p>}
    {storageNotice && <p role="status">{storageNotice}</p>}
    <div className="comparison-history-heading"><h3>Saved evaluator results ({history.length}/{evaluatorHistoryLimit})</h3><button type="button" className="developer-button-secondary" disabled={!history.length} onClick={() => downloadResults(history, 'evaluator-comparisons.json')}>Download all results</button><button type="button" className="developer-button-secondary" disabled={Boolean(busy) || !history.length} onClick={() => setHistory([])}>Clear results</button></div>
    <p className="developer-muted">The latest {evaluatorHistoryLimit} results, original conversations, and traces are saved in this browser. Expand a result to review it later.</p>
    {!history.length && <p>No saved comparisons yet. Run a case or folder to begin.</p>}
    {history.map((result, index) => <details key={result.runId} className="comparison-result" open={index === 0}><summary><strong>{result.case.title}</strong> · {result.case.group} · {new Date(result.generatedAt).toLocaleString()}<span className="evaluator-history-outcome">{result.skipped ? 'Waiting for student evidence' : comparisonHeadline(result.legacy.assessment?.complete, refinedEligibilityForDisplay(result.refined.assessment, result.definitions))}</span></summary><ComparisonResult result={result} /></details>)}
  </div>
}
function ComparisonResult({ result }: { result: SavedRun }) {
  const legacy = result.legacy.assessment
  const refined = result.refined.assessment
  const refinedEligible = refinedEligibilityForDisplay(refined, result.definitions)
  const shadowEligible = refinedEligibilityForDisplay(result.shadow.assessment ?? null, result.definitions)
  const required = result.definitions.map(d => refined?.judgments.find(j => j.criterionId === d.id))
  function download() {
    downloadResults(result, `evaluator-${result.runId}.json`)
  }
  return <section aria-label={`Evaluator comparison results for ${result.case.title}`}>
      <header className="evaluator-result-overview"><h3>{result.skipped ? 'Waiting for student evidence' : comparisonHeadline(legacy?.complete, refinedEligible)}</h3><p>{result.skipped ? evaluatorLabel(result.skipped) : 'Every rubric item must be demonstrated before the level can pass. Neither comparison result changes a learning session.'}</p>
        {refined?.completion.eligible && !refinedEligible && <p className="evaluator-policy-note">This older run recorded completion despite an unmet rubric item. It is shown as incomplete under the current rule; the original record is preserved in the download.</p>}
        {result.comparison?.policyDiffers && <p className="evaluator-policy-note">The refined evaluator also checks evidence provenance and any explicit independence requirements. These checks cannot waive a rubric item. A different decision does not by itself indicate better accuracy.</p>}
        <small>{result.provider} / {result.model}</small> <button type="button" className="developer-button-secondary" onClick={download}>Download full result</button></header>
      <FixedConversation fixture={result.case} />
      {result.ablation && <AblationResult result={result} />}
      {result.screening && <section><h3>Checks against the authored test</h3><p className="developer-muted">These are screening expectations, not professor-scored judgments.{result.screening.policySensitive && ' This case gives the refined evaluator explicit independence or transfer metadata; a win here does not establish a better model judgment on identical information.'}</p><ul>{(['legacy', 'refined', 'shadow'] as const).map(branch => {
        const screen = result.screening?.[branch]
        if (!screen) return null
        const name = branch === 'legacy' ? 'Existing evaluator' : branch === 'refined' ? 'Refined primary' : 'Shadow review'
        const outcome = screen.outcome ? ({ caught_false_completion: 'Caught a primary pass that should have been blocked', missed_false_completion: 'Missed a primary pass that should have been blocked', blocked_correct_completion: 'Would incorrectly block a sufficient response', confirmed_correct_completion: 'Confirmed a sufficient response', not_run: 'Not run; no review opportunity', unscorable: 'Could not score the review reliably', error: 'Review failed' }[screen.outcome] || evaluatorLabel(screen.outcome)) : screen.status === 'matched' ? 'Matched every authored check' : screen.status === 'mismatched' ? 'Differed from the authored expectations' : evaluatorLabel(screen.status)
        return <li key={branch}><strong>{name}:</strong> {outcome}{screen.checks?.some(c => !c.passed) && <ul>{screen.checks.filter(c => !c.passed).map(c => <li key={c.name}>{c.name === 'level_completion' ? 'Level completion' : `Rubric item ${c.name.replace('criterion_', '')}`}: expected {Array.isArray(c.expected) ? c.expected.map(evaluatorLabel).join(' or ') : c.expected ? 'complete' : 'incomplete'}; recorded {typeof c.actual === 'boolean' ? c.actual ? 'complete' : 'incomplete' : c.actual ? evaluatorLabel(c.actual) : 'unavailable'}.</li>)}</ul>}</li>
      })}</ul></section>}
      {(legacy || refined) && <div className="evaluator-table-wrap"><table className="evaluator-result-table"><caption>Judgments by rubric item</caption><thead><tr><th scope="col">Requirement</th><th scope="col">Existing evaluator</th><th scope="col">Refined evaluator</th></tr></thead><tbody>
        {result.definitions.map((d, i) => <tr key={d.id}><th scope="row">{d.text}</th><td><JudgmentBadge status={legacy?.criteria[i]?.status} /></td><td><JudgmentBadge status={refined?.judgments.find(j => j.criterionId === d.id)?.status} /></td></tr>)}
        <tr><th scope="row">Overall level task</th><td><JudgmentBadge status={legacy?.task.status} /></td><td><JudgmentBadge status={refined?.judgments.find(j => j.criterionId === 'level_task')?.status} /></td></tr>
      </tbody></table></div>}
      <div className="comparison-questions">
        <article><h3>Existing evaluator</h3>{result.legacy.error && <p role="alert">Could not assess this case: {result.legacy.error}</p>}{legacy && <><p className="evaluator-verdict">{legacy.complete ? 'Would finish this stage' : 'Needs more evidence'}</p><p className="developer-muted">{legacy.criteria.filter(j => j.status === 'supported').length} of {legacy.criteria.length} rubric items demonstrated</p><p>{legacy.reason}</p>{[...legacy.criteria, { ...legacy.task, aspect: 'Overall level task' }].map((j, index) => <div className="evaluator-judgment" key={index}><h4>{j.aspect}</h4><JudgmentBadge status={j.status} /><p>Answer: {evaluatorLabel(j.result)}</p>{j.evidence.length ? j.evidence.map((e, i) => <blockquote key={i}>{e.quote}<small>Student · message {e.messageIndex + 1}</small></blockquote>) : <p className="developer-muted">No verified student evidence was cited.</p>}</div>)}{legacy.nextQuestionFocus && <div className="evaluator-next-step"><strong>What to ask about next</strong><p>{legacy.nextQuestionFocus}</p></div>}</>}</article>
        <article><h3>Refined evaluator</h3>{result.refined.error && <p role="alert">Could not assess this case: {result.refined.error}</p>}{refined && <><p className="evaluator-verdict">{refinedEligible ? 'Would finish under the primary rules' : 'Needs more evidence'}</p><p className="developer-muted">{required.filter(j => j?.status === 'supported').length} of {required.length} required rubric items demonstrated</p><RefinedDetails assessment={refined} result={result} /></>}</article>
      </div>
      <section className="evaluator-shadow"><h3>Final review <span className="evaluator-badge">Shadow only</span></h3><p>{result.shadow.status === 'completed' ? shadowEligible === undefined ? 'The saved review evidence is unavailable.' : shadowEligible ? 'The reviewer also considers the evidence sufficient.' : 'The reviewer would ask for more evidence before finishing.' : result.shadow.status === 'error' ? `The review could not finish: ${result.shadow.error}` : result.shadow.reason === 'disabled' ? 'Not run: experimental shadow review is off for this comparison.' : result.shadow.reason === 'primary_not_eligible' ? 'Not run because the refined evaluator still needs evidence.' : result.shadow.reason === 'primary_failed' ? 'Not run because the primary assessment was unavailable.' : `Not run. ${result.shadow.reason ? evaluatorLabel(result.shadow.reason) : ''}`}</p><p className="developer-muted">This review is observational and does not change either decision.</p>{result.shadow.assessment && <details><summary>Read the reviewer’s evidence and remaining questions</summary><RefinedDetails assessment={result.shadow.assessment} result={result} /></details>}</section>
      <details><summary>Technical details and model traces ({result.calls.length} calls)</summary><p>Evaluator version: {result.evaluatorVersion}</p><pre className="evaluator-raw">{format(result)}</pre></details>
    </section>
}
function AblationResult({ result }: { result: SavedRun }) {
  if (!result.ablation) return null
  const variants = result.ablation.variants
  const keys = Object.keys(ablationLabels) as AblationKey[]
  const eligible = (v: AblationVariant) => v.format === 'legacy' ? v.assessment?.complete : refinedEligibilityForDisplay(v.assessment, result.definitions)
  const status = (v: AblationVariant, id: string, index: number) => v.format === 'legacy' ? (id === 'level_task' ? v.assessment?.task.status : v.assessment?.criteria[index]?.status) : v.assessment?.judgments.find(j => j.criterionId === id)?.status
  return <section aria-label="Four-way evaluator ablation"><h3>Four-way ablation</h3><p>These variants reuse the same existing first pass and lean refined primary. The reviewed variant is a hypothetical veto policy; neither it nor the shadow review changes a learning session.</p>
    <div className="evaluator-table-wrap"><table className="evaluator-result-table"><caption>Completion, authored checks, and model-call time</caption><thead><tr><th>Variant</th><th>Decision</th><th>Authored checks</th><th>Call time</th></tr></thead><tbody>{keys.map(key => {
      const v = variants[key]; const decision = eligible(v)
      return <tr key={key}><th scope="row">{ablationLabels[key]}</th><td>{decision === undefined ? 'Unavailable' : decision ? 'Would finish' : 'Needs more evidence'}{v.confirmationStatus && <p>{v.confirmationStatus === 'not_needed' ? 'Confirmation not needed under the existing policy' : `Confirmation: ${evaluatorLabel(v.confirmationStatus)}`}</p>}{v.reviewStatus && <p>{v.reviewStatus === 'not_run' ? 'Review not needed: primary incomplete' : `Review: ${evaluatorLabel(v.reviewStatus)}`}</p>}</td><td>{result.screening?.ablation?.[key] ? evaluatorLabel(result.screening.ablation[key].status) : 'Not scored'}</td><td>{(v.durationMs / 1000).toFixed(1)} s{v.incrementalDurationMs !== undefined && <p>Added stage: {(v.incrementalDurationMs / 1000).toFixed(1)} s</p>}</td></tr>
    })}</tbody></table></div><p className="developer-muted">{result.ablation.timing} A shorter call time alone does not establish better accuracy.</p>
    <div className="evaluator-table-wrap"><table className="evaluator-result-table"><caption>Requirements across all four variants</caption><thead><tr><th>Requirement</th>{keys.map(key => <th key={key}>{ablationLabels[key]}</th>)}</tr></thead><tbody>{[...result.definitions, { id: 'level_task', text: 'Overall level task' }].map((d, index) => <tr key={d.id}><th scope="row">{d.text}</th>{keys.map(key => <td key={key}><JudgmentBadge status={status(variants[key], d.id, index)} /></td>)}</tr>)}</tbody></table></div>
    {keys.map(key => { const v = variants[key]; return <details key={key}><summary>{ablationLabels[key]}: rationale and evidence</summary>{v.error && <p role="alert">Assessment unavailable: {v.error}</p>}{v.assessment ? v.format === 'refined' ? <RefinedDetails assessment={v.assessment} result={result} /> : <><p>{v.assessment.reason}</p>{[...v.assessment.criteria, { ...v.assessment.task, aspect: 'Overall level task' }].map((j, i) => <div className="evaluator-judgment" key={i}><h4>{j.aspect}</h4><JudgmentBadge status={j.status} /><p>Answer: {evaluatorLabel(j.result)}</p>{j.evidence.map((e, n) => <blockquote key={n}>{e.quote}<small>Student · message {e.messageIndex + 1}</small></blockquote>)}</div>)}</> : !v.error && <p>No assessment is available.</p>}</details> })}
  </section>
}
function criterionTitle(result: SavedRun, id: string | null) {
  if (!id) return 'Current stage'
  return id === 'level_task' ? 'Overall level task' : result.definitions.find(d => d.id === id)?.text || 'Rubric requirement'
}
function JudgmentBadge({ status }: { status?: string }) {
  return <span className={`evaluator-badge ${status === 'supported' ? 'is-supported' : status === 'flawed' ? 'is-flawed' : ''}`}>{status ? evaluatorLabel(status) : 'Not assessed'}</span>
}
function RefinedDetails({ assessment, result }: { assessment: Refined; result: SavedRun }) {
  const componentTitle = (criterionId: string, componentId: string) => result.definitions.find(d => d.id === criterionId)?.components?.find(p => p.id === componentId)?.text || result.case.evaluatorCriteria?.find(c => c.id === criterionId)?.components.find(p => p.id === componentId)?.text || (componentId === 'whole' ? criterionTitle(result, criterionId) : evaluatorLabel(componentId))
  return <><p>{assessment.reason}</p>{assessment.judgments.map(j => <div className="evaluator-judgment" key={j.criterionId}>
    <h4>{criterionTitle(result, j.criterionId)}</h4>
    <JudgmentBadge status={j.status} /><p>{j.reason}</p>
    <dl className="evaluator-finding-details"><dt>Answer</dt><dd>{evaluatorLabel(j.result)}</dd><dt>Reasoning</dt><dd>{j.reasoning === 'flawed' ? 'Contains an error' : j.reasoning === 'unclear' ? 'Needs clarification' : evaluatorLabel(j.reasoning)}</dd><dt>Assessment opportunity</dt><dd>{evaluatorLabel(j.opportunity)}</dd></dl>
    {j.status !== j.proposedStatus && <p className="developer-muted">Evidence checks changed the proposed judgment from “{evaluatorLabel(j.proposedStatus)}” to “{evaluatorLabel(j.status)}”.</p>}
    {j.abstentionReason && <p>Unable to judge: {j.abstentionReason}</p>}
    {!!j.blockers.length && <div className="evaluator-remaining"><strong>Still needed</strong><ul>{[...new Set(j.blockers.map(evaluatorLabel))].map(label => <li key={label}>{label}</li>)}</ul></div>}
    {!!j.unresolvedComponents.length && <p><strong>Parts not yet demonstrated:</strong> {j.unresolvedComponents.map(id => componentTitle(j.criterionId, id)).join('; ')}</p>}
    <h5>Student evidence</h5>{j.observations.length ? j.observations.map(o => <div key={o.id}><blockquote>{o.quote}<small>Student · message {o.messageIndex + 1} · {o.assistanceAssessed === false ? 'Assistance not assessed (not required)' : o.assistance === 'unknown' ? 'Assistance could not be determined' : evaluatorLabel(o.assistance)}</small></blockquote>{result.refinedSchema !== 'lean-v1' && <p className="evaluator-evidence-relevance">{o.relevance}</p>}</div>) : <p className="developer-muted">No verified student evidence was cited.</p>}
    {j.contradictions.map((c, i) => <div className="evaluator-remaining" key={i}><strong>Conflicting evidence</strong><blockquote>{c.quote}</blockquote><p>{c.reason}</p></div>)}
  </div>)}{!!assessment.validationIssues.length && <details><summary>Evidence verification concerns ({assessment.validationIssues.length})</summary><ul>{assessment.validationIssues.map((issue, index) => <li key={index}><strong>{criterionTitle(result, issue.criterionId)}:</strong> {evaluatorLabel(issue.code)}</li>)}</ul></details>}
    {!!assessment.completion.blockers.length && <details><summary>Why this assessment would not finish</summary><ul>{assessment.completion.blockers.filter(b => !b.code.startsWith('status_') || !assessment.completion.blockers.some(other => other.criterionId === b.criterionId && !other.code.startsWith('status_'))).map((b, index) => <li key={index}><strong>{criterionTitle(result, b.criterionId)}:</strong> {evaluatorLabel(b.code)}</li>)}</ul></details>}
    {assessment.nextEvidenceObjective && <div className="evaluator-next-step"><strong>What to ask about next</strong><p>{assessment.nextEvidenceObjective}</p></div>}</>
}
