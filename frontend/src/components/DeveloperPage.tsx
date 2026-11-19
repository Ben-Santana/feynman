import { accountFetch } from '../accounts'
import { requireAccount } from '../accounts'
import { subscribePlayground } from '../playgroundStore'
import { LearningActions, SkipRubricButton } from './LearningActions'
import { rubricSkipReason } from '../rubricFallback.js'
import { learningActionMessage, type LearningAction } from '../learningActions'
import { ChatComposer } from './ChatComposer'
import { loadPlayground, savePlayground } from '../learningStore'
import { ChatText } from './ChatText'
import { useEffect, useRef, useState } from 'react'
import { aiHeaders, fruitFlySelected, localAIResponse } from '../aiPreferences'
import { learningTypeIds, learningTypes, type LearningType } from '../learningTypes.js'
import { levelIds, type ChatResult, type Level, type Message } from '../learningFlow'
import { checklistItems, checklistText } from '../rubricChecklist.js'
import { PaperReview, type Review } from './PaperReview'
import { RubricChecklistEditor } from './RubricChecklistEditor'
import { LoadingAnimation, LoadingScreen } from './AccountLoading'
import './DeveloperPage.css'
import { QuestionComparison } from './QuestionComparison'
import { EvaluatorComparison } from './EvaluatorComparison'
import { ApplySimulations } from './ApplySimulations'
import { PuzzleGenerator } from './PuzzleGenerator'

type Prompt = { id: string; title: string; group: string; subgroup: string; description: string; text: string; variables: string[] }
type PromptFile = { file: string; version: string; prompts: Prompt[]; editable: boolean }
type TestConfig = { learningType: LearningType; level: Level; topic: string; criterion: string }
// Tools kept in the code but not shown.
const showArchivedTools = false
const fixOptions = [
  ['keepCredit', 'Keep earned credit'],
  ['tolerantQuotes', 'Tolerant quote matching'],
  ['stayOnItem', 'One item, one point'],
  ['plainAsk', 'Say what is missing'],
  ['clearSkip', 'Clear skip offer'],
] as const
type FixName = typeof fixOptions[number][0]
type TabId = 'prompts' | 'chat' | 'fixes' | 'comparison' | 'evaluator' | 'simulations' | 'puzzles'
const tabLabels: Record<TabId, string> = { prompts: 'Prompts', chat: 'Chat workshop', fixes: 'Loop fixes', comparison: 'Question strategies', evaluator: 'Evaluator comparison', simulations: 'Apply simulations', puzzles: 'Puzzle generator' }
const visibleTabs: TabId[] = showArchivedTools ? ['prompts', 'chat', 'fixes', 'comparison', 'evaluator', 'simulations', 'puzzles'] : ['prompts', 'chat', 'fixes']
// Student messages of the first topic in a downloaded chat file.
function studentMessages(markdown: string) {
  const topic = markdown.split(/^## .*$/m)[1] || ''
  const student = markdown.match(/^Student: (.+)$/m)?.[1].trim()
  return topic.split(/^\*\*(.+?)\*\*(?: \(.*\))?[ \t]*$/m).slice(1).reduce<string[]>((list, part, index, parts) => index % 2 === 0 && part.trim() !== 'Classmate' && (!student || part.trim() === student) && parts[index + 1]?.trim() ? [...list, parts[index + 1].trim()] : list, [])
}
const nameLevel = (level: string) => level[0].toUpperCase() + level.slice(1)
const promptCountLabel = (count: number) => `${count} ${count === 1 ? 'prompt' : 'prompts'}`
const errorText = (error: unknown) => error instanceof Error ? error.name === 'TimeoutError' || error.name === 'AbortError' ? 'The request timed out. Please retry.' : error.message : 'The request failed. Please retry.'
type PromptCall = { role: string; request: unknown; response?: unknown; error?: string; durationMs: number }
type CallTurn = { calls: PromptCall[]; request: unknown; response?: unknown; error?: string }
type SavedTest = { id: string; updatedAt: number; run: TestConfig; messages: Message[]; draft: string; callTurns: CallTurn[]; result: ChatResult | null }
async function request<T>(path: string, body?: unknown, signal = AbortSignal.timeout(15000), onTrace?: (data: T & { calls?: PromptCall[]; error?: string }) => void): Promise<T> {
  signal.throwIfAborted()
  const local = path === '/api/health' && fruitFlySelected() ? { configured: true, model: 'fruit fly brain' } : localAIResponse(path, body)
  if (local !== undefined) { onTrace?.(local as T & { calls?: PromptCall[]; error?: string }); return local as T }
  const response = await accountFetch(path, { signal, headers: { ...aiHeaders(), ...(onTrace ? { 'X-Feynman-Trace': '1' } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) })
  let data
  try { data = await response.json() } catch { throw new Error('Could not reach the API. Start the app with npm run dev.') }
  onTrace?.(data)
  if (!response.ok) throw new Error(data.error || 'The request failed. Please retry.')
  return data as T
}

export function DeveloperPage({ onDirtyChange, characterName = 'Feynman' }: { onDirtyChange: (dirty: boolean) => void; characterName?: string }) {
  const [tab, setTab] = useState<TabId>('prompts')
  const [dirty, setDirty] = useState(false)
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false) }, [dirty, onDirtyChange])
  const shown = (id: TabId) => visibleTabs.includes(id)
  return <section className="developer-page">
    <div className="developer-shell">
      <header className="developer-page-heading"><h1>Developer tools</h1></header>
      <div className="developer-tabs" role="tablist" aria-label="Developer tools" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const tabs = visibleTabs
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
        setTab(tabs[index]); document.getElementById(`${tabs[index]}-tab`)?.focus()
      }}>
        {visibleTabs.map(id => <button type="button" key={id} id={`${id}-tab`} role="tab" aria-selected={tab === id} aria-controls={`${id}-panel`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}>{tabLabels[id]} {id === 'prompts' && dirty && <i aria-label="Unsaved edits" />}</button>)}
      </div>
      {shown('puzzles') && <div id="puzzles-panel" role="tabpanel" aria-labelledby="puzzles-tab" hidden={tab !== 'puzzles'}><PuzzleGenerator active={tab === 'puzzles'} /></div>}
      {shown('simulations') && <div id="simulations-panel" role="tabpanel" aria-labelledby="simulations-tab" hidden={tab !== 'simulations'}>{tab === 'simulations' && <ApplySimulations />}</div>}
      <div id="prompts-panel" role="tabpanel" aria-labelledby="prompts-tab" hidden={tab !== 'prompts'}><PromptEditor onDirtyChange={setDirty} /></div>
      <div id="chat-panel" role="tabpanel" aria-labelledby="chat-tab" hidden={tab !== 'chat'}><ChatPlayground characterName={characterName} dirtyPrompts={dirty} /></div>
      <div id="fixes-panel" role="tabpanel" aria-labelledby="fixes-tab" hidden={tab !== 'fixes'}><ChatPlayground characterName={characterName} dirtyPrompts={dirty} fixes /></div>
      {shown('comparison') && <div id="comparison-panel" role="tabpanel" aria-labelledby="comparison-tab" hidden={tab !== 'comparison'}><QuestionComparison dirtyPrompts={dirty} /></div>}
      {shown('evaluator') && <div id="evaluator-panel" role="tabpanel" aria-labelledby="evaluator-tab" hidden={tab !== 'evaluator'}><EvaluatorComparison dirtyPrompts={dirty} /></div>}
    </div>
  </section>
}

function PromptEditor({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [file, setFile] = useState<PromptFile | null>(null)
  const [selected, setSelected] = useState('chat.classroomRole')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ Chat: true, 'Chat/Conversation setup': true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const saveLock = useRef(false)
  const prompt = file?.prompts.find(item => item.id === selected)
  const editable = file?.editable === true
  const text = prompt ? drafts[prompt.id] ?? prompt.text : ''
  const editedCount = file?.prompts.filter(item => drafts[item.id] !== undefined && drafts[item.id] !== item.text).length ?? 0
  const changed = Boolean(prompt && text !== prompt.text)
  const query = search.trim().toLowerCase()
  const matches = file?.prompts.filter(item => `${item.id} ${item.title} ${item.group} ${item.subgroup} ${item.description} ${item.text}`.toLowerCase().includes(query)) ?? []
  const groups = [...new Set(matches.map(item => item.group))]
  const isEdited = (item: Prompt) => drafts[item.id] !== undefined && drafts[item.id] !== item.text
  const isExpanded = (key: string) => query ? expanded[`search:${key}`] ?? true : expanded[key] ?? false
  const toggleSection = (key: string) => {
    const open = isExpanded(key)
    setExpanded(values => ({ ...values, [query ? `search:${key}` : key]: !open }))
  }
  useEffect(() => { onDirtyChange(editedCount > 0) }, [editedCount, onDirtyChange])
  useEffect(() => {
    if (!editedCount) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [editedCount])
  useEffect(() => {
    const controller = new AbortController()
    request<PromptFile>('/api/developer/prompts', undefined, controller.signal).then(setFile).catch(reason => { if (!controller.signal.aborted) setError(errorText(reason)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  async function reload() {
    setLoading(true); setError(''); setNotice('')
    try { setFile(await request<PromptFile>('/api/developer/prompts')); setNotice(editable ? 'Reloaded the file. Any unsaved edits are kept for review.' : 'Reloaded prompts.') }
    catch (reason) { setError(errorText(reason)) }
    finally { setLoading(false) }
  }
  async function save() {
    if (!editable || !file || !prompt || !changed || saveLock.current) return
    saveLock.current = true; setSaving(true); setError(''); setNotice('')
    try {
      setFile(await request<PromptFile>('/api/developer/prompts', { id: prompt.id, text, version: file.version }))
      setNotice('Saved to backend/prompts.json. The next request will use this prompt.')
    } catch (reason) { setError(errorText(reason)) }
    finally { saveLock.current = false; setSaving(false) }
  }
  if (loading && !file) return <LoadingScreen label="Loading prompts" />
  return <div className="developer-prompts">
    <aside className="developer-prompt-browser">
      <div className="developer-browser-heading"><h2>Prompt library</h2><span>{file?.prompts.length ?? '…'}</span></div>
      <label className="sr-only" htmlFor="prompt-search">Search prompts</label><input id="prompt-search" type="search" placeholder="Search prompts…" value={search} onChange={event => { setSearch(event.target.value); setExpanded(values => Object.fromEntries(Object.entries(values).filter(([key]) => !key.startsWith('search:')))) }} />
      <div className="developer-prompt-list">
        {groups.map((group, groupIndex) => {
          const items = matches.filter(item => item.group === group)
          const open = isExpanded(group)
          const groupId = `prompt-group-${groupIndex}`
          return <div key={group} className="developer-prompt-group">
            <h3><button type="button" className="developer-group-toggle" aria-expanded={open} aria-controls={groupId} onClick={() => toggleSection(group)}><span className="developer-chevron" aria-hidden="true">›</span><span>{group}</span>{items.some(isEdited) && <i aria-label="Contains unsaved edits" />}<span className="developer-group-count" aria-label={promptCountLabel(items.length)}>{items.length}</span></button></h3>
            <div id={groupId} hidden={!open}>
              {[...new Set(items.map(item => item.subgroup))].map((subgroup, subgroupIndex) => {
                const prompts = items.filter(item => item.subgroup === subgroup)
                const key = `${group}/${subgroup}`
                const subgroupOpen = isExpanded(key)
                const subgroupId = `${groupId}-section-${subgroupIndex}`
                return <div key={subgroup} className="developer-prompt-subgroup">
                  <h4><button type="button" className="developer-group-toggle" aria-expanded={subgroupOpen} aria-controls={subgroupId} onClick={() => toggleSection(key)}><span className="developer-chevron" aria-hidden="true">›</span><span>{subgroup}</span>{prompts.some(isEdited) && <i aria-label="Contains unsaved edits" />}<span className="developer-group-count" aria-label={promptCountLabel(prompts.length)}>{prompts.length}</span></button></h4>
                  <div id={subgroupId} hidden={!subgroupOpen}>{prompts.map(item => <button type="button" className="developer-prompt-item" key={item.id} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setExpanded(values => ({ ...values, [group]: true, [key]: true })); setNotice('') }}><span><span className="developer-prompt-title">{item.title}</span><span className="developer-prompt-description">{item.description}</span></span>{isEdited(item) && <i aria-label="Unsaved edits" />}</button>)}</div>
                </div>
              })}
            </div>
          </div>
        })}
        {file && !matches.length && <p className="developer-muted">No prompts match your search.</p>}
      </div>
      <button type="button" className="developer-reload" disabled={loading || saving} onClick={() => void reload()}>{loading ? <LoadingAnimation label="Reloading prompts" compact /> : '↻ Reload from file'}</button>
    </aside>
    <div className="developer-prompt-workspace">
      {prompt ? <>
        <header className="developer-editor-heading"><div><p className="developer-eyebrow">{prompt.group} / {prompt.subgroup}</p><h2>{prompt.title}</h2><p className="developer-prompt-purpose">{prompt.description}</p><code>{file?.file} <span aria-hidden="true">→</span> {prompt.id}</code></div><span className={`developer-status ${changed ? 'is-edited' : ''}`}>{!editable ? 'Read-only' : changed ? 'Unsaved' : 'Saved in file'}</span></header>
        {!editable && <p className="developer-muted">Prompts are read-only on this deployment. Use the local app to edit them.</p>}
        <div className="developer-variable-note">{prompt.variables.length ? <>{editable ? 'Keep the template variables:' : 'Template variables:'} {prompt.variables.map(variable => <code key={variable}>{'{{' + variable + '}}'}</code>)}</> : editable ? 'Plain text instructions. Changes apply to chat and rubric requests using this prompt.' : 'Plain text instructions.'}</div>
        <label className="sr-only" htmlFor="prompt-text">Prompt text for {prompt.title}</label><textarea id="prompt-text" className="developer-code-editor" spellCheck={false} value={text} maxLength={30000} readOnly={!editable} disabled={saving || loading} onChange={event => { if (!editable) return; setDrafts(values => ({ ...values, [prompt.id]: event.target.value })); setNotice('') }} />
        <footer className="developer-editor-footer"><span>{text.length.toLocaleString()} characters{editedCount > 0 && ` · ${editedCount} edited ${editedCount === 1 ? 'prompt' : 'prompts'}`}</span>{editable && <div><button type="button" className="developer-button-secondary" disabled={!changed || saving} onClick={() => { setDrafts(values => { const next = { ...values }; delete next[prompt.id]; return next }); setNotice(''); setError('') }}>Discard edit</button><button type="button" className="send-button" disabled={!changed || !text.trim() || saving || loading} onClick={() => void save()}>{saving ? 'Saving…' : 'Save prompt'}</button></div>}</footer>
      </> : <div className="developer-empty"><span aria-hidden="true">{'{ }'}</span><h2>Choose a prompt</h2><p>Inspect the instructions used by the classroom and rubric generator.</p></div>}
      {error && <p className="developer-error" role="alert">{error}</p>}{notice && <p className="developer-notice" role="status">{notice}</p>}
    </div>
  </div>
}

function ChatPlayground({ dirtyPrompts, characterName, fixes = false }: { dirtyPrompts: boolean; characterName: string; fixes?: boolean }) {
  const [fixFlags, setFixFlags] = useState<Record<FixName, boolean>>(() => Object.fromEntries(fixOptions.map(([name]) => [name, true])) as Record<FixName, boolean>)
  const earned = useRef<string[]>([])
  const [replay, setReplay] = useState<string[]>([])
  const [replayNotice, setReplayNotice] = useState('')
  const field = (name: string) => fixes ? `fixes-${name}` : name
  const [composerVersion, setComposerVersion] = useState(0)
  const [savedTests, setSavedTests] = useState<SavedTest[]>([])
  const [savedId, setSavedId] = useState('')
  const [savedReady, setSavedReady] = useState(false)
  const [savingTest, setSavingTest] = useState(false)
  const [saveNotice, setSaveNotice] = useState('')
  const saveLock = useRef(false)
  useEffect(() => {
    let active = true
    const refresh = () => { void loadPlayground<SavedTest>().then(tests => { if (active) { setSavedTests(tests); setSavedReady(true) } }).catch(() => { if (active) setSaveNotice('Could not load saved tests. Reload to retry.') }) }
    refresh()
    const unsubscribe = subscribePlayground(requireAccount().id, refresh)
    return () => { active = false; unsubscribe() }
  }, [])
  const [learningType, setLearningType] = useState<LearningType>('quantitative')
  const [level, setLevel] = useState<Level>('analyze')
  const [topic, setTopic] = useState('')
  const [criteria, setCriteria] = useState<Record<Level, string>>({ remember: '1. ', understand: '1. ', apply: '1. ', analyze: '1. ' })
  const criterion = criteria[level]
  const setCriterion = (value: string) => setCriteria(current => ({ ...current, [level]: value }))
  const [run, setRun] = useState<TestConfig | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState<Message | null>(null)
  const [callTurns, setCallTurns] = useState<CallTurn[]>([])
  const [result, setResult] = useState<ChatResult | null>(null)
  const [reviewVersion, setReviewVersion] = useState(0)
  const [revisingReview, setRevisingReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [generatingRubric, setGeneratingRubric] = useState(false)
  const [rubricError, setRubricError] = useState('')
  const [rubricNotice, setRubricNotice] = useState('')
  const [error, setError] = useState('')
  const [health, setHealth] = useState<{ configured: boolean; model: string } | null>(null)
  const lock = useRef(false)
  const controller = useRef<AbortController | null>(null)
  const log = useRef<HTMLDivElement>(null)
  const finished = Boolean(result?.assessment?.complete || result?.assessment?.readyToAdvance || result?.finalSummary)
  const paper = messages.findLast(message => message.paper)?.paper
  const review = paper ? messages.findLast(message => message.review?.paperId === paper.id)?.review : undefined
  const awaitingReview = Boolean(run?.learningType === 'quantitative' && run.level === 'analyze' && paper && !review)
  const aspects = checklistItems(criterion)
  const working = busy || generatingRubric || savingTest
  useEffect(() => {
    const abort = new AbortController()
    request<{ configured: boolean; model: string }>('/api/health', undefined, abort.signal).then(setHealth).catch(() => {})
    return () => { abort.abort(); controller.current?.abort() }
  }, [])
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [messages.length, pending, busy])
  async function turn(config: TestConfig, transcript: Message[]): Promise<ChatResult> {
    controller.current = new AbortController()
    const payload = { ...config, aspects: checklistItems(config.criterion), messages: transcript, ...(fixes && Object.values(fixFlags).some(Boolean) ? { experiment: { ...fixFlags, earned: transcript.length ? earned.current : [] } } : {}) }
    const entry: CallTurn = { request: payload, calls: [] }
    setCallTurns(current => [...current, entry])
    try {
      const response = await request<ChatResult>('/api/chat', payload, AbortSignal.any([controller.current.signal, AbortSignal.timeout(240000)]), data => {
        const { calls = [], ...response } = data
        setCallTurns(current => current.map(item => item === entry ? { ...entry, calls, response, error: data.error } : item))
      })
      const supported = response.assessment?.criteria.filter(item => item.status === 'supported').map(item => item.aspect) || []
      earned.current = [...new Set([...(transcript.length ? earned.current : []), ...supported])]
      return response
    } catch (reason) {
      setCallTurns(current => current.map(item => item === entry ? { ...entry, error: errorText(reason) } : item))
      throw reason
    }
  }
  async function saveTest() {
    if (!run || working || !savedReady || saveLock.current) return
    saveLock.current = true; setSavingTest(true); setSaveNotice('')
    const entry: SavedTest = { id: savedId || crypto.randomUUID(), updatedAt: Date.now(), run, messages, draft, callTurns, result }
    try {
      const next = await savePlayground([entry])
      setSavedTests(next); setSavedId(entry.id); setSaveNotice('Saved in this browser, including the call log. Save again after further replies.')
    } catch { setSaveNotice('Could not save this test. Your open conversation is still available.') }
    finally { saveLock.current = false; setSavingTest(false) }
  }
  function openTest(test: SavedTest) {
    setRevisingReview(false)
    setComposerVersion(version => version + 1)
    setSavedId(test.id); setRun(test.run); setLearningType(test.run.learningType); setLevel(test.run.level); setTopic(test.run.topic)
    setCriteria(current => ({ ...current, [test.run.level]: test.run.criterion }))
    earned.current = [...new Set(test.callTurns.flatMap(turn => ((turn.response as ChatResult | undefined)?.assessment?.criteria || []).filter(item => item.status === 'supported').map(item => item.aspect)))]
    setMessages(test.messages); setDraft(test.draft); setCallTurns(test.callTurns); setResult(test.result); setError(''); setSaveNotice('Opened saved test. Save again to keep further replies.')
  }
  async function generateItems() {
    if (lock.current || !topic.trim()) return
    const selectedLevel = level
    lock.current = true; setGeneratingRubric(true); setRubricError(''); setRubricNotice('')
    controller.current = new AbortController()
    try {
      const response = await request<{ items: string[] }>('/api/developer/rubric', {
        learningType, topic: topic.trim(), level: selectedLevel,
      }, AbortSignal.any([controller.current.signal, AbortSignal.timeout(225000)]))
      if (!Array.isArray(response.items) || !response.items.length || response.items.some(item => typeof item !== 'string' || !item.trim())) throw new Error('Could not generate rubric items. Please retry.')
      const generated = checklistText(response.items)
      setCriteria(current => ({ ...current, [selectedLevel]: generated }))
      setRubricNotice(`${nameLevel(selectedLevel)} items generated. Edit them below before starting your test.`)
    } catch (reason) { setRubricError(errorText(reason)) }
    finally { lock.current = false; setGeneratingRubric(false) }
  }
  async function start() {
    if (lock.current || !topic.trim() || !aspects.length) return
    lock.current = true; setBusy(true); setError('')
    setCallTurns([])
    const config = { learningType, level, topic: topic.trim(), criterion }
    try {
      const response = await turn(config, [])
      setComposerVersion(version => version + 1)
      setSavedId(''); setSaveNotice('')
      setRevisingReview(false)
      setRun(config); setMessages([{ role: 'assistant', content: response.message, ...(response.paper ? { paper: response.paper } : {}) }]); setResult(response); setDraft(replay[0] || '')
    } catch (reason) { setError(errorText(reason)) }
    finally { lock.current = false; setBusy(false) }
  }
  async function send(submittedReview?: Review, action?: LearningAction, skipItem?: string): Promise<boolean> {
    if (!run || lock.current || finished || (!submittedReview && !action && !skipItem && !draft.trim())) return false
    const user: Message = skipItem ? { role: 'user', content: `Skip this rubric item: ${skipItem}`, skipRubricItem: skipItem } : { role: 'user', content: submittedReview ? `I graded your papers: ${submittedReview.grades?.map((grade, index) => `paper ${index + 1}: ${grade.grade}${grade.selectedSteps.length ? ` (marked steps ${grade.selectedSteps.join(', ')})` : ''}`).join('; ')}.` : draft.trim(), ...(submittedReview ? { review: submittedReview } : {}), ...(action ? learningActionMessage() : {}) }
    const transcript = [...messages, user]
    lock.current = true; setBusy(true); setPending(user); setError('')
    try {
      const response = await turn(run, transcript)
      setMessages([...transcript, { role: 'assistant', content: response.message, ...(response.rubricFocus ? { rubricFocus: response.rubricFocus } : {}), ...(response.background ? { background: response.background } : {}), ...(response.assistance ? { assistance: true } : {}), ...(response.independentCheck ? { independentCheck: true } : {}), ...(response.paper ? { paper: response.paper } : {}) }]); setResult(response); setDraft(skipItem || submittedReview || action ? draft : replay[transcript.filter(message => message.role === 'user' && !message.skipRubricItem && !message.review && !message.finishAssessment).length] || ''); setRevisingReview(false)
      return true
    } catch (reason) { setError(errorText(reason)); return false }
    finally { lock.current = false; setBusy(false); setPending(null) }
  }
  return <div className="developer-playground">
    <aside className="developer-test-config">
      <label htmlFor={field('saved-playground-test')}>Saved tests</label>
      {!savedReady && <LoadingAnimation label="Loading saved tests" compact />}
      <select hidden={!savedReady} id={field('saved-playground-test')} value={savedId} disabled={working || !savedReady} onChange={event => { const test = savedTests.find(item => item.id === event.target.value); if (test) openTest(test) }}>
        <option value="">Choose a saved test…</option>
        {savedTests.map(test => <option key={test.id} value={test.id}>{test.run.topic} · {learningTypes[test.run.learningType].label} · {nameLevel(test.run.level)} · {new Date(test.updatedAt).toLocaleString()}</option>)}
      </select>
      <button type="button" className="developer-button-secondary" disabled={working || !run || !savedReady} onClick={() => void saveTest()}>{savingTest ? 'Saving…' : savedId ? 'Save changes' : 'Save test'}</button>
      {saveNotice && <p className="developer-config-note" role="status">{saveNotice}</p>}
      {fixes && <fieldset disabled={working}><legend>Fixes</legend><div className="developer-fixes">{fixOptions.map(([name, label]) => <label key={name}><input type="checkbox" checked={fixFlags[name]} onChange={event => setFixFlags(current => ({ ...current, [name]: event.target.checked }))} /> {label}</label>)}</div></fieldset>}
      {fixes && <><label htmlFor="fixes-replay">Replay a downloaded chat</label><input id="fixes-replay" type="file" accept=".md,text/markdown,text/plain" disabled={working} onChange={event => { const file = event.target.files?.[0]; if (!file) return; void file.text().then(text => { const list = studentMessages(text); setReplay(list); setReplayNotice(list.length ? `${list.length} student messages loaded. Each one fills the message box in turn.` : 'No student messages found in this file.'); if (list.length && run && !draft) setDraft(list[messages.filter(message => message.role === 'user').length] || '') }) }} />{replayNotice && <p className="developer-config-note" role="status">{replayNotice}</p>}</>}
      <fieldset disabled={working}><legend>Learning type</legend><div className="developer-levels">{learningTypeIds.map(id => <button type="button" key={id} aria-pressed={id === learningType} onClick={() => { setLearningType(id); setRubricNotice(''); setRubricError('') }}>{learningTypes[id].label}</button>)}</div></fieldset>
      <fieldset disabled={working}><legend>Learning level</legend><div className="developer-levels">{levelIds.map(id => <button type="button" key={id} aria-pressed={id === level} onClick={() => { setLevel(id); setRubricNotice(''); setRubricError('') }}>{nameLevel(id)}</button>)}</div></fieldset>
      <label htmlFor={field('test-concept')}>Concept</label><input id={field('test-concept')} disabled={working} value={topic} maxLength={300} placeholder="e.g. Ohm’s law" onChange={event => { setTopic(event.target.value); setRubricNotice(''); setRubricError('') }} />
      <div className="developer-checklist-heading"><label>{nameLevel(level)} rubric items</label><span>{aspects.length}/20</span></div>
      <button type="button" className="developer-generate-rubric" disabled={working || !topic.trim() || health?.configured === false} onClick={() => void generateItems()}>{generatingRubric ? <LoadingAnimation label="Generating rubric items" compact delayMs={0} /> : aspects.length ? '✦ Regenerate items' : '✦ Generate items'}</button>
      {aspects.length > 0 && <p className="developer-config-note developer-regenerate-note">Regenerating replaces this level’s list.</p>}
      {rubricError && <p className="developer-error" role="alert">{rubricError}</p>}
      {rubricNotice && <p className="developer-notice" role="status">{rubricNotice}</p>}
      <RubricChecklistEditor id={field('test-checklist')} name={`${nameLevel(level)} test rubric`} value={criterion} invalid={false} disabled={working} onChange={value => { setCriterion(value); setRubricNotice('') }} />
      <button type="button" className="send-button developer-start" disabled={working || !topic.trim() || !aspects.length || health?.configured === false} onClick={() => void start()}>{busy ? <LoadingAnimation label="Thinking" compact delayMs={0} /> : run ? 'Start new test →' : 'Start test →'}</button>
      {dirtyPrompts && <p className="developer-warning">You have unsaved prompt edits. Save them in the Prompts tab to use them in a test.</p>}
      {health?.configured === false && <p className="developer-warning">Configure an AI provider to run chat tests.</p>}
    </aside>
    <div className="developer-test-workspace">
      <div className="developer-conversation">
        {run && <header className="developer-conversation-heading"><div><h2>{run.topic}</h2><p>{nameLevel(run.level)} · {learningTypes[run.learningType].label}</p></div><button type="button" className="developer-button-secondary" disabled={working} onClick={() => { setSavedId(''); setSaveNotice(''); setRun(null); setCallTurns([]); setMessages([]); setResult(null); setDraft(''); setError('') }}>Clear test</button></header>}
        <div ref={log} className="developer-chat-log" role="log" aria-label="Test conversation" aria-live="polite">
          {[...messages, ...(pending ? [pending] : [])].map((message, index) => {
            const skipItem = fixes && !pending && !finished && message.role === 'assistant' && index === messages.length - 1 && message.rubricFocus && rubricSkipReason(messages, message.rubricFocus, { early: fixFlags.clearSkip }) ? message.rubricFocus : undefined
            const offer = skipItem && <SkipRubricButton busy={working} onSkip={() => { void send(undefined, undefined, skipItem) }} onContinue={() => setMessages(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, skipOfferDeclined: true } : item))} />
            return <div key={index} className={`chat-message ${message.role} ${message.paper ? 'developer-message-with-paper' : ''}`}><div className="chat-message-copy"><span>{message.assistance ? 'Prerequisite review' : message.role === 'user' ? 'You' : characterName}</span><div className="chat-message-text"><ChatText>{skipItem && !fixFlags.clearSkip ? 'Alright, no problem. Would you like to skip this?' : message.content}</ChatText></div>{skipItem && fixFlags.clearSkip && <p className="developer-skip-offer">Skip this one and move on?</p>}{offer}</div>{message.paper && <PaperReview characterName={characterName} key={`${message.paper.id}-${reviewVersion}`} paper={message.paper} review={revisingReview ? undefined : messages.findLast(item => item.review?.paperId === message.paper?.id)?.review} busy={working} error={error} onSubmit={send} autoOpen={revisingReview && message.paper.id === paper?.id} onClose={() => setRevisingReview(false)} />}</div>
          })}
          {busy && <LoadingAnimation label={run ? 'Thinking' : 'Starting your test'} delayMs={0} />}
          {result?.finalSummary && <div className="developer-report"><strong>Learning report{result.analysisGrade !== undefined ? ` · Rubric mastery ${result.analysisGrade}%` : ''}</strong><p>{result.finalSummary}</p></div>}
        </div>
        {run && (finished ? <div className="developer-test-ended" role="status">{result?.assessment?.complete ? `${nameLevel(run.level)} complete.` : 'Assessment finished.'} Start a new test to try again.</div> : awaitingReview ? <div className="developer-test-ended">Grade all three papers to continue.</div> : <ChatComposer key={composerVersion} className="developer-composer" value={draft} onChange={setDraft} onSend={() => { void send() }} busy={working} />)}
        {error && <p className="developer-error" role="alert">{error}</p>}
        {run && !finished && <LearningActions busy={working} canFinish={Boolean(review && result?.assessment)} canRevise={Boolean(review)} onAction={action => { void send(undefined, action) }} onRevise={() => { setReviewVersion(value => value + 1); setRevisingReview(true) }} />}
        {working && <p role="status">Checking evidence and preparing a response…</p>}
      </div>
      <section className="developer-terminal" aria-label="Conversation JSON log">
        <header><span><span aria-hidden="true">›_</span> Call log</span><span>{callTurns.length} turns · {callTurns.reduce((count, turn) => count + turn.calls.length, 0)} model calls</span></header>
        <div className="developer-terminal-scroll">
          {!callTurns.length && <p className="developer-terminal-empty">Start a test to inspect prompt requests and JSON responses.</p>}
          {callTurns.map((turn, index) => <div className="developer-trace-turn" key={index}>
            <div className="developer-trace-heading">TURN {String(index + 1).padStart(2, '0')} <span>{turn.error ? 'failed' : turn.response ? 'complete' : 'running…'}</span></div>
            <details className="developer-trace-json"><summary>Conversation input</summary><pre>{JSON.stringify(turn.request, null, 2)}</pre></details>
            {turn.calls.map((call, callIndex) => <details className="developer-trace-call" key={callIndex} open>
              <summary><span>{String(callIndex + 1).padStart(2, '0')} / {call.role}</span><span>{call.error ? 'failed · ' : ''}{(call.durationMs / 1000).toFixed(1)}s</span></summary>
              <details className="developer-trace-json"><summary>Request · prompt, messages & schema</summary><pre>{JSON.stringify(call.request, null, 2)}</pre></details>
              <details className="developer-trace-json" open><summary>{call.error ? 'Error' : 'Response'}</summary><pre>{JSON.stringify(call.error ? { error: call.error } : call.response, null, 2)}</pre></details>
            </details>)}
            {Boolean(turn.response) && !turn.calls.length && <p className="developer-terminal-empty">No model call · generated from a saved prompt.</p>}
            {Boolean(turn.response) && <details className="developer-trace-json"><summary>Conversation output</summary><pre>{JSON.stringify(turn.response, null, 2)}</pre></details>}
            {turn.error && <pre className="developer-trace-error">{JSON.stringify({ error: turn.error }, null, 2)}</pre>}
          </div>)}
        </div>
      </section>
    </div>
  </div>
}
