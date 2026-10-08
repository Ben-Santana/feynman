import { ChatComposer } from './components/ChatComposer'
import { TooltipButton } from './components/TooltipButton'
import { ChatText } from './components/ChatText'
import { useEffect, useRef, useState } from 'react'
import { BackButton } from './components/BackButton'
import { DeveloperPage } from './components/DeveloperPage'
import { RubricLoading } from './components/RubricLoading'
import { AISettings } from './components/AISettings'
import { AISettingsButton } from './components/AISettingsButton'
import { aiHeaders, fruitFlySelected, localAIResponse } from './aiPreferences'
import { fruitFlyBuzz, fruitFlyRubric } from './fruitFly'
import { Bloub } from './components/Bloub'
import { CornerDrops } from './components/CornerDrops'
import { PaperReview, type Review } from './components/PaperReview'
import { ReviewFeedback } from './components/ReviewFeedback'
import { RubricChecklistEditor } from './components/RubricChecklistEditor'
import { checklistItems } from './rubricChecklist.js'
import { RubricAutoGenerateToggle } from './components/RubricAutoGenerateToggle'
import { SessionSummary, SummaryUnavailable } from './components/SessionSummary'
import { Whiteboard, type WhiteboardHandle } from './components/Whiteboard'
import { loadLearning, loadSessions, saveSessions, type SavedSession } from './learningStore'
import { advanceConcept, assessmentTranscript, restoreLearning, sessionComplete, startConcepts, targetCount, type ChatResult, type Concept, type ConceptRubric, type Level, type Message, type Session } from './learningFlow'
import { draftTarget, editCriterion, fillMissingRubric, genericRubric, highestFilledLevel, mergeSuggestions, restoreDraft, withBasicCriterion } from './rubricSetup'
import { generateRubricBatches } from './rubricGeneration'

import { LearningTypeSelector } from './components/LearningTypeSelector'
import { LearningTypeChangeDialog } from './components/LearningTypeChangeDialog'
import { learningTypes, type LearningType } from './learningTypes.js'

const levels: { id: Level; name: string }[] = [
  { id: 'remember', name: 'Remember' },
  { id: 'understand', name: 'Understand' },
  { id: 'apply', name: 'Apply' },
  { id: 'analyze', name: 'Analyze' },
]
const emptyRubric = (): ConceptRubric => ({ remember: '', understand: '', apply: '', analyze: '' })
const newConcept = (name = '', rubric: ConceptRubric = emptyRubric()): Concept => ({ id: crypto.randomUUID(), name, rubric, target: 'analyze', passed: 0, stageStart: 0, messages: [], draft: '', assessment: null })

function LevelSlider({ id, name, value, onChange }: { id: string; name: string; value: Level; onChange: (level: Level) => void }) {
  const index = levels.findIndex(level => level.id === value)
  const percent = index / (levels.length - 1) * 100
  const position = `calc(${percent}% + ${12 - percent * .24}px)`
  return <div className="level-selector">
    <label className="sr-only" htmlFor={id}>Target level for {name}</label>
    <div className="level-slider-wrap">
      <div className="level-slider-track" aria-hidden="true"><span className="level-slider-fill" style={{ width: position }} />{levels.map(level => <span className="level-slider-stop" key={level.id} />)}<span className="level-slider-thumb" style={{ left: position }} /></div>
      <span className="level-slider-tooltip" style={{ left: position }} aria-hidden="true">{levels[index].name}</span>
      <input id={id} className="level-slider-input" type="range" min="0" max="3" step="1" value={index} aria-valuetext={levels[index].name} onChange={event => onChange(levels[Number(event.target.value)].id)} />
    </div>
  </div>
}

async function post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  const local = localAIResponse(path, body)
  if (local !== undefined) return local as T
  const response = await fetch(path, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...aiHeaders() }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'The request failed. Please retry.')
  return data as T
}

function App() {
  const [page, setPage] = useState(window.location.pathname.replace(/\/$/, '') || '/')
  const isDeveloperPage = page === '/developer'
  const isChatPage = page === '/chat'
  const isSessionsPage = page === '/sessions'
  const isSummaryPage = page === '/summary'
  const [sessionId, setSessionId] = useState('')
  const [title, setTitle] = useState('')
  const [learningType, setLearningType] = useState<LearningType | null>(null)
  const [pendingLearningType, setPendingLearningType] = useState<LearningType | null>(null)
  const profile = learningTypes[learningType ?? 'quantitative']
  const quantitative = learningType === 'quantitative'
  const [setupStep, setSetupStep] = useState<'title' | 'class-type' | 'concepts' | 'loading' | 'rubric'>('title')
  const [generatedConcepts, setGeneratedConcepts] = useState(0)
  const setupProgress = { title: 25, 'class-type': 50, concepts: 75, loading: 75, rubric: 100 }[setupStep]
  const setupProgressLabel = { title: 'Name your session', 'class-type': 'Choose your class type', concepts: 'Add concepts', loading: 'Creating your rubric', rubric: 'Review your rubric' }[setupStep]
  const [files, setFiles] = useState<File[]>([])
  const [selectedTargets, setSelectedTargets] = useState<Record<string, Level | null>>({})
  const [aiByName, setAiByName] = useState(true)
  const [rubricInstructions, setRubricInstructions] = useState('')
  const [savedSessions, setSavedSessions] = useState<SavedSession<Concept, Session>[]>([])
  const [sessionMenu, setSessionMenu] = useState<{ id: string; left: number; top: number } | null>(null)
  const sessionsRef = useRef<SavedSession<Concept, Session>[]>([])
  const [concepts, setConcepts] = useState<Concept[]>([newConcept()])
  const hasRubric = concepts.some(concept => levels.some(level => checklistItems(concept.rubric[level.id]).length > 0))
  const [active, setActive] = useState<string>('')
  const [started, setStarted] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [boardHovered, setBoardHovered] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<Message | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState<{ step: 'title' | 'concepts' | 'rubric'; fieldId: string; message: string; attempt: number } | null>(null)
  const [trackerOverflow, setTrackerOverflow] = useState(false)
  const [conceptTooltip, setConceptTooltip] = useState<{ name: string; left: number; top: number } | null>(null)
  const messageList = useRef<HTMLDivElement>(null)
  const tracker = useRef<HTMLDivElement>(null)
  const whiteboard = useRef<WhiteboardHandle>(null)
  const requestLock = useRef(false)
  const saveQueue = useRef(Promise.resolve())
  const currentConcept = concepts.find(concept => concept.id === active)
  const session: Session = currentConcept || { messages: [], draft: '', assessment: null }
  const done = Boolean(currentConcept && currentConcept.passed >= targetCount(currentConcept.target))
  const paper = session.messages.findLast(message => message.paper)?.paper
  const review = paper ? session.messages.find(message => message.review?.paperId === paper.id)?.review : undefined

  function showConceptTooltip(button: HTMLButtonElement, name: string) {
    const bounds = button.getBoundingClientRect()
    const halfWidth = Math.min(110, (window.innerWidth - 24) / 2)
    setConceptTooltip({ name, left: Math.max(halfWidth + 12, Math.min(bounds.left + bounds.width / 2, window.innerWidth - halfWidth - 12)), top: bounds.bottom + 8 })
  }

  useEffect(() => {
    if (!validationError?.fieldId) return
    const field = document.getElementById(validationError.fieldId)
    const scroll = field?.closest('.rubric-scroll')
    if (!field || !scroll) return
    const fieldBounds = field.getBoundingClientRect()
    const scrollBounds = scroll.getBoundingClientRect()
    if (fieldBounds.left < scrollBounds.left) scroll.scrollBy({ left: fieldBounds.left - scrollBounds.left - 12, behavior: 'smooth' })
    else if (fieldBounds.right > scrollBounds.right) scroll.scrollBy({ left: fieldBounds.right - scrollBounds.right + 12, behavior: 'smooth' })
  }, [validationError])

  useEffect(() => {
    Promise.all([loadSessions<Concept, Session>(), loadLearning<Concept>()]).then(([saved, legacy]) => {
      const records = saved ?? (legacy && restoreLearning(legacy) ? [{ ...legacy, id: crypto.randomUUID(), title: legacy.concepts.map(concept => concept.name).filter(Boolean).slice(0, 2).join(', ') || 'Learning session', updatedAt: Date.now(), started: Boolean(restoreLearning(legacy)?.started) }] : [])
      sessionsRef.current = records
      setSavedSessions(records)
      const requested = new URLSearchParams(window.location.search).get('session')
      const selected = records.find(record => record.id === requested) || records[0]
      if (selected) {
        const restored = restoreLearning(selected)
        if (restored) { const draft = restoreDraft(selected); setConcepts(restored.concepts); setStarted(restored.started); setActive(restored.activeId || ''); setSessionId(selected.id); setTitle(draft.title); setSetupStep(draft.step); setFiles(draft.files); setSelectedTargets(draft.selectedTargets); setAiByName(draft.aiByName); setRubricInstructions(draft.rubricInstructions); setLearningType(draft.learningType); setPendingLearningType(null) }
      } else if (window.location.pathname.replace(/\/$/, '') === '/chat') setSessionId(crypto.randomUUID())
    }).catch(() => setError('Saved learning could not be loaded in this browser.')).finally(() => setHydrated(true))
  }, [])
  useEffect(() => {
    if (!hydrated || !sessionId || (!title.trim() && !learningType)) return
    const record: SavedSession<Concept, Session> = { id: sessionId, title: title.trim(), updatedAt: Date.now(), started, concepts, activeId: active || null, setupStep: setupStep === 'loading' ? 'concepts' : setupStep, files: started ? [] : files, selectedTargets, aiByName, rubricInstructions, learningType }
    const next = [record, ...sessionsRef.current.filter(item => item.id !== sessionId)]
    sessionsRef.current = next
    setSavedSessions(next)
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveSessions(next)).catch(() => setError('Could not save sessions in this browser.'))
  }, [concepts, active, started, sessionId, hydrated, title, setupStep, files, selectedTargets, aiByName, rubricInstructions, learningType])
  useEffect(() => {
    if (hydrated && isChatPage && started && sessionComplete(concepts) && currentConcept?.passed === levels.length) navigate(`/summary?session=${encodeURIComponent(sessionId)}`, true)
  }, [hydrated, isChatPage, started, concepts, currentConcept, sessionId])
  useEffect(() => {
    const onPopState = () => {
      setPage(window.location.pathname.replace(/\/$/, '') || '/')
      const requested = new URLSearchParams(window.location.search).get('session')
      const record = sessionsRef.current.find(item => item.id === requested)
      if (record && record.id !== sessionId) {
        const restored = restoreLearning(record)
        if (restored) { const draft = restoreDraft(record); setConcepts(restored.concepts); setStarted(restored.started); setActive(restored.activeId || ''); setSessionId(record.id); setTitle(draft.title); setSetupStep(draft.step); setFiles(draft.files); setSelectedTargets(draft.selectedTargets); setAiByName(draft.aiByName); setRubricInstructions(draft.rubricInstructions); setLearningType(draft.learningType); setPendingLearningType(null) }
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [sessionId])
  useEffect(() => {
    if (!sessionMenu) return
    const closeMenu = (event: PointerEvent) => { if (!(event.target as HTMLElement).closest('.session-context-menu, .session-menu-trigger')) setSessionMenu(null) }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSessionMenu(null) }
    document.addEventListener('pointerdown', closeMenu)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeMenu); document.removeEventListener('keydown', closeOnEscape) }
  }, [sessionMenu])

  function navigate(path: string, replace = false) { window.history[replace ? 'replaceState' : 'pushState'](null, '', path); setPage(path.split('?')[0]) }
  function deleteSession(record: SavedSession<Concept, Session>) {
    setSessionMenu(null)
    if (!window.confirm(`Delete “${record.title || 'Untitled session'}”? This session and its progress will be removed from this browser.`)) return
    setError('')
    const next = sessionsRef.current.filter(item => item.id !== record.id)
    sessionsRef.current = next
    setSavedSessions(next)
    if (sessionId === record.id) { setSessionId(''); setTitle(''); setActive('') }
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveSessions(next)).catch(() => setError('Could not delete the session from this browser.'))
  }
  function openSession(record: SavedSession<Concept, Session>) {
    if (busy) return
    setSessionMenu(null)
    const restored = restoreLearning(record)
    if (!restored) return
    const draft = restoreDraft(record)
    setConcepts(restored.concepts); setStarted(restored.started); setActive(restored.activeId || ''); setSessionId(record.id); setTitle(draft.title); setSetupStep(draft.step); setFiles(draft.files); setSelectedTargets(draft.selectedTargets); setAiByName(draft.aiByName); setRubricInstructions(draft.rubricInstructions); setLearningType(draft.learningType); setPendingLearningType(null); setError('')
    navigate(`/${record.started && sessionComplete(restored.concepts) ? 'summary' : 'chat'}?session=${encodeURIComponent(record.id)}`)
  }
  function createSession() {
    if (busy) return
    setSessionMenu(null)
    const id = crypto.randomUUID()
    setConcepts([newConcept()]); setActive(''); setStarted(false); setSessionId(id); setTitle(''); setSetupStep('title'); setFiles([]); setSelectedTargets({}); setAiByName(true); setRubricInstructions(''); setLearningType(null); setPendingLearningType(null); setValidationError(null); setError('')
    navigate(`/chat?session=${encodeURIComponent(id)}`)
  }
  useEffect(() => { if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight }, [active, session.messages.length, pendingMessage, busy])
  useEffect(() => {
    const element = tracker.current
    if (!element) return
    const update = () => {
      const overflows = element.scrollWidth > element.clientWidth + 1
      setTrackerOverflow(overflows)
      if (overflows && element.scrollLeft === 0) element.scrollLeft = element.scrollWidth
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => observer.disconnect()
  }, [started, concepts.length])

  function updateSession(patch: Partial<Session>) {
    if (currentConcept) setConcepts(items => items.map(item => item.id === currentConcept.id ? { ...item, ...patch } : item))
  }
  function updateConcept(id: string, patch: Partial<Concept>) { setValidationError(null); setConcepts(items => items.map(item => item.id === id ? { ...item, ...patch } : item)) }
  function showValidation(step: 'title' | 'concepts' | 'rubric', fieldId: string, message: string) {
    setValidationError(previous => ({ step, fieldId, message, attempt: (previous?.attempt ?? 0) + 1 }))
  }
  function validationTooltip(step: 'title' | 'concepts' | 'rubric') {
    return validationError?.step === step && <span className="validation-tooltip" role="alert">{validationError.message}</span>
  }
  function validateNames(step: 'concepts' | 'rubric') {
    const names = concepts.map(concept => concept.name.trim())
    const blank = names.findIndex(name => !name)
    if (blank !== -1) { showValidation(step, `${step === 'concepts' ? 'setup-name' : 'concept'}-${concepts[blank].id}`, 'Name this concept to continue.'); return false }
    const duplicate = names.findIndex((name, index) => names.findIndex(other => other.toLocaleLowerCase() === name.toLocaleLowerCase()) !== index)
    if (duplicate !== -1) { showValidation(step, `${step === 'concepts' ? 'setup-name' : 'concept'}-${concepts[duplicate].id}`, 'Give each concept a different name.'); return false }
    return true
  }
  function switchChat(id: string) {
    if (busy) return
    setError(''); setActive(id)
  }
  function changeLearningType(value: LearningType) {
    if (started || uploading || busy || setupStep !== 'class-type') return
    if (learningType !== null && value !== learningType && hasRubric) {
      setPendingLearningType(value)
      return
    }
    setLearningType(value)
    setValidationError(null)
    setSetupStep('concepts')
    setError('')
  }
  function confirmLearningTypeChange() {
    if (!pendingLearningType || started || setupStep !== 'class-type') return
    setSelectedTargets(targets => Object.fromEntries(concepts.map(concept => [concept.id, draftTarget(concept, targets[concept.id])])))
    setConcepts(items => items.map(concept => ({ ...concept, rubric: emptyRubric() })))
    setLearningType(pendingLearningType)
    setPendingLearningType(null)
    setValidationError(null)
    setSetupStep('concepts')
    setError('')
  }
  function startLearning() {
    if (!learningType) { showValidation('rubric', '', 'Choose a learning type before starting.'); return }
    if (!title.trim()) { showValidation('rubric', 'rubric-title', 'Choose a title before starting.'); return }
    if (!validateNames('rubric')) return
    for (const concept of concepts) {
      const target = highestFilledLevel(concept.rubric)
      for (const level of levels) {
        if (!checklistItems(concept.rubric[level.id]).length) { showValidation('rubric', `${concept.id}-${level.id}`, `Add a ${level.name} checklist item for ${concept.name}.`); return }
        if (level.id === target) break
      }
    }
    setValidationError(null)
    setConcepts(items => startConcepts(items).map(concept => fruitFlySelected() ? { ...concept, messages: [{ role: 'assistant', content: fruitFlyBuzz() }], expression: 'excited' } : concept))
    setActive(concepts[0].id)
    setStarted(true)
    setFiles([])
    setError('')
  }
  function addFiles(incoming: File[]) {
    const next = [...files, ...incoming]
    if (next.reduce((total, file) => total + file.size, 0) > 5_000_000) { setError('Choose files totaling less than 5 MB.'); return }
    setFiles(next); setError('')
  }
  async function encodedFiles() {
    return Promise.all(files.map(async file => ({ name: file.name, type: file.type, data: await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = () => reject(new Error('Could not read the file.'))
      reader.readAsDataURL(file)
    }) })))
  }
  async function suggestConcepts() {
    if (!files.length || uploading) return
    setUploading(true); setError('')
    try {
      const result = await post<{ names: string[] }>('/api/concept-suggestions', { files: await encodedFiles(), learningType }, AbortSignal.timeout(225000))
      const next = mergeSuggestions(concepts, result.names, name => newConcept(name))
      setConcepts(next)
      setSelectedTargets(targets => Object.fromEntries(next.map(concept => [concept.id, targets[concept.id] ?? null])))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not suggest concepts.') }
    finally { setUploading(false) }
  }
  async function continueToRubric() {
    if (!learningType) { showValidation('concepts', '', 'Choose a learning type to continue.'); return }
    if (!validateNames('concepts')) return
    setValidationError(null)
    setError('')
    if (fruitFlySelected()) {
      setConcepts(items => items.map(concept => ({ ...concept, rubric: fruitFlyRubric(draftTarget(concept, selectedTargets[concept.id])) as ConceptRubric })))
      setAiByName(false)
      setSetupStep('rubric')
      return
    }
    if (!aiByName) {
      setConcepts(items => items.map(concept => fillMissingRubric(concept, draftTarget(concept, selectedTargets[concept.id]), genericRubric(concept.name.trim(), draftTarget(concept, selectedTargets[concept.id]), learningType))))
      setSetupStep('rubric')
      return
    }
    setGeneratedConcepts(0)
    setSetupStep('loading')
    try {
      const sourceFiles = await encodedFiles()
      const result = await generateRubricBatches(
        concepts.map(concept => ({ name: concept.name.trim(), target: draftTarget(concept, selectedTargets[concept.id]) })),
        (batch, previousRubric) => post<{ concepts: { name: string; rubric: ConceptRubric }[] }>('/api/rubric', { concepts: batch, previousRubric, files: sourceFiles, learningType, additionalInstructions: rubricInstructions.trim() }, AbortSignal.timeout(225000)),
        setGeneratedConcepts,
      )
      setConcepts(items => items.map((concept, index) => ({ ...concept, rubric: result[index].rubric })))
      setAiByName(false)
      setSetupStep('rubric')
    } catch (reason) { showValidation('concepts', '', reason instanceof Error ? reason.message : 'Could not generate the rubric.'); setSetupStep('concepts') }
  }

  async function levelOpening(concept: Concept, level: Level, signal: AbortSignal, priorMessages: Message[] = concept.messages): Promise<ChatResult> {
    if (fruitFlySelected()) return post<ChatResult>('/api/chat', {}, signal)
    if (!learningType) throw new Error('Choose a learning type before starting.')
    return post<ChatResult>('/api/chat', { level, learningType, topic: concept.name, aspects: checklistItems(concept.rubric[level]), criterion: concept.rubric[level], messages: [], priorMessages: priorMessages.slice(-100) }, signal)
  }
  async function raiseTarget(concept: Concept, target: Level) {
    if (busy || targetCount(target) <= targetCount(concept.target)) return
    const nextConcept = fruitFlySelected() && !checklistItems(concept.rubric[target]).length ? { ...concept, rubric: { ...concept.rubric, [target]: fruitFlyBuzz() } } : withBasicCriterion(concept, target, learningType ?? 'quantitative')
    if (concept.passed < targetCount(concept.target)) { updateConcept(concept.id, { target, rubric: nextConcept.rubric }); return }
    setBusy(true); setError('')
    try {
      const level = levels[concept.passed].id
      const controller = new AbortController()
      const response = await levelOpening(nextConcept, level, controller.signal)
      const message: Message = { role: 'assistant', content: response.message, passedLevel: levels[concept.passed - 1].id, ...('paper' in response && response.paper ? { paper: response.paper } : {}) }
      updateConcept(concept.id, { target, rubric: nextConcept.rubric, messages: [...concept.messages, message], stageStart: concept.messages.length, assessment: null, expression: response.expression })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start the next level.') }
    finally { setBusy(false) }
  }
  async function retryAnalyze(concept: Concept) {
    if (busy || !quantitative) return
    setBusy(true); setError('')
    try {
      const result = await levelOpening(concept, 'analyze', new AbortController().signal, [])
      const prior = concept.messages.at(-1)?.role === 'assistant' ? concept.messages.slice(0, -1) : concept.messages
      updateConcept(concept.id, { messages: [...prior, { role: 'assistant', content: result.message, ...(result.paper ? { paper: result.paper } : {}) }], finalSummary: undefined, analysisGrade: undefined, assessment: null })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start another paper set.') }
    finally { setBusy(false) }
  }
  async function send(submittedReview?: Review): Promise<boolean> {
    if (requestLock.current || done || (submittedReview && !quantitative) || (!submittedReview && !session.draft.trim())) return false
    requestLock.current = true; setBusy(true); setError('')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 195000)
    const board = whiteboard.current?.snapshot()
    const userMessage: Message = { role: 'user', content: submittedReview ? submittedReview.grades ? `I graded your papers: ${submittedReview.grades.map((grade, index) => `paper ${index + 1} ${grade.grade === 'pass' ? 'Pass' : 'Fail'}${grade.selectedSteps.length ? ` (marked ${grade.selectedSteps.map(step => `step ${step}`).join(', ')})` : ''}`).join('; ')}.` : `I grade your paper ${submittedReview.grade === 'pass' ? 'Pass' : 'Fail'}.${submittedReview.selectedSteps?.length ? ` I marked ${submittedReview.selectedSteps.map(step => `step ${step}`).join(', ')} as incorrect.` : ''}` : session.draft.trim(), ...(submittedReview ? { review: submittedReview } : {}), ...(board ? { boardImage: board.image } : {}) }
    const messages = [...session.messages, userMessage]
    setPendingMessage(userMessage)
    if (!submittedReview) updateSession({ draft: '' })
    try {
      if (!currentConcept) throw new Error('Select a concept chat to continue.')
      const level = levels[currentConcept.passed].id
      if (!learningType) throw new Error('Choose a learning type before starting.')
      const stageMessages = assessmentTranscript(currentConcept, userMessage, learningType)
      const result = await post<ChatResult>('/api/chat', { level, learningType, topic: currentConcept.name, aspects: checklistItems(currentConcept.rubric[level]), criterion: currentConcept.rubric[level], messages: stageMessages }, controller.signal)
      let nextOpening: { message: string; paper?: ChatResult['paper'] } | undefined
      if (result.assessment?.complete && currentConcept.passed + 1 < targetCount(currentConcept.target)) {
        const nextLevel = levels[currentConcept.passed + 1].id
        const opening = await levelOpening(currentConcept, nextLevel, controller.signal, messages)
        nextOpening = { message: opening.message, ...('paper' in opening && opening.paper ? { paper: opening.paper } : {}) }
      }
      setConcepts(items => items.map(item => item.id === currentConcept.id ? { ...advanceConcept(item, messages, result, nextOpening), draft: '' } : item))
      if (board) whiteboard.current?.markSent(board.version)
      return true
    } catch (reason) {
      if (!submittedReview) updateSession({ draft: userMessage.content })
      setError(reason instanceof Error ? reason.name === 'AbortError' ? 'The request timed out. Please retry.' : reason.message : 'Connection failed. Please retry.')
    }
    finally { setPendingMessage(null); clearTimeout(timeout); requestLock.current = false; setBusy(false) }
    return false
  }
  const activeSessions = savedSessions.filter(record => !record.started || !sessionComplete(record.concepts))
  const pastSessions = savedSessions.filter(record => record.started && sessionComplete(record.concepts))

  function renderSessionCard(record: SavedSession<Concept, Session>) {
      const complete = record.started && sessionComplete(record.concepts)
      const sessionTitle = record.title || 'Untitled session'
      return <div className="session-card-wrap" key={record.id} onContextMenu={event => { event.preventDefault(); const bounds = event.currentTarget.getBoundingClientRect(); setSessionMenu({ id: record.id, left: Math.min(event.clientX - bounds.left, bounds.width - 180), top: event.clientY - bounds.top }) }}><button type="button" className={`session-card ${complete ? 'session-card-complete' : record.started ? '' : 'session-card-draft'}`} onClick={() => openSession(record)}><span className="session-card-icon" aria-hidden="true">{complete ? <span className="session-complete-dot" /> : record.started ? '✦' : '✎'}</span><span className="session-card-copy"><strong>{sessionTitle}</strong><small><span>{record.concepts.length} {record.concepts.length === 1 ? 'concept' : 'concepts'}</span><span aria-hidden="true">·</span><span className={complete ? 'session-status-complete' : undefined}>{complete ? 'Complete' : record.started ? 'In progress' : 'Draft'}</span><span aria-hidden="true">·</span><time dateTime={new Date(record.updatedAt).toISOString()}>{new Date(record.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></small></span><span className="session-card-arrow" aria-hidden="true">→</span></button><button type="button" className="session-menu-trigger" aria-label={`Options for ${sessionTitle}`} aria-haspopup="menu" aria-expanded={sessionMenu?.id === record.id} onClick={event => { const bounds = event.currentTarget.parentElement!.getBoundingClientRect(); setSessionMenu(sessionMenu?.id === record.id ? null : { id: record.id, left: bounds.width - 180, top: event.currentTarget.offsetTop + event.currentTarget.offsetHeight }) }}>⋯</button>{sessionMenu?.id === record.id && <div className="session-context-menu" role="menu" style={{ left: Math.max(8, sessionMenu.left), top: sessionMenu.top }}><button type="button" role="menuitem" onClick={() => deleteSession(record)}>Delete session</button></div>}</div>
  }

  if (page === '/settings') return <main className="bg-background text-foreground"><AISettings onBack={() => navigate('/sessions')} /></main>
  if (isDeveloperPage) return <main className="bg-background text-foreground"><AISettingsButton onClick={() => navigate('/settings')} /><DeveloperPage onBack={() => navigate('/')} /></main>
  if (!hydrated) return <main className="bg-background text-foreground"><p className="loading-learning">Loading learning…</p></main>
  return <main className="bg-background text-foreground">
    {(isSessionsPage || isSummaryPage || (isChatPage && !started)) && <AISettingsButton onClick={() => navigate('/settings')} />}
    {isSessionsPage ? <section className="sessions-page">
      <nav className="back-navigation" aria-label="Sessions navigation"><BackButton onClick={() => navigate('/')} destination="home" /></nav>
      <div className="sessions-shell">
        <div className="sessions-heading">
          <h1>Sessions</h1>
          <button type="button" className="sessions-new" onClick={createSession}>＋ New session</button>
        </div>
        <div className="sessions-list">
          {activeSessions.length ? activeSessions.map(renderSessionCard) : <div className="sessions-empty">
            <svg className="sessions-empty-icon" role="img" aria-label="Empty" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 4-2 10v5a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-5L20 4Z" />
              <path d="M2 14h6l2 3h4l2-3h6" />
            </svg>
            <p>Click New session to start.</p>
          </div>}
        </div>
        {pastSessions.length > 0 && <details className="sessions-past" onToggle={() => setSessionMenu(null)}>
          <summary>
            <svg className="sessions-past-chevron" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m7 4 6 6-6 6" /></svg>
            <span className="sessions-past-show">Show past sessions</span>
            <span className="sessions-past-hide">Hide past sessions</span>
            <span className="sessions-past-count">{pastSessions.length}</span>
          </summary>
          <div className="sessions-list sessions-past-list">{pastSessions.map(renderSessionCard)}</div>
        </details>}
        {error && <p className="chat-error" role="alert">{error}</p>}
      </div>
    </section> : isSummaryPage ? started && sessionComplete(concepts) ? <SessionSummary title={title} learningType={learningType ?? 'quantitative'} concepts={concepts} onBack={() => navigate('/sessions')} onNewSession={createSession} /> : <SummaryUnavailable hasSession={Boolean(sessionId)} onBack={() => navigate('/sessions')} onContinue={sessionId ? () => navigate(`/chat?session=${encodeURIComponent(sessionId)}`) : createSession} /> : !isChatPage ? <section className="home-hero"><div className="home-hero-art"><Bloub mode="hero" /></div><CornerDrops /><div className="home-hero-copy"><div className="home-hero-content"><p className="font-display text-sm font-medium tracking-[0.2em] text-primary uppercase">Feynman</p><h1 className="font-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Learn by teaching.</h1><p className="mt-4 text-lg leading-relaxed text-muted-foreground">Teach your AI classmate what you have been learning, one concept at a time.</p><button className="home-chat-link" onClick={() => navigate('/sessions')}>Start learning →</button></div></div></section> : <>
      <nav className={`back-navigation chat-nav ${started ? 'chat-nav-started' : ''}`} aria-label="Learning navigation">
        <BackButton onClick={() => { if (!started && setupStep !== 'title' && setupStep !== 'loading') { if (setupStep === 'rubric') setAiByName(false); setSetupStep(setupStep === 'rubric' ? 'concepts' : setupStep === 'concepts' ? 'class-type' : 'title'); setValidationError(null); setError('') } else navigate('/sessions') }} destination={!started && setupStep !== 'title' && setupStep !== 'loading' ? 'previous step' : 'sessions'} />
        {!started && title.trim() && <h1 className="rubric-page-title" title={title.trim()}>{title.trim()}</h1>}
        {started && <>
          <h1 className="chat-page-title" title={currentConcept?.name || 'Your learning'}>{currentConcept?.name || 'Your learning'}</h1>
          <div ref={tracker} className={`concept-tracker ${trackerOverflow ? 'concept-tracker-overflow' : ''}`} role="group" aria-label="Concept progress" tabIndex={trackerOverflow ? 0 : undefined} onScroll={() => setConceptTooltip(null)}>
            {concepts.map(concept => <button key={concept.id} type="button" className="concept-orb" disabled={busy} onClick={() => switchChat(concept.id)} onMouseEnter={event => showConceptTooltip(event.currentTarget, concept.name)} onMouseLeave={() => setConceptTooltip(null)} onFocus={event => showConceptTooltip(event.currentTarget, concept.name)} onBlur={() => setConceptTooltip(null)} aria-label={`${concept.name}, ${concept.passed} of ${targetCount(concept.target)} target levels complete`} aria-current={active === concept.id ? 'true' : undefined}><svg className="concept-orb-visual" viewBox="0 0 32 32" aria-hidden="true"><circle className="concept-orb-track" cx="16" cy="16" r="13.75" /><circle className="concept-orb-progress" cx="16" cy="16" r="13.75" pathLength="100" strokeDasharray={`${Math.min(concept.passed / targetCount(concept.target), 1) * 100} 100`} />{active === concept.id && <circle className="concept-orb-selection" cx="16" cy="16" r="5" />}</svg></button>)}
          </div>
          {conceptTooltip && <span className="rubric-help-tooltip concept-orb-tooltip" style={{ left: conceptTooltip.left, top: conceptTooltip.top }} role="tooltip">{conceptTooltip.name}</span>}
        </>}
      </nav>
      <section className={`chat-section ${started ? 'chat-section-started' : 'chat-section-setup'} ${boardOpen ? 'board-open' : 'board-closed'} ${!started && setupStep === 'class-type' ? 'class-type-section' : ''}`} aria-label="Learning chat"><aside className="chat-avatar" aria-label="Your classroom student">{started && <div id="classroom-whiteboard" className="whiteboard-container" onPointerEnter={event => { if (event.pointerType === 'mouse') setBoardHovered(true) }} onPointerLeave={() => setBoardHovered(false)}><TooltipButton type="button" className="whiteboard-toggle" tooltip={boardOpen ? 'Collapse whiteboard' : 'Open whiteboard'} aria-label={boardOpen ? 'Collapse whiteboard' : 'Open whiteboard'} aria-expanded={boardOpen} aria-controls="whiteboard-drawing" onClick={() => setBoardOpen(open => !open)}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /></svg></TooltipButton><div id="whiteboard-drawing" className="whiteboard-drawing" aria-hidden={!boardOpen} inert={!boardOpen}><Whiteboard key={active} ref={whiteboard} open={boardOpen} /></div></div>}{started && <div className="avatar-character"><Bloub key={active} showControls={false} followPointer={boardOpen && boardHovered} expression={boardOpen && boardHovered ? 'attentive' : done ? 'excited' : busy ? 'attentive' : session.expression || 'attentive'} /></div>}</aside>
        <div className="chat-panel">
          {!started && <div className="setup-progress" role="progressbar" aria-label="Session setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={setupProgress} aria-valuetext={setupProgressLabel}>
            <span className="setup-progress-fill" style={{ transform: `scaleX(${setupProgress / 100})` }} />
          </div>}
          {!started ? setupStep === 'title' ? <form className="setup-slide setup-title" noValidate onSubmit={event => { event.preventDefault(); if (!title.trim()) { showValidation('title', 'session-title', 'Give this session a title.'); return } setValidationError(null); setSetupStep('class-type'); setError('') }}>
          <h2>What will you learn?</h2><p>Every good adventure starts with a name.</p>
          <div className="setup-title-field"><label htmlFor="session-title">Give this session a title</label><input id="session-title" value={title} onChange={event => { setTitle(event.target.value); setValidationError(null) }} maxLength={120} autoFocus placeholder="e.g. Electricity and circuits" aria-invalid={validationError?.fieldId === 'session-title'} className={validationError?.fieldId === 'session-title' ? 'validation-field' : undefined} /></div>
          <div className="setup-actions"><div className="validation-action"><button key={validationError?.step === 'title' ? validationError.attempt : 0} className={`send-button ${validationError?.step === 'title' ? 'validation-shake' : ''}`}>Find my learning style →</button>{validationTooltip('title')}</div></div>{error && <p className="chat-error" role="alert">{error}</p>}
        </form> : setupStep === 'class-type' ? <LearningTypeSelector key={sessionId} value={learningType} onContinue={changeLearningType} /> : setupStep === 'concepts' ? <form className="setup-slide setup-concepts" noValidate onSubmit={event => { event.preventDefault(); void continueToRubric() }}><div className="setup-columns"><div className={`setup-concept-side${concepts.length > 1 ? ' setup-concept-side-removable' : ''}`}><div className="setup-concept-heading"><h3>Concepts</h3><h3>Learning Level</h3></div><div className="concept-list">{concepts.map((concept, index) => <div className="concept-card" key={concept.id}><label className="sr-only" htmlFor={`setup-name-${concept.id}`}>Concept {index + 1} name</label><input id={`setup-name-${concept.id}`} value={concept.name} onChange={event => updateConcept(concept.id, { name: event.target.value })} maxLength={300} placeholder="Concept name" aria-invalid={validationError?.fieldId === `setup-name-${concept.id}`} className={validationError?.fieldId === `setup-name-${concept.id}` ? 'validation-field' : undefined} /><LevelSlider id={`setup-target-${concept.id}`} name={concept.name || `concept ${index + 1}`} value={selectedTargets[concept.id] ?? 'remember'} onChange={level => setSelectedTargets(targets => ({ ...targets, [concept.id]: level }))} />{concepts.length > 1 && <button type="button" className="concept-remove" aria-label={`Remove concept ${index + 1}`} onClick={() => { setValidationError(null); setConcepts(items => items.filter(item => item.id !== concept.id)) }}>×</button>}</div>)}</div>{concepts.length < 20 && <button type="button" className="concept-add" onClick={() => setConcepts(items => [...items, newConcept()])}>＋ Add concept</button>}</div><div className="setup-file-side"><h3>AI Autofill</h3><label className="setup-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)) }}><span>Drop files here or click to upload</span><small>Up to 5 MB total</small><input type="file" multiple onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = '' }} /></label>{files.length > 0 && <><ul className="setup-files">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(items => items.filter((_, i) => i !== index))}>×</button></li>)}</ul></>}</div></div><div className="setup-actions"><div className="setup-actions-right"><RubricAutoGenerateToggle checked={aiByName} regenerate={hasRubric} onChange={setAiByName} instructions={rubricInstructions} onInstructionsChange={setRubricInstructions} /><button type="button" className="setup-secondary setup-autofill" disabled={uploading || !files.length} onClick={() => void suggestConcepts()}>{uploading ? '← Autofilling…' : '← Autofill concepts'}</button><div className="validation-action"><button key={validationError?.step === 'concepts' ? validationError.attempt : 0} className={`send-button ${validationError?.step === 'concepts' ? 'validation-shake' : ''}`} disabled={uploading}>{aiByName ? hasRubric ? 'Re-generate rubric →' : 'Generate rubric →' : 'Continue to rubric →'}</button>{validationTooltip('concepts')}</div></div></div>{error && <p className="chat-error" role="alert">{error}</p>}</form> : setupStep === 'loading' ? <RubricLoading completed={generatedConcepts} total={concepts.length} /> : <form className="chat-setup" noValidate onSubmit={event => { event.preventDefault(); startLearning() }}><div className="rubric-scroll">
          <table className="rubric-grid">
            <colgroup><col style={{ width: '17%' }} />{levels.map(level => <col key={level.id} />)}<col style={{ width: 40 }} /></colgroup>
            <thead><tr>
              <th scope="col"><span className="sr-only">Concept name</span><span className="rubric-intro-help"><button type="button" className="rubric-help-trigger" aria-label="About the rubric" aria-describedby="rubric-intro-tooltip">?</button><span className="rubric-help-tooltip" id="rubric-intro-tooltip" role="tooltip">Add or edit checklist items describing what someone must demonstrate. The AI checks each item during evaluation. Filled higher levels raise the learning target.</span></span></th>
              {levels.map((level, index) => <th scope="col" className={index === levels.length - 1 ? 'rubric-header-last' : undefined} key={level.id}><button type="button" className="rubric-header-trigger" aria-describedby={`rubric-help-${level.id}`}>{level.name}</button><span className="rubric-help-tooltip rubric-header-tooltip" id={`rubric-help-${level.id}`} role="tooltip">{profile.help[level.id]}</span></th>)}
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>{concepts.map((concept, index) => <tr key={concept.id}>
              <th scope="row" className="rubric-concept-cell"><label className="sr-only" htmlFor={`concept-${concept.id}`}>Concept {index + 1} name</label><input id={`concept-${concept.id}`} value={concept.name} onChange={event => updateConcept(concept.id, { name: event.target.value })} placeholder="Concept" maxLength={300} disabled={uploading} aria-invalid={validationError?.fieldId === `concept-${concept.id}`} className={validationError?.fieldId === `concept-${concept.id}` ? 'validation-field' : undefined} /></th>
              {levels.map((level, levelIndex) => { const target = highestFilledLevel(concept.rubric); const required = target !== null && levelIndex <= levels.findIndex(item => item.id === target); return <td key={level.id} className={required ? 'rubric-required-cell' : undefined}><RubricChecklistEditor id={`${concept.id}-${level.id}`} name={`${concept.name || `Concept ${index + 1}`}: ${level.name}`} value={concept.rubric[level.id]} onChange={value => { const next = editCriterion(concept, level.id, value); setValidationError(null); setConcepts(items => items.map(item => item.id === concept.id ? next : item)); setSelectedTargets(targets => ({ ...targets, [concept.id]: highestFilledLevel(next.rubric) })) }} invalid={validationError?.fieldId === `${concept.id}-${level.id}`} disabled={uploading} /></td> })}
              <td className="rubric-actions-cell">{concepts.length > 1 && <button type="button" className="concept-remove" aria-label={`Remove concept ${index + 1}`} onClick={() => { setValidationError(null); setConcepts(items => items.filter(item => item.id !== concept.id)) }}>−</button>}</td>
            </tr>)}</tbody>
          </table>
        </div>{concepts.length < 20 && <button type="button" className="concept-add" onClick={() => setConcepts(items => [...items, newConcept()])}><span aria-hidden="true">＋</span> Add concept</button>}<div className="chat-actions"><div className="validation-action"><button key={validationError?.step === 'rubric' ? validationError.attempt : 0} className={`send-button ${validationError?.step === 'rubric' ? 'validation-shake' : ''}`}>Start session</button>{validationTooltip('rubric')}</div></div>{error && <p className="chat-error" role="alert">{error}</p>}</form> : <><div ref={messageList} className="chat-messages" role="log" aria-label="Conversation" aria-live="polite">{[...session.messages, ...(pendingMessage ? [pendingMessage] : [])].map((message, index) => {
          if (message.passedLevel && currentConcept && targetCount(message.passedLevel) === targetCount(currentConcept.target)) return null
          const reviewedMessage = message.role === 'assistant' ? session.messages[index - 1] : undefined
          const reviewedPaper = reviewedMessage?.review ? session.messages.find(item => item.paper?.id === reviewedMessage.review?.paperId)?.paper : undefined
          const divider = message.passedLevel && <div className="level-divider" role="status"><span>{levels.find(level => level.id === message.passedLevel)?.name} level passed!</span></div>
          return <div key={index}>{divider}<div className={`chat-message ${message.role} ${message.paper ? 'chat-message-with-paper' : ''}`}><div className="chat-message-copy"><span>{message.role === 'user' ? 'You' : 'Feynman'}</span><div className="chat-message-text"><ChatText>{message.content}</ChatText></div>{quantitative && reviewedPaper && reviewedMessage?.review && <ReviewFeedback paper={reviewedPaper} review={reviewedMessage.review} />}{message.boardImage && <img className="chat-board-image" src={message.boardImage} alt="Whiteboard shared with this message" />}</div>{quantitative && message.paper && currentConcept && <><svg className="paper-invite-arrow" viewBox="0 0 120 72" preserveAspectRatio="none" aria-hidden="true"><path d="M3 53 C27 64 42 51 57 36 S88 20 108 32" /><path d="M97 19 Q105 25 109 32 Q100 35 94 43" /></svg><PaperReview key={`${active}-${message.paper.id}`} paper={message.paper} review={session.messages.find(item => item.review?.paperId === message.paper?.id)?.review} busy={busy} error={error} onSubmit={review => send(review)} /></>}</div></div>
        })}{done && currentConcept && <div className="level-divider level-divider-final" role="status"><span>{levels[currentConcept.passed - 1]?.name} level passed!</span>{currentConcept.passed < levels.length && <button type="button" className="level-divider-continue" disabled={busy} onClick={() => void raiseTarget(currentConcept, levels[currentConcept.passed].id)}>{busy ? 'Starting…' : 'Continue'}</button>}{sessionComplete(concepts) && currentConcept.passed < levels.length && <button type="button" className="level-divider-summary" onClick={() => navigate(`/summary?session=${encodeURIComponent(sessionId)}`)}>View session summary →</button>}</div>}{busy && <p className="chat-thinking">Thinking…</p>}</div>{done ? null : quantitative && currentConcept?.finalSummary && currentConcept.passed < 4 ? <div className="chat-complete" role="status"><strong>Analyze needs more evidence</strong><div className="learning-report"><p>{currentConcept.finalSummary}</p><strong>Analysis grade: {currentConcept.analysisGrade}%</strong></div><button type="button" className="send-button" disabled={busy} onClick={() => void retryAnalyze(currentConcept)}>{busy ? 'Starting…' : 'Try another paper set'}</button></div> : quantitative && currentConcept && levels[currentConcept.passed]?.id === 'analyze' && paper && !review ? <div className="chat-awaiting-grade">Sort all my papers to continue the conversation.</div> : <ChatComposer key={active} className="chat-composer" value={session.draft} onChange={draft => updateSession({ draft })} onSend={() => { void send() }} busy={busy} />}</>}{error && <p className="chat-error" role="alert">{error}</p>}</div></section></>}
    {!started && setupStep === 'class-type' && pendingLearningType && <LearningTypeChangeDialog learningType={pendingLearningType} onConfirm={confirmLearningTypeChange} onCancel={() => setPendingLearningType(null)} />}
  </main>
}
export default App
