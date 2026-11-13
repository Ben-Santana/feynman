import { useToast } from './components/useToast'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useConfirm } from './components/useConfirm'
import { rubricSkipReason } from './rubricFallback.js'
import { ChatComposer } from './components/ChatComposer'
import { MessageQueue } from './components/MessageQueue'
import { moveQueued, queuedMessage, recoverSend } from './messageQueue'
import { LearningActions, SkipRubricButton } from './components/LearningActions'
import { learningActionMessage, type LearningAction } from './learningActions'
import { ChatActionItems, ChatActions, type ChatActionProps } from './components/ChatActions'
import { TooltipButton } from './components/TooltipButton'
import { ConceptTooltip } from './components/ConceptTooltip'
import { ChatMessage, ThoughtCloud } from './components/ChatMessage'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BackButton } from './components/BackButton'
import { COMMUNITY_LIBRARY_ENABLED } from './features'
import { DeveloperPage } from './components/DeveloperPage'
import { LoadingAnimation, LoadingScreen } from './components/AccountLoading'
import { SettingsPage } from './components/SettingsPage'
import { aiHeaders, fruitFlySelected, localAIResponse } from './aiPreferences'
import { fruitFlyBuzz, fruitFlyRubric } from './fruitFly'
import { CharacterStudio } from './components/CharacterStudio'
import { defaultAppearance, type CharacterAppearance } from './characterAppearance'
import { loadCloudAppearance, saveCloudAppearance } from './cloudAppearance'
import { accountFetch, accountSignal, type Account, type AccountSignInMethod } from './accounts'
import { AdminAIModelPage } from './components/AdminAIModelPage'
import { AdminAnalyticsPage } from './components/AdminAnalyticsPage'
import { isAnalyticsPath } from './research'
import { useActivityTracking } from './useActivityTracking'
import { LearningSurveyDialog } from './components/LearningSurveyDialog'
import { useLearningSurvey } from './useLearningSurvey'
import { AdminPage } from './components/AdminPage'
import { AdminCoursesPage } from './components/AdminCoursesPage'
import { canTeachCourses } from './coursePermissions'
import { Bloub } from './components/Bloub'
import { DashboardShell } from './components/DashboardShell'
import { DashboardPage } from './components/DashboardPage'
import { SetupTitleForm } from './components/SetupTitleForm'
import { CourseCreatePage } from './components/CourseCreatePage'
import { CoursesPage } from './components/CoursesPage'
import { loadModuleDraft, saveModule, publishModule, restartModule, type ModuleSession } from './courseStore'
import { loadTopicReport } from './topicReports'
import { SessionsPage } from './components/SessionsPage'
import { PaperReview, type Review } from './components/PaperReview'
import { ReviewFeedback } from './components/ReviewFeedback'
import { AutosizeTextarea, RubricChecklistEditor } from './components/RubricChecklistEditor'
import { checklistItems } from './rubricChecklist.js'
import { RubricAutoGenerateToggle } from './components/RubricAutoGenerateToggle'
import { SummaryUnavailable } from './components/SessionSummary'
import { TopicReport } from './components/TopicReport'
import { Whiteboard, type WhiteboardHandle } from './components/Whiteboard'
import { saveModuleRecovery, loadModuleRecovery, subscribeSaveStatus, getSaveStatus, resolveSessionConflict, loadSessions, queueSessionSave, flushSessionSaves, type SavedSession } from './learningStore'
import { advanceConcept, assessmentTranscript, conceptFinished, levelIds, restoreLearning, sessionComplete, startConcepts, targetCount, type ChatResult, type Concept, type ConceptRubric, type Level, type Message, type Session } from './learningFlow'
import { learningReward, playLearningReward, prepareLearningSounds } from './learningSounds'
import { draftTarget, editCriterion, fillMissingRubric, genericRubric, highestFilledLevel, mergeSuggestions, restoreDraft } from './rubricSetup'
import { generateRubricBatches } from './rubricGeneration'

import { LearningTypeSelector } from './components/LearningTypeSelector'
import { preloadClassModelPreview } from './components/learning-type/classModelLoader'
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
  signal = AbortSignal.any([signal, accountSignal()])
  signal.throwIfAborted()
  const local = body && typeof body === 'object' && ('assignmentSessionId' in body || 'sessionId' in body) ? undefined : localAIResponse(path, body)
  if (local !== undefined) return local as T
  const response = await accountFetch(path, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...aiHeaders() }, body: JSON.stringify(body) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'The request failed. Please retry.')
  return data as T
}

// Whiteboard images and web fonts grow the list after mount. Follow that growth
// unless the student has scrolled up.
function stickToBottom(list: HTMLElement) {
  let atBottom = true
  const follow = () => { if (atBottom) list.scrollTop = list.scrollHeight }
  const track = () => { atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 2 }
  follow()
  void document.fonts.ready.then(follow)
  list.addEventListener('load', follow, true)
  list.addEventListener('scroll', track, { passive: true })
  return () => { list.removeEventListener('load', follow, true); list.removeEventListener('scroll', track) }
}

function currentPage() {
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const page = path === '/courses/starred' ? '/courses/community' : path
  if (COMMUNITY_LIBRARY_ENABLED || page !== '/courses/community') return page
  window.history.replaceState(null, '', '/courses')
  return '/courses'
}

export default function App({ account, onProfileUpdated, authMode }: { account: Account; onProfileUpdated: (account: Account) => void; authMode: AccountSignInMethod }) {
  const [page, setPage] = useState(currentPage)
  const [adminTargetId, setAdminTargetId] = useState(() => new URLSearchParams(window.location.search).get('account'))
  const [appearance, setAppearance] = useState(defaultAppearance)
  const [appearanceSaveStatus, setAppearanceSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [appearanceSaveError, setAppearanceSaveError] = useState('')
  const appearanceSaveVersion = useRef(0)
  const commitAppearance = useCallback((draft: CharacterAppearance) => {
    const version = ++appearanceSaveVersion.current
    const signal = accountSignal()
    setAppearance(draft)
    setAppearanceSaveStatus('saving')
    setAppearanceSaveError('')
    void saveCloudAppearance(draft).then(() => {
      if (version === appearanceSaveVersion.current && !signal.aborted) setAppearanceSaveStatus('saved')
    }).catch(reason => {
      if (version !== appearanceSaveVersion.current || signal.aborted) return
      setAppearanceSaveStatus('error')
      setAppearanceSaveError(reason instanceof Error ? reason.message : 'Could not save customization. Please retry.')
    })
  }, [])
  const developerDirty = useRef(false)
  const onDeveloperDirtyChange = useCallback((dirty: boolean) => { developerDirty.current = dirty }, [])
  const isDeveloperPage = page === '/developer'
  const adminCourseMatch = /^\/admin\/(?:all-)?courses(?:\/([^/]+))?$/.exec(page)
  const isAdminCoursesPage = Boolean(adminCourseMatch)
  const isAdminAIModelPage = page === '/admin/ai-model'
  const isAnalyticsPage = isAnalyticsPath(page)
  const moduleMatch = /^\/courses\/([^/]+)\/modules\/([^/]+)\/edit$/.exec(page)
  const moduleCourseId = moduleMatch?.[1]
  const moduleId = moduleMatch?.[2]
  const isModuleEditor = Boolean(moduleMatch)
  const isCourseCreatePage = page === '/courses/new'
  const isCoursesPage = !isCourseCreatePage && !isModuleEditor && (page === '/courses' || /^\/courses\/[^/]+$/.test(page))
  const [moduleLoadVersion, setModuleLoadVersion] = useState(0)
  const [moduleRevision, setModuleRevision] = useState(0)
  const [moduleReady, setModuleReady] = useState(false)
  const [moduleSaving, setModuleSaving] = useState(false)
  const [moduleNotice, setModuleNotice] = useState('')
  const moduleSavedSignature = useRef('')
  const moduleDirty = useRef(false)
  const moduleSessionId = useRef('')
  const moduleRecoveryQueue = useRef(Promise.resolve())
  const saveStatus = useSyncExternalStore(subscribeSaveStatus, getSaveStatus)
  const [resolvingSave, setResolvingSave] = useState(false)
  const [resolveSaveError, setResolveSaveError] = useState('')
  const [restartingSession, setRestartingSession] = useState(false)
  const confirm = useConfirm()
  const navigate = useCallback((path: string, replace = false) => {
    const go = () => {
      void flushSessionSaves().catch(() => {})
      window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
      setPage(path.split('?')[0]); window.dispatchEvent(new PopStateEvent('popstate'))
    }
    if (isModuleEditor && path.split('?')[0] !== page && moduleDirty.current) void confirm({ title: 'Leave the topic editor?', description: 'Unsaved changes will be kept on this device.', confirmLabel: 'Hold to leave' }).then(confirmed => { if (confirmed) go() })
    else go()
  }, [confirm, isModuleEditor, page])
  const isChatPage = page === '/chat'
  const isSessionsPage = page === '/sessions'
  const isSummaryPage = page === '/summary'
  const isDashboardPage = !isAnalyticsPage && !isAdminAIModelPage && !isAdminCoursesPage && !isCourseCreatePage && !isCoursesPage && !isModuleEditor && !isChatPage && !isSessionsPage && !isSummaryPage && !['/profile', '/settings', '/character', '/admin', '/inbox', '/developer'].includes(page)
  const [sessionId, setSessionId] = useState('')
  const [title, setTitle] = useState('')
  const [learningType, setLearningType] = useState<LearningType | null>(null)
  const [pendingLearningType, setPendingLearningType] = useState<LearningType | null>(null)
  const profile = learningTypes[learningType ?? 'quantitative']
  const quantitative = learningType === 'quantitative'
  const [setupStep, setSetupStep] = useState<'title' | 'class-type' | 'concepts' | 'loading' | 'rubric'>('title')
  const setupProgress = { title: 25, 'class-type': 50, concepts: 75, loading: 75, rubric: 100 }[setupStep]
  const setupProgressLabel = { title: 'Name your session', 'class-type': 'Choose your class type', concepts: 'Add concepts', loading: 'Creating your rubric', rubric: 'Review your rubric' }[setupStep]
  const [files, setFiles] = useState<File[]>([])
  const [selectedTargets, setSelectedTargets] = useState<Record<string, Level | null>>({})
  const [aiByName, setAiByName] = useState(true)
  const [rubricInstructions, setRubricInstructions] = useState('')
  const [savedSessions, setSavedSessions] = useState<SavedSession<Concept, Session>[]>([])
  useActivityTracking(account, page, sessionId)
  const survey = useLearningSurvey(account, `${page}:${saveStatus.state}:${savedSessions.filter(record => record.started && sessionComplete(record.concepts)).map(record => record.id).join(',')}`)
  const sessionsRef = useRef<SavedSession<Concept, Session>[]>([])
  const assignment = isModuleEditor ? undefined : savedSessions.find(record => record.id === sessionId)?.assignment
  const sessionBackPath = assignment ? `/courses/${assignment.courseId}` : '/sessions'
  const [concepts, setConcepts] = useState<Concept[]>([newConcept()])
  const latestConcepts = useRef(concepts)
  useEffect(() => { latestConcepts.current = concepts }, [concepts])
  const hasRubric = concepts.some(concept => levels.some(level => checklistItems(concept.rubric[level.id]).length > 0))
  const [active, setActive] = useState<string>('')
  const [started, setStarted] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [boardHovered, setBoardHovered] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  // Each concept owns its turn, so learners can work elsewhere while one loads.
  const [conceptTurns, setConceptTurns] = useState<Record<string, Message | null>>({})
  const busy = active in conceptTurns
  const sessionBusy = Object.keys(conceptTurns).length > 0
  const pendingMessage = conceptTurns[active] ?? null
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()
  const reportError = useCallback((reason: unknown, conceptName?: string) => {
    console.error('Feynman request failed', reason)
    toast(conceptName ? `${conceptName}: something went wrong try again` : 'something went wrong try again')
  }, [toast])
  const [validationError, setValidationError] = useState<{ step: 'title' | 'concepts' | 'rubric'; fieldId: string; message: string; attempt: number } | null>(null)
  const [trackerOverflow, setTrackerOverflow] = useState(false)
  const [conceptTooltip, setConceptTooltip] = useState<{ name: string; left: number; top: number; bottom: number } | null>(null)
  const messageList = useRef<HTMLDivElement>(null)
  const attachMessageList = useCallback((element: HTMLDivElement) => {
    messageList.current = element
    const release = stickToBottom(element)
    return () => { messageList.current = null; release() }
  }, [])
  const avatarCharacter = useRef<HTMLDivElement>(null)
  const [arrivingReplies, setArrivingReplies] = useState<Record<string, { index: number; content: string }>>({})
  const arrivingReply = arrivingReplies[active]
  const finishReplyArrival = useCallback(() => setArrivingReplies(({ [active]: _arrived, ...replies }) => replies), [active])
  const tracker = useRef<HTMLDivElement>(null)
  const whiteboard = useRef<WhiteboardHandle>(null)
  const requestLocks = useRef(new Set<string>())
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const currentConcept = concepts.find(concept => concept.id === active)
  const session: Session = currentConcept || { messages: [], draft: '', assessment: null }
  const done = Boolean(currentConcept && conceptFinished(currentConcept))
  const paper = session.messages.findLast(message => message.paper)?.paper
  const review = paper ? session.messages.findLast(message => message.review?.paperId === paper.id)?.review : undefined
  const [revisingPaper, setRevisingPaper] = useState<string | null>(null)
  const queue = session.queue ?? []
  const [editingQueued, setEditingQueued] = useState<{ conceptId: string; id: string } | null>(null)
  const editingQueuedId = editingQueued?.conceptId === active ? editingQueued.id : null
  const [draggingQueued, setDraggingQueued] = useState(false)
  const awaitingGrades = Boolean(quantitative && currentConcept && levels[currentConcept.passed]?.id === 'analyze' && paper && !review)
  const chatActionProps: ChatActionProps = {
    boardOpen,
    onToggleBoard: () => setBoardOpen(open => !open),
    topicComplete: sessionComplete(concepts),
    reportDisabled: sessionBusy,
    onFinishTopic: () => navigate(`/summary?session=${encodeURIComponent(sessionId)}`),
    assigned: Boolean(assignment),
    restartDisabled: sessionBusy || saveStatus.state === 'conflict',
    onRestart: () => void restartSession().catch(reason => reportError(reason)),
  }
  const nextQueued = !busy && !done && !awaitingGrades && !arrivingReply && !session.queuePaused && !editingQueuedId && !draggingQueued ? queue[0] : undefined

  useEffect(() => {
    if (isChatPage && !started && setupStep === 'title') void preloadClassModelPreview().catch(() => {})
  }, [isChatPage, started, setupStep])

  useEffect(() => {
    if (!conceptTooltip) return
    const dismiss = () => setConceptTooltip(null)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [conceptTooltip])

  function showConceptTooltip(button: HTMLButtonElement, name: string) {
    const bounds = button.getBoundingClientRect()
    setConceptTooltip({ name, left: bounds.left + bounds.width / 2, top: bounds.bottom + 8, bottom: bounds.top })
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
    let disposed = false
    queueMicrotask(() => { if (!disposed) { setHydrated(false); setLoadFailed(false) } })
    Promise.all([loadSessions<Concept, Session>(), loadCloudAppearance()]).then(([records, look]) => {
      if (disposed) return
      setAppearance(look.appearance)
      if (look.pending) commitAppearance(look.appearance)
      sessionsRef.current = records
      setSavedSessions(records)
      const requested = new URLSearchParams(window.location.search).get('session')
      const selected = records.find(record => record.id === requested) || records[0]
      if (selected && !/^\/courses\/[^/]+\/modules\//.test(window.location.pathname)) {
        const restored = restoreLearning(selected)
        if (restored) { const draft = restoreDraft(selected); setConcepts(restored.concepts); setStarted(restored.started); setActive(restored.activeId || ''); setSessionId(selected.id); setTitle(draft.title); setSetupStep(draft.step); setFiles(draft.files); setSelectedTargets(draft.selectedTargets); setAiByName(draft.aiByName); setRubricInstructions(draft.rubricInstructions); setLearningType(draft.learningType); setPendingLearningType(null) }
      } else if (window.location.pathname.replace(/\/$/, '') === '/chat') setSessionId(crypto.randomUUID())
      setHydrated(true)
    }).catch(reason => { if (!disposed) { reportError(reason); setLoadFailed(true) } })
    return () => { disposed = true }
  }, [loadVersion, commitAppearance, reportError])
  useEffect(() => {
    if (isModuleEditor || sessionId === moduleSessionId.current || !hydrated || !sessionId || (!title.trim() && !learningType)) return
    const record: SavedSession<Concept, Session> = { ...(assignment ? { assignment } : {}), id: sessionId, title: title.trim(), updatedAt: Date.now(), reportFinishedAt: sessionsRef.current.find(item => item.id === sessionId)?.reportFinishedAt || (isSummaryPage && started ? Date.now() : undefined), started, concepts, activeId: active || null, setupStep: setupStep === 'loading' ? 'concepts' : setupStep, files: started ? [] : files, selectedTargets, aiByName, rubricInstructions, learningType }
    const signature = (value: unknown) => JSON.stringify(value, (key, value) => key === 'updatedAt' ? undefined : value instanceof File ? { name: value.name, size: value.size, type: value.type, lastModified: value.lastModified } : value)
    if (signature(record) === signature(sessionsRef.current.find(item => item.id === sessionId))) return
    const previous = sessionsRef.current.find(item => item.id === record.id)
    const next = [record, ...sessionsRef.current.filter(item => item.id !== sessionId)]
    sessionsRef.current = next
    setSavedSessions(next)
    const committed = record.started !== previous?.started || record.concepts.some((concept, index) => concept.messages.length !== previous?.concepts[index]?.messages.length)
    queueSessionSave(record, committed)
  }, [concepts, active, started, sessionId, hydrated, title, setupStep, files, selectedTargets, aiByName, rubricInstructions, learningType, sessionBusy, isModuleEditor, assignment, isSummaryPage])
  useEffect(() => {
    if (!moduleId || !moduleCourseId) return
    let disposed = false
    queueMicrotask(() => { if (!disposed) { setModuleReady(false); setError(''); setModuleNotice('') } })
    const signal = accountSignal()
    const fresh = new URLSearchParams(window.location.search).get('new') === '1'
    const empty: ModuleSession = { id: moduleId, title: '', concepts: [newConcept()], started: false, activeId: null, updatedAt: Date.now(), learningType: null, setupStep: 'title', files: [], selectedTargets: {} }
    void (async () => {
      if (!canTeachCourses(account.role)) throw new Error('Instructor access required.')
      const saved = fresh ? { record: empty, revision: 0 } : await loadModuleDraft(moduleCourseId, moduleId)
      signal.throwIfAborted()
      const recovery = await loadModuleRecovery<{ record: ModuleSession; revision: number } | null>(moduleId)
      if (disposed) return
      const record = recovery?.record ?? saved.record
      const draft = restoreDraft(record)
      moduleSessionId.current = moduleId!
      setSessionId(moduleId!); setTitle(draft.title); setConcepts(record.concepts); setStarted(false); setActive(''); setLearningType(draft.learningType); setSetupStep(draft.step); setFiles(draft.files); setSelectedTargets(draft.selectedTargets); setAiByName(draft.aiByName); setRubricInstructions(draft.rubricInstructions)
      setModuleRevision(recovery?.revision ?? saved.revision)
      moduleSavedSignature.current = JSON.stringify({ id: moduleId, title: draft.title.trim(), concepts: saved.record.concepts, started: false, activeId: null, updatedAt: 0, learningType: draft.learningType, setupStep: draft.step, files: draft.files, selectedTargets: draft.selectedTargets, aiByName: draft.aiByName, rubricInstructions: draft.rubricInstructions })
      moduleDirty.current = Boolean(recovery)
      if (recovery) setModuleNotice('Unsaved topic changes restored. Save the draft to keep them.')
      setModuleReady(true)
    })().catch(reason => { if (!disposed) reportError(reason) })
    return () => { disposed = true; moduleDirty.current = false }
  }, [moduleId, moduleCourseId, account.role, moduleLoadVersion, reportError])
  const moduleRecord = useCallback((): ModuleSession => {
    return { id: moduleId!, title: title.trim(), concepts, started: false, activeId: null, updatedAt: 0, learningType, setupStep: setupStep === 'loading' ? 'concepts' : setupStep, files, selectedTargets, aiByName, rubricInstructions }
  }, [moduleId, title, concepts, learningType, setupStep, files, selectedTargets, aiByName, rubricInstructions])
  useEffect(() => {
    if (!isModuleEditor || !moduleReady || sessionId !== moduleId) return
    const record = moduleRecord()
    moduleDirty.current = JSON.stringify(record) !== moduleSavedSignature.current
    if (!moduleDirty.current) return
    const id = moduleId!
    const draft = { record, revision: moduleRevision }
    const signal = accountSignal()
    moduleRecoveryQueue.current = moduleRecoveryQueue.current.catch(() => {}).then(() => { signal.throwIfAborted(); return saveModuleRecovery(id, draft) })
    void moduleRecoveryQueue.current.catch(() => setModuleNotice('Browser recovery is unavailable. Save the topic before leaving.'))
  }, [isModuleEditor, moduleReady, moduleId, moduleRevision, sessionId, title, concepts, learningType, setupStep, files, selectedTargets, aiByName, rubricInstructions, moduleRecord])
  useEffect(() => {
    if (!isModuleEditor) return
    const warn = (event: BeforeUnloadEvent) => { if (moduleDirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isModuleEditor])
  async function reloadModule() {
    if (!moduleId || moduleSaving || !await confirm({ title: 'Reload the saved topic?', description: 'This device’s changes will be discarded.', confirmLabel: 'Hold to reload' })) return
    const signal = accountSignal()
    await moduleRecoveryQueue.current.catch(() => {})
    signal.throwIfAborted()
    await saveModuleRecovery(moduleId, null)
    moduleDirty.current = false
    setModuleLoadVersion(value => value + 1)
  }
  async function resolveSave(keepCopy: boolean) {
    if (!saveStatus.sessionId || resolvingSave) return
    setResolvingSave(true); setResolveSaveError('')
    try {
      setHydrated(false)
      await resolveSessionConflict(saveStatus.sessionId, keepCopy)
      setLoadVersion(value => value + 1)
    } catch (reason) { setResolveSaveError(reason instanceof Error ? reason.message : 'Could not resolve this conflict. Please retry.'); setHydrated(true) }
    finally { setResolvingSave(false) }
  }
  async function commitModule(publish = false) {
    if (!moduleCourseId || !moduleId || moduleSaving || !moduleReady) return
    const signal = accountSignal()
    setModuleSaving(true); setError(''); setModuleNotice('')
    try {
      const record = moduleRecord()
      const saved = await saveModule(moduleCourseId, record, moduleRevision)
      setModuleRevision(saved.revision)
      moduleSavedSignature.current = JSON.stringify(record)
      moduleDirty.current = false
      await moduleRecoveryQueue.current.catch(() => {})
      signal.throwIfAborted()
      await saveModuleRecovery(moduleId, null).catch(() => setModuleNotice('Draft saved. Browser recovery could not be cleared.'))
      if (new URLSearchParams(window.location.search).has('new')) window.history.replaceState(null, '', page)
      if (publish) {
        await publishModule(moduleId, saved.revision)
        signal.throwIfAborted()
        setSessionId('')
        navigate(`/courses/${moduleCourseId}`)
      } else setModuleNotice('Draft saved.')
    } catch (reason) { if (!signal.aborted) reportError(reason) }
    finally { if (!signal.aborted) setModuleSaving(false) }
  }
  useEffect(() => {
    if (hydrated && isChatPage && started && (sessionComplete(concepts) || savedSessions.find(record => record.id === sessionId)?.reportFinishedAt)) navigate(`/summary?session=${encodeURIComponent(sessionId)}`, true)
  }, [hydrated, isChatPage, started, concepts, currentConcept, sessionId, navigate, savedSessions])
  useEffect(() => {
    const onPopState = () => {
      setPage(currentPage())
      const params = new URLSearchParams(window.location.search)
      setAdminTargetId(params.get('account'))
      const requested = params.get('session')
      const record = sessionsRef.current.find(item => item.id === requested)
      if (record && record.id !== sessionId) {
        const restored = restoreLearning(record)
        if (restored) { const draft = restoreDraft(record); setConcepts(restored.concepts); setStarted(restored.started); setActive(restored.activeId || ''); setSessionId(record.id); setTitle(draft.title); setSetupStep(draft.step); setFiles(draft.files); setSelectedTargets(draft.selectedTargets); setAiByName(draft.aiByName); setRubricInstructions(draft.rubricInstructions); setLearningType(draft.learningType); setPendingLearningType(null) }
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [sessionId])
  async function navigateFromSidebar(path: string) {
    if (isDeveloperPage && path !== '/developer' && developerDirty.current && !await confirm({ title: 'Leave developer tools?', description: 'Unsaved prompt edits will be discarded.', confirmLabel: 'Hold to leave' })) return
    navigate(path)
  }
  async function openSession(record: SavedSession<Concept, Session>) {
    if (sessionBusy) return
    if (!(record.started && sessionComplete(record.concepts)) && !await survey.guard()) return
    showSession(record)
  }
  function showSession(record: SavedSession<Concept, Session>) {
    const restored = restoreLearning(record)
    if (!restored) return
    const draft = restoreDraft(record)
    setConcepts(restored.concepts); setStarted(restored.started); setActive(restored.activeId || ''); setSessionId(record.id); setTitle(draft.title); setSetupStep(draft.step); setFiles(draft.files); setSelectedTargets(draft.selectedTargets); setAiByName(draft.aiByName); setRubricInstructions(draft.rubricInstructions); setLearningType(draft.learningType); setPendingLearningType(null); setError('')
    navigate(`/${record.started && (record.reportFinishedAt || sessionComplete(restored.concepts)) ? 'summary' : 'chat'}?session=${encodeURIComponent(record.id)}`)
  }
  async function restartAssignedSession(previous: SavedSession<Concept, Session>, moduleId: string) {
    // The server only restarts an attempt that has a saved report, so a chat in progress is finished first.
    if (isChatPage) {
      await flushSessionSaves()
      await loadTopicReport(previous.id, accountSignal(), 'early')
    }
    try {
      if (isChatPage) {
        const finished = { ...previous, reportFinishedAt: Date.now() }
        sessionsRef.current = sessionsRef.current.map(item => item.id === finished.id ? finished : item)
        queueSessionSave(finished, true)
        await flushSessionSaves()
      }
      const record = await restartModule(moduleId, previous.id)
      const local = sessionsRef.current.find(item => item.id === record.id)
      const next = local && local.updatedAt >= record.updatedAt ? local : record
      sessionsRef.current = [next, ...sessionsRef.current.filter(item => item.id !== next.id)]
      setSavedSessions(sessionsRef.current)
      showSession(next)
    } catch (reason) {
      // The attempt is already finished, so publish that and let the report page offer the retry.
      setSavedSessions(sessionsRef.current)
      throw reason
    }
  }
  async function restartSession() {
    if (sessionBusy || restartingSession || !await survey.guard()) return
    const previous = sessionsRef.current.find(record => record.id === sessionId)
    if (!previous) throw new Error('Could not find this session.')
    setRestartingSession(true)
    try {
      if (previous.assignment) await restartAssignedSession(previous, previous.assignment.moduleId)
      else {
        const freshConcepts = startConcepts(previous.concepts.map(({ id, name, target, rubric }) => ({ ...newConcept(), id, name, target, rubric })))
        const record = { ...previous, id: crypto.randomUUID(), reportFinishedAt: undefined, concepts: freshConcepts, activeId: freshConcepts[0]?.id ?? null }
        showSession(record)
      }
    } finally { setRestartingSession(false) }
  }
  async function createSession() {
    if (sessionBusy || !await survey.guard()) return
    const id = crypto.randomUUID()
    setConcepts([newConcept()]); setActive(''); setStarted(false); setSessionId(id); setTitle(''); setSetupStep('title'); setFiles([]); setSelectedTargets({}); setAiByName(true); setRubricInstructions(''); setLearningType(null); setPendingLearningType(null); setValidationError(null); setError('')
    navigate(`/chat?session=${encodeURIComponent(id)}`)
  }
  useEffect(() => { if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight }, [active, session.messages.length, pendingMessage, busy])
  useEffect(() => {
    const element = tracker.current
    if (!element) return
    const update = () => {
      const vertical = window.matchMedia('(max-width: 700px)').matches
      const overflows = vertical ? element.scrollHeight > element.clientHeight + 1 : element.scrollWidth > element.clientWidth + 1
      setTrackerOverflow(overflows)
      if (!vertical && overflows && element.scrollLeft === 0) element.scrollLeft = element.scrollWidth
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => observer.disconnect()
  }, [started, concepts.length])

  // Queues drain only in the open chat, whose whiteboard goes out with the turn.
  useEffect(() => {
    if (!nextQueued) return
    updateSession({ queue: queue.slice(1) })
    void send(undefined, undefined, nextQueued.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextQueued?.id])

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
    setError(''); setActive(id)
  }
  function startTurn(conceptId: string, message: Message | null = null) { setConceptTurns(turns => ({ ...turns, [conceptId]: message })) }
  function endTurn(conceptId: string) { setConceptTurns(({ [conceptId]: _ended, ...turns }) => turns) }
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
    if (isModuleEditor) { void commitModule(true); return }
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
      const result = await post<{ concepts: { name: string; target: Level }[] }>('/api/concept-suggestions', { files: await encodedFiles(), learningType }, AbortSignal.timeout(225000))
      const suggestedLevels = new Map(result.concepts.map(({ name, target }) => [name.trim(), target]))
      const newTargets: Record<string, Level> = {}
      const next = mergeSuggestions(latestConcepts.current, [...suggestedLevels.keys()], name => {
        const concept = newConcept(name)
        const target = suggestedLevels.get(name)
        newTargets[concept.id] = target && levelIds.includes(target) ? target : 'remember'
        return concept
      })
      setConcepts(next)
      setSelectedTargets(targets => Object.fromEntries(next.map(concept => [concept.id, targets[concept.id] ?? newTargets[concept.id] ?? null])))
    } catch (reason) { reportError(reason) }
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
    setSetupStep('loading')
    try {
      const sourceFiles = await encodedFiles()
      const result = await generateRubricBatches(
        concepts.map(concept => ({ name: concept.name.trim(), target: draftTarget(concept, selectedTargets[concept.id]) })),
        (batch, previousRubric) => post<{ concepts: { name: string; rubric: ConceptRubric }[] }>('/api/rubric', { concepts: batch, previousRubric, files: sourceFiles, learningType, additionalInstructions: rubricInstructions.trim() }, AbortSignal.timeout(225000)),
      )
      setConcepts(items => items.map((concept, index) => ({ ...concept, rubric: result[index].rubric, target: highestFilledLevel(result[index].rubric) ?? concept.target })))
      setAiByName(false)
      setSetupStep('rubric')
    } catch (reason) { showValidation('concepts', '', reason instanceof Error ? reason.message : 'Could not generate the rubric.'); setSetupStep('concepts') }
  }

  async function levelOpening(concept: Concept, level: Level, signal: AbortSignal, priorMessages: Message[] = concept.messages, practiceGoal?: string): Promise<ChatResult> {
    if (fruitFlySelected() && !assignment) return post<ChatResult>('/api/chat', {}, signal)
    if (!learningType) throw new Error('Choose a learning type before starting.')
    return post<ChatResult>('/api/chat', { ...(assignment ? { assignmentSessionId: sessionId, assignmentConceptId: concept.id } : {}), ...(practiceGoal ? { practiceGoal } : {}), level, learningType, topic: concept.name, aspects: checklistItems(concept.rubric[level]), criterion: concept.rubric[level], messages: [], priorMessages: priorMessages.slice(-100) }, signal)
  }
  async function raiseTarget(concept: Concept, target: Level) {
    if (assignment || busy || targetCount(target) <= targetCount(concept.target)) return
    startTurn(concept.id); setError('')
    try {
      const [generated] = await generateRubricBatches(
        [{ name: concept.name, target }],
        batch => post<{ concepts: { name: string; rubric: ConceptRubric }[] }>('/api/rubric', {
          concepts: batch,
          previousRubric: [{ name: concept.name, rubric: concept.rubric }],
          learningType,
          additionalInstructions: [rubricInstructions.trim(), `Create topic-specific checklist items for the ${target} level of ${concept.name}, building on the existing rubric. Only the ${target} level will be added to the session.`].filter(Boolean).join('\n'),
        }, AbortSignal.timeout(225000)),
      )
      const nextConcept = { ...concept, rubric: { ...concept.rubric, [target]: generated.rubric[target] } }
      const level = levels[concept.passed].id
      const controller = new AbortController()
      const response = await levelOpening(nextConcept, level, controller.signal)
      const message: Message = { role: 'assistant', content: response.message, passedLevel: levels[concept.passed - 1].id, ...('paper' in response && response.paper ? { paper: response.paper } : {}) }
      setArrivingReplies(replies => ({ ...replies, [concept.id]: { index: concept.messages.length, content: message.content } }))
      updateConcept(concept.id, { target, rubric: nextConcept.rubric, messages: [...concept.messages, message], stageStart: concept.messages.length, assessment: null, expression: response.expression })
    } catch (reason) { reportError(reason, concepts.length > 1 ? concept.name : undefined) }
    finally { endTurn(concept.id) }
  }
  function submitDraft() {
    const text = session.draft.trim()
    if (!text) return
    if (busy || queue.length) { updateSession({ draft: '', queue: [...queue, queuedMessage(text)], queuePaused: false }); return }
    updateSession({ draft: '' })
    void send(undefined, undefined, text)
  }
  async function send(submittedReview?: Review, action?: LearningAction, text?: string): Promise<boolean> {
    const conceptId = active
    if (requestLocks.current.has(conceptId) || done || (submittedReview && !quantitative) || (!submittedReview && !action && !text)) return false
    requestLocks.current.add(conceptId); startTurn(conceptId); setError('')
    if (text) updateConcept(conceptId, { sending: text })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 195000)
    // The board remounts per concept, so keep the handle this turn was drawn on.
    const boardHandle = whiteboard.current
    const board = boardHandle?.snapshot()
    const userMessage: Message = { role: 'user', content: submittedReview ? submittedReview.grades ? `I graded your papers: ${submittedReview.grades.map((grade, index) => `paper ${index + 1} ${grade.grade === 'pass' ? 'Pass' : 'Fail'}${grade.selectedSteps.length ? ` (marked ${grade.selectedSteps.map(step => `step ${step}`).join(', ')})` : ''}`).join('; ')}.` : `I grade your paper ${submittedReview.grade === 'pass' ? 'Pass' : 'Fail'}.${submittedReview.selectedSteps?.length ? ` I marked ${submittedReview.selectedSteps.map(step => `step ${step}`).join(', ')} as incorrect.` : ''}` : text ?? '', ...(submittedReview ? { review: submittedReview } : {}), ...(board ? { boardImage: board.image } : {}) }
    if (action === 'finish') Object.assign(userMessage, learningActionMessage())
    if (action === 'skip') {
      const aspect = session.messages.at(-1)?.rubricFocus
      if (!aspect || !rubricSkipReason(session.messages.slice(currentConcept?.stageStart ?? 0), aspect)) { clearTimeout(timeout); requestLocks.current.delete(conceptId); endTurn(conceptId); return false }
      Object.assign(userMessage, { content: `Skip this rubric item: ${aspect}`, skipRubricItem: aspect })
    }
    const messages = [...session.messages, userMessage]
    prepareLearningSounds()
    startTurn(conceptId, userMessage)
    // Keep the message recoverable until the full turn succeeds.
    try {
      if (!currentConcept) throw new Error('Select a concept chat to continue.')
      const level = levels[currentConcept.passed].id
      if (!learningType) throw new Error('Choose a learning type before starting.')
      const stageMessages = assessmentTranscript(currentConcept, userMessage, learningType)
      await flushSessionSaves()
      const result = await post<ChatResult>('/api/chat', { ...(assignment ? { assignmentSessionId: sessionId, assignmentConceptId: currentConcept.id } : { sessionId, conceptId: currentConcept.id }), level, learningType, topic: currentConcept.name, aspects: checklistItems(currentConcept.rubric[level]), criterion: currentConcept.rubric[level], messages: stageMessages }, controller.signal)
      let nextOpening: { message: string; paper?: ChatResult['paper'] } | undefined
      if ((result.assessment?.complete || result.assessment?.readyToAdvance) && currentConcept.passed + 1 < targetCount(currentConcept.target)) {
        const nextLevel = levels[currentConcept.passed + 1].id
        const opening = await levelOpening(currentConcept, nextLevel, controller.signal, messages)
        nextOpening = { message: opening.message, ...('paper' in opening && opening.paper ? { paper: opening.paper } : {}) }
      }
      setArrivingReplies(replies => ({ ...replies, [conceptId]: { index: messages.length, content: nextOpening?.message ?? result.message } }))
      setConcepts(items => items.map(item => item.id === currentConcept.id ? { ...advanceConcept(item, messages, result, nextOpening), draft: item.draft, sending: undefined } : item))
      playLearningReward(learningReward(currentConcept.assessments?.[level], result.assessment))
      if (board) boardHandle?.markSent(board.version)
      setRevisingPaper(id => messages.some(message => message.paper?.id === id) ? null : id)
      return true
    } catch (reason) {
      setConcepts(items => items.map(item => item.id === conceptId ? recoverSend(item, text) : item))
      reportError(reason, concepts.length > 1 ? currentConcept?.name : undefined)
    }
    finally { endTurn(conceptId); clearTimeout(timeout); requestLocks.current.delete(conceptId) }
    return false
  }

  const queueStatus = !done ? awaitingGrades ? 'Sends after grading' : session.queuePaused ? 'Paused' : ''
    : currentConcept && !assignment && !currentConcept.finalSummary && currentConcept.passed < levels.length ? 'Sends when you continue' : 'Not sent. This chat is finished.'

  function renderPage() {
    if (page === '/profile' || page === '/settings') return <SettingsPage account={account} authMode={authMode} onProfileUpdated={onProfileUpdated} appearance={appearance} />
    if (isAdminAIModelPage) return account.role === 'admin' && account.hosted ? <main><AdminAIModelPage /></main> : <main><p>Page unavailable.</p></main>
    if (isAnalyticsPage) return account.role === 'admin' ? <main><AdminAnalyticsPage page={page} onNavigate={navigateFromSidebar} /></main> : <main><p>Admin access required.</p></main>
    if (isChatPage && account.role === 'student' && (!survey.ready || survey.error || (survey.status && !survey.status.submittedAt && !(started && sessionComplete(concepts))))) return <main className="survey-required"><h1>Learning survey</h1>{survey.error ? <p role="alert">{survey.error}</p> : <p>{survey.ready ? 'Complete the survey before continuing to another topic.' : 'Checking survey status…'}</p>}<button onClick={() => void survey.guard()}> {survey.status && !survey.status.submittedAt ? 'Complete survey' : 'Retry'}</button><button onClick={() => navigate('/sessions')}>Back to sessions</button></main>
    if (page === '/inbox') return canTeachCourses(account.role) ? null : <main className="account-login"><p>Instructor access required.</p><button onClick={() => navigate('/dashboard')}>Back to dashboard</button></main>
    if (page === '/admin') return account.role === 'admin' ? <main><AdminPage key={adminTargetId ?? 'directory'} targetId={adminTargetId} onNavigate={navigateFromSidebar} /></main> : <main className="account-login"><p>Admin access required.</p><button onClick={() => navigate('/sessions')}>Back to sessions</button></main>
    if (isAdminCoursesPage) return account.role === 'admin' ? <main><AdminCoursesPage key={account.id} courseId={adminCourseMatch?.[1]} onNavigate={navigateFromSidebar} /></main> : <main className="account-login"><p>Admin access required.</p><button onClick={() => navigate('/sessions')}>Back to sessions</button></main>
    if (isDeveloperPage && account.role !== 'admin') return <main className="account-login"><p>Admin access required.</p><button onClick={() => navigate('/sessions')}>Back to sessions</button></main>
    if (loadFailed) return <main className="account-login"><p role="alert">{error}</p><button onClick={() => setLoadVersion(value => value + 1)}>Retry loading</button></main>
    if (!hydrated) return <main className="bg-background text-foreground"><LoadingScreen label="Loading learning" /></main>
    if (page === '/character') return <main className="bg-background text-foreground"><CharacterStudio appearance={appearance} onChange={commitAppearance} saveStatus={appearanceSaveStatus} saveError={appearanceSaveError} onDone={() => navigate('/dashboard')} /></main>
    if (isCourseCreatePage) return <CourseCreatePage account={account} onNavigate={navigateFromSidebar} />
    if (isCoursesPage) return <main><CoursesPage key={page} account={account} collection={page === '/courses/community' ? 'community' : 'enrolled'} courseId={['/courses', '/courses/community'].includes(page) ? undefined : page.split('/')[2]} sessions={savedSessions} onBeforeTopic={survey.guard} onNavigate={navigateFromSidebar} onOpenAssignment={record => { record = { ...record, reportFinishedAt: record.reportFinishedAt || sessionsRef.current.find(value => value.id === record.id)?.reportFinishedAt }; sessionsRef.current = [record, ...sessionsRef.current.filter(value => value.id !== record.id)]; setSavedSessions(sessionsRef.current); openSession(record) }} /></main>
    if (isModuleEditor && (!moduleReady || sessionId !== moduleId)) return <main className={error ? 'courses-page' : 'bg-background text-foreground'}>{error ? <><p role="alert">{error}</p><button onClick={() => navigate(`/courses/${moduleCourseId}`)}>Back to course</button></> : <LoadingScreen label="Loading topic" />}</main>
    if (isDashboardPage) return <main className="bg-background text-foreground"><DashboardPage key={account.id} account={account} appearance={appearance} sessions={savedSessions} onOpenSession={openSession} onCreateSession={createSession} onNavigate={navigateFromSidebar} onCustomizeAvatar={() => navigate('/character')} error={error} /></main>
    if (isDeveloperPage) return <main className="bg-background text-foreground"><DeveloperPage characterName={appearance.name} onDirtyChange={onDeveloperDirtyChange} /></main>
    if (!isSessionsPage && !isSummaryPage && !started && setupStep === 'loading') return <main className="bg-background text-foreground"><LoadingScreen label="Creating your rubric" delayMs={0} /></main>
    return <main className="bg-background text-foreground">
      {isSessionsPage ? <SessionsPage sessions={savedSessions} onCreateSession={createSession} onOpenSession={openSession} error={error} /> : isSummaryPage ? started ? <TopicReport key={sessionId} backDestination={assignment ? 'course' : 'sessions'} sessionId={sessionId} appearance={appearance} complete={sessionComplete(concepts)} onBack={() => navigate(sessionBackPath)} onRestart={restartSession} /> : <SummaryUnavailable hasSession={Boolean(sessionId)} onBack={() => navigate(sessionBackPath)} onContinue={sessionId ? () => navigate(`/chat?session=${encodeURIComponent(sessionId)}`) : createSession} /> : <>
        <nav className={`back-navigation chat-nav ${isModuleEditor ? 'module-editor-navigation' : ''} ${started ? 'chat-nav-started' : ''}`} aria-label="Learning navigation">
          <BackButton onClick={() => { if (!started && setupStep !== 'title' && setupStep !== 'loading') { if (setupStep === 'rubric') setAiByName(false); setSetupStep(setupStep === 'rubric' ? 'concepts' : setupStep === 'concepts' ? 'class-type' : 'title'); setValidationError(null); setError('') } else navigate(isModuleEditor ? `/courses/${moduleCourseId}` : sessionBackPath) }} destination={!started && setupStep !== 'title' && setupStep !== 'loading' ? 'previous step' : assignment || isModuleEditor ? 'course' : 'sessions'} />
          {!started && title.trim() && <h1 className="rubric-page-title" title={title.trim()}>{title.trim()}</h1>}
          {started && <>
            <h1 className="chat-page-title" title={currentConcept?.name || 'Your learning'}>{currentConcept?.name || 'Your learning'}</h1>
            <div ref={tracker} className={`concept-tracker ${trackerOverflow ? 'concept-tracker-overflow' : ''}`} role="group" aria-label="Concept progress" tabIndex={trackerOverflow ? 0 : undefined} onScroll={() => setConceptTooltip(null)}>
              {concepts.map(concept => <button key={concept.id} type="button" className={`concept-orb ${concept.id in conceptTurns ? 'concept-orb-loading' : ''}`} onClick={() => { setConceptTooltip(null); switchChat(concept.id) }} onKeyDown={event => { if (event.key === 'Escape') setConceptTooltip(null) }} onPointerEnter={event => { if (event.pointerType === 'mouse') showConceptTooltip(event.currentTarget, concept.name) }} onPointerLeave={() => setConceptTooltip(null)} onFocus={event => { if (event.currentTarget.matches(':focus-visible')) showConceptTooltip(event.currentTarget, concept.name) }} onBlur={() => setConceptTooltip(null)} aria-label={`${concept.name}, ${concept.passed} of ${targetCount(concept.target)} target levels complete${concept.id in conceptTurns ? ', waiting for a reply' : ''}`} aria-busy={concept.id in conceptTurns} aria-current={active === concept.id ? 'true' : undefined}><svg className="concept-orb-visual" viewBox="0 0 32 32" aria-hidden="true"><circle className="concept-orb-track" cx="16" cy="16" r="13.75" /><circle className="concept-orb-progress" cx="16" cy="16" r="13.75" pathLength="100" strokeDasharray={`${Math.min(concept.passed / targetCount(concept.target), 1) * 100} 100`} />{concept.id in conceptTurns && <g className="concept-orb-loader">{[0, 1, 2].map(trail => <circle key={trail} className="concept-orb-swirl" cx="16" cy="16" r="13.75" pathLength="100" />)}</g>}{active === concept.id && <circle className="concept-orb-selection" cx="16" cy="16" r="5" />}</svg></button>)}
            </div>
            {conceptTooltip && <ConceptTooltip {...conceptTooltip} />}
          </>}
          {isModuleEditor && <div className="module-editor-toolbar"><button disabled={moduleSaving || uploading || setupStep === 'loading'} onClick={() => void commitModule()}>{moduleSaving ? 'Saving…' : 'Save draft'}</button></div>}
        </nav>
        {isModuleEditor && <div className="module-editor-feedback"><span role="status">{moduleNotice}</span>{error && <><p role="alert">{error}</p><button disabled={moduleSaving} onClick={() => void reloadModule().catch(reason => reportError(reason))}>Reload saved draft</button></>}</div>}
        <section inert={(isModuleEditor && moduleSaving) || restartingSession} className={`chat-section ${started ? 'chat-section-started' : 'chat-section-setup'} ${boardOpen ? 'board-open' : 'board-closed'} ${started && !done && !awaitingGrades ? 'composer-open' : ''} ${concepts.length > 3 ? 'concept-rail' : ''} ${!started && setupStep === 'class-type' ? 'class-type-section' : ''}`} aria-label="Learning chat">
          {started && <ChatActions {...chatActionProps} />}
          <aside className="chat-avatar" aria-label="Your classroom student">{started && <div id="classroom-whiteboard" className="whiteboard-container" onPointerEnter={event => { if (event.pointerType === 'mouse') setBoardHovered(true) }} onPointerLeave={() => setBoardHovered(false)}><TooltipButton type="button" className="whiteboard-toggle" tooltip={boardOpen ? 'Close whiteboard' : 'Open whiteboard'} aria-label={boardOpen ? 'Close whiteboard' : 'Open whiteboard'} aria-expanded={boardOpen} aria-controls="whiteboard-drawing" onClick={() => setBoardOpen(open => !open)}><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{boardOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <rect x="3" y="3" width="18" height="18" rx="4" />}</svg></TooltipButton><div id="whiteboard-drawing" className="whiteboard-drawing" aria-hidden={!boardOpen} inert={!boardOpen}><Whiteboard key={active} ref={whiteboard} open={boardOpen} /></div></div>}{started && <div ref={avatarCharacter} className="avatar-character"><Bloub key={active} appearance={appearance} showControls={false} followPointer={!busy && boardOpen && boardHovered} expression={busy ? 'confused' : boardOpen && boardHovered ? 'attentive' : done ? 'excited' : session.expression || 'attentive'} /><ThoughtCloud thinking={busy} transferring={Boolean(arrivingReply)} /></div>}</aside>
          <div className="chat-panel">
            {!started && <div className="setup-progress" role="progressbar" aria-label={isModuleEditor ? 'Topic setup progress' : 'Session setup progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={setupProgress} aria-valuetext={setupProgressLabel}>
              <span className="setup-progress-fill" style={{ transform: `scaleX(${setupProgress / 100})` }} />
            </div>}
            {!started ? setupStep === 'title' ? <SetupTitleForm heading={isModuleEditor ? 'Topic title' : 'What will you learn?'} inputId="session-title" inputLabel={isModuleEditor ? 'Topic title' : 'Give this session a title'} value={title} onChange={value => { setTitle(value); setValidationError(null) }} onSubmit={() => { if (!title.trim()) { showValidation('title', 'session-title', 'Give this session a title.'); return } setValidationError(null); setSetupStep('class-type'); setError('') }} actionLabel={isModuleEditor ? 'Choose learning type →' : 'Find my learning style →'} placeholder="e.g. Electricity and circuits" invalid={validationError?.fieldId === 'session-title'} validationAttempt={validationError?.step === 'title' ? validationError.attempt : 0} feedback={validationTooltip('title')} error={error} /> : setupStep === 'class-type' ? <LearningTypeSelector key={sessionId} value={learningType} onContinue={changeLearningType} /> : setupStep === 'concepts' ? <form className="setup-slide setup-concepts" noValidate onSubmit={event => { event.preventDefault(); void continueToRubric() }}><div className="setup-columns"><div className={`setup-concept-side${concepts.length > 1 ? ' setup-concept-side-removable' : ''}`}><div className="setup-concept-heading"><h3>Concepts</h3><h3>Learning Level</h3></div><div className="concept-list">{concepts.map((concept, index) => <div className="concept-card" key={concept.id}><label className="sr-only" htmlFor={`setup-name-${concept.id}`}>Concept {index + 1} name</label><input id={`setup-name-${concept.id}`} value={concept.name} onChange={event => updateConcept(concept.id, { name: event.target.value })} maxLength={300} placeholder="Concept name" aria-invalid={validationError?.fieldId === `setup-name-${concept.id}`} className={validationError?.fieldId === `setup-name-${concept.id}` ? 'validation-field' : undefined} /><LevelSlider id={`setup-target-${concept.id}`} name={concept.name || `concept ${index + 1}`} value={selectedTargets[concept.id] ?? 'remember'} onChange={level => setSelectedTargets(targets => ({ ...targets, [concept.id]: level }))} />{concepts.length > 1 && <button type="button" className="concept-remove" aria-label={`Remove concept ${index + 1}`} onClick={() => { setValidationError(null); setConcepts(items => items.filter(item => item.id !== concept.id)) }}>×</button>}</div>)}</div>{concepts.length < 20 && <button type="button" className="concept-add" onClick={() => setConcepts(items => [...items, newConcept()])}>＋ Add concept</button>}</div><div className="setup-file-side"><h3>AI Autofill</h3><label className="setup-drop" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)) }}><span>Drop files here or click to upload</span><small>Up to 5 MB total</small><input type="file" multiple onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = '' }} /></label>{files.length > 0 && <><ul className="setup-files">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(items => items.filter((_, i) => i !== index))}>×</button></li>)}</ul></>}</div></div><div className="setup-actions"><div className="setup-actions-right"><RubricAutoGenerateToggle checked={aiByName} regenerate={hasRubric} onChange={setAiByName} instructions={rubricInstructions} onInstructionsChange={setRubricInstructions} /><button type="button" className="setup-secondary setup-autofill" disabled={uploading || !files.length} onClick={() => void suggestConcepts()}>{uploading ? <LoadingAnimation label="Autofilling concepts" compact delayMs={0} /> : '← Autofill concepts'}</button><div className="validation-action"><button key={validationError?.step === 'concepts' ? validationError.attempt : 0} className={`send-button ${validationError?.step === 'concepts' ? 'validation-shake' : ''}`} disabled={uploading}>{aiByName ? hasRubric ? 'Re-generate rubric →' : 'Generate rubric →' : 'Continue to rubric →'}</button>{validationTooltip('concepts')}</div></div></div>{error && <p className="chat-error" role="alert">{error}</p>}</form> : setupStep === 'loading' ? <LoadingScreen label="Creating your rubric" delayMs={0} /> : <form className="chat-setup" noValidate onSubmit={event => { event.preventDefault(); startLearning() }}><div className="rubric-scroll">
            <table className="rubric-grid">
              <colgroup><col style={{ width: '17%' }} />{levels.map(level => <col key={level.id} />)}<col style={{ width: 40 }} /></colgroup>
              <thead><tr>
                <th scope="col"><span className="sr-only">Concept name</span><span className="rubric-intro-help"><button type="button" className="rubric-help-trigger" aria-label="About the rubric" aria-describedby="rubric-intro-tooltip">?</button><span className="rubric-help-tooltip" id="rubric-intro-tooltip" role="tooltip">Add or edit checklist items describing what someone must demonstrate. The AI checks each item during evaluation. Filled higher levels raise the learning target.</span></span></th>
                {levels.map((level, index) => <th scope="col" className={index === levels.length - 1 ? 'rubric-header-last' : undefined} key={level.id}><button type="button" className="rubric-header-trigger" aria-describedby={`rubric-help-${level.id}`}>{level.name}</button><span className="rubric-help-tooltip rubric-header-tooltip" id={`rubric-help-${level.id}`} role="tooltip">{profile.help[level.id]}</span></th>)}
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>{concepts.map((concept, index) => <tr key={concept.id}>
                <th scope="row" className="rubric-concept-cell"><label className="sr-only" htmlFor={`concept-${concept.id}`}>Concept {index + 1} name</label><AutosizeTextarea rows={1} id={`concept-${concept.id}`} value={concept.name} onChange={event => updateConcept(concept.id, { name: event.target.value })} placeholder="Concept" maxLength={300} disabled={uploading} aria-invalid={validationError?.fieldId === `concept-${concept.id}`} className={validationError?.fieldId === `concept-${concept.id}` ? 'validation-field' : undefined} /></th>
                {levels.map((level, levelIndex) => { const target = highestFilledLevel(concept.rubric); const required = target !== null && levelIndex <= levels.findIndex(item => item.id === target); return <td key={level.id} className={required ? 'rubric-required-cell' : undefined}><RubricChecklistEditor id={`${concept.id}-${level.id}`} name={`${concept.name || `Concept ${index + 1}`}: ${level.name}`} value={concept.rubric[level.id]} onChange={value => { const next = editCriterion(concept, level.id, value); setValidationError(null); setConcepts(items => items.map(item => item.id === concept.id ? next : item)); setSelectedTargets(targets => ({ ...targets, [concept.id]: highestFilledLevel(next.rubric) })) }} invalid={validationError?.fieldId === `${concept.id}-${level.id}`} disabled={uploading} /></td> })}
                <td className="rubric-actions-cell">{concepts.length > 1 && <button type="button" className="concept-remove" aria-label={`Remove concept ${index + 1}`} onClick={() => { setValidationError(null); setConcepts(items => items.filter(item => item.id !== concept.id)) }}>−</button>}</td>
              </tr>)}</tbody>
            </table>
          </div>{concepts.length < 20 && <button type="button" className="concept-add" onClick={() => setConcepts(items => [...items, newConcept()])}><span aria-hidden="true">＋</span> Add concept</button>}<div className="chat-actions"><div className="validation-action"><button key={validationError?.step === 'rubric' ? validationError.attempt : 0} className={`send-button ${validationError?.step === 'rubric' ? 'validation-shake' : ''}`}>{moduleSaving ? 'Publishing…' : isModuleEditor ? 'Publish topic' : 'Start session'}</button>{validationTooltip('rubric')}</div></div>{error && <p className="chat-error" role="alert">{error}</p>}</form> : <><div ref={attachMessageList} className="chat-messages" role="log" aria-label="Conversation" aria-live="polite">{[...session.messages, ...(pendingMessage ? [pendingMessage] : [])].map((message, index) => {
            if (message.passedLevel && currentConcept && targetCount(message.passedLevel) === targetCount(currentConcept.target)) return null
            const reviewedMessage = message.role === 'assistant' ? session.messages[index - 1] : undefined
            const reviewedPaper = reviewedMessage?.review ? session.messages.find(item => item.paper?.id === reviewedMessage.review?.paperId)?.paper : undefined
            const skipItem = message.role === 'assistant' && index === session.messages.length - 1 && !pendingMessage && !done && !currentConcept?.finalSummary && message.rubricFocus && rubricSkipReason(session.messages.slice(currentConcept?.stageStart ?? 0), message.rubricFocus) ? message.rubricFocus : undefined
            const divider = message.passedLevel && <div className="level-divider" role="status"><span>{levels.find(level => level.id === message.passedLevel)?.name} level {currentConcept?.assessments?.[message.passedLevel!]?.readyToAdvance ? 'finished with skipped items' : 'passed'}!</span></div>
            return <div key={`${sessionId}-${active}-${index}-${message.role}-${message.content}`}>{divider}<ChatMessage role={message.role} name={message.assistance ? 'Prerequisite review' : message.role === 'user' ? 'You' : appearance.name} content={skipItem ? "Alright, no problem. Would you like to skip this?" : message.content} inlineAction={skipItem && <SkipRubricButton busy={busy} onSkip={() => { void send(undefined, 'skip') }} onContinue={() => updateSession({ messages: session.messages.map((item, messageIndex) => messageIndex === index ? { ...item, skipOfferDeclined: true } : item) })} />} className={message.paper ? 'chat-message-with-paper' : ''} avatarRef={avatarCharacter} arrive={message.role === 'assistant' && arrivingReply?.index === index && arrivingReply.content === message.content} onArrived={finishReplyArrival} feedback={quantitative && reviewedPaper && reviewedMessage?.review && <ReviewFeedback paper={reviewedPaper} review={reviewedMessage.review} busy={busy} onRevise={!done && !currentConcept?.finalSummary && reviewedMessage.review === review && reviewedPaper.id === paper?.id ? () => setRevisingPaper(reviewedPaper.id) : undefined} />} boardImage={message.boardImage}>{quantitative && message.paper && currentConcept && <><svg className="paper-invite-arrow" viewBox="0 0 120 72" preserveAspectRatio="none" aria-hidden="true"><path d="M3 53 C27 64 42 51 57 36 S88 20 108 32" /><path d="M97 19 Q105 25 109 32 Q100 35 94 43" /></svg><PaperReview characterName={appearance.name} key={`${active}-${message.paper.id}-${revisingPaper === message.paper.id}`} paper={message.paper} review={revisingPaper === message.paper.id ? undefined : session.messages.findLast(item => item.review?.paperId === message.paper?.id)?.review} busy={busy} error={error} onSubmit={review => send(review)} autoOpen={revisingPaper === message.paper.id} onClose={() => setRevisingPaper(null)} /></>}</ChatMessage></div>
          })}{done && currentConcept && <div className="level-divider level-divider-final" role="status"><span>{currentConcept.finalSummary ? 'Analyze assessment finished.' : <>{levels[currentConcept.passed - 1]?.name} level {currentConcept.assessment?.readyToAdvance ? 'finished with skipped items' : 'passed'}!</>}</span>{!assignment && !currentConcept.finalSummary && currentConcept.passed < levels.length && <button type="button" className="level-divider-continue" disabled={busy} onClick={() => void raiseTarget(currentConcept, levels[currentConcept.passed].id)}>{busy ? 'Thinking' : 'Continue'}</button>}{sessionComplete(concepts) && currentConcept.passed < levels.length && <button type="button" className="level-divider-summary" onClick={() => navigate(`/summary?session=${encodeURIComponent(sessionId)}`)}>View session summary →</button>}</div>}</div><MessageQueue key={active} items={queue} editingId={editingQueuedId} status={queueStatus} canEdit={!done} onResume={session.queuePaused && !done && !awaitingGrades ? () => updateSession({ queuePaused: false }) : undefined} onEditingChange={id => setEditingQueued(id ? { conceptId: active, id } : null)} onDraggingChange={setDraggingQueued} onChange={next => updateSession({ queue: next })} onMove={(from, to) => updateSession({ queue: moveQueued(queue, from, to) })} />{done ? null : awaitingGrades ? <div className="chat-awaiting-grade">Sort all my papers to continue the conversation.</div> : <ChatComposer key={active} className="chat-composer" value={session.draft} onChange={draft => updateSession({ draft })} onSend={submitDraft} busy={false} sendLabel={busy || queue.length ? 'Queue' : 'Send'} menuActions={close => <ChatActionItems {...chatActionProps} onSelect={close} />} />}{!done && !currentConcept?.finalSummary && <LearningActions busy={busy} canFinish={Boolean(quantitative && currentConcept?.passed === 3 && review && session.assessment)} onAction={action => { void send(undefined, action) }} />}</>}{error && <p className="chat-error" role="alert">{error}</p>}</div></section></>}
      {!started && setupStep === 'class-type' && pendingLearningType && <LearningTypeChangeDialog learningType={pendingLearningType} onConfirm={confirmLearningTypeChange} onCancel={() => setPendingLearningType(null)} />}
    </main>
  }
  const conflictSession = savedSessions.find(record => record.id === saveStatus.sessionId)
  const content = <>
    {saveStatus.state === 'error' && <div className="learning-save-notice" role="alert"><p>{saveStatus.message}</p><button onClick={() => void flushSessionSaves().catch(reason => reportError(reason))}>Retry saving</button></div>}
    {saveStatus.state === 'conflict' && <ConfirmDialog key={saveStatus.sessionId} title={conflictSession?.title ? `“${conflictSession.title}” changed on another device` : 'Session changed on another device'} confirmLabel="Use saved version" busy={resolvingSave} error={resolveSaveError} onConfirm={() => void resolveSave(false)} secondaryAction={conflictSession?.assignment ? undefined : { label: 'Keep a copy', onClick: () => void resolveSave(true) }}>
      {conflictSession?.assignment ? 'Assigned topics can’t be copied. Using the saved version discards this device’s work.' : 'Keep a copy to save this device’s work as a new session, or use the saved version and discard it.'}
    </ConfirmDialog>}
    {survey.error && !isChatPage && <p className="account-error" role="alert">{survey.error}</p>}
    {renderPage()}
    {survey.status && !survey.status.submittedAt && <LearningSurveyDialog open={survey.open} status={survey.status} onLater={() => { survey.close(); if (isChatPage && !(started && sessionComplete(concepts))) navigate('/sessions') }} onSubmitted={survey.submitted} />}
  </>
  return isAnalyticsPage || isAdminAIModelPage || isAdminCoursesPage || isCourseCreatePage || isCoursesPage || isModuleEditor || (isChatPage && !started) || isSummaryPage || isDashboardPage || isSessionsPage || page === '/profile' || page === '/settings' || page === '/character' || page === '/admin' || page === '/inbox' || isDeveloperPage ? <DashboardShell key={account.id} account={account} appearance={appearance} activePage={isDashboardPage ? '/dashboard' : isChatPage && !started ? '/sessions' : isSummaryPage ? sessionBackPath : page} onNavigate={navigateFromSidebar} onCustomizeAvatar={() => navigateFromSidebar('/character')}>{content}</DashboardShell> : content
}
