import { accountSignal, supabase } from './accounts.ts'

export const analyticsTabs = [
  ['/admin/analytics', 'Engagement'],
  ['/admin/analytics/pre-topic', 'Pre-topic questions'],
  ['/admin/analytics/scores', 'Topic scores'],
  ['/admin/analytics/salg-survey', 'SALG survey'],
  ['/admin/analytics/ai-usage', 'AI usage'],
] as const
export const isAnalyticsPath = (path: string) => analyticsTabs.some(([tab]) => tab === path)

export const priorExposureOptions = [['none', 'No'], ['this_course', 'Yes, earlier in this course'], ['elsewhere', 'Yes, somewhere else']] as const
export const ratingScale = ['Not at all', 'Slightly', 'Moderately', 'Well', 'Very well'] as const
export const expectedScores = Array.from({ length: 11 }, (_, index) => index * 10)
export type PriorExposure = typeof priorExposureOptions[number][0]
export type PreTopicAnswers = { prior: PriorExposure | ''; expected: number | null; ratings: Record<string, number> }
export type PreTopicConcept = { id: string; name: string }

async function researchRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const signal = accountSignal()
  const { data, error } = await supabase().rpc(name, args).abortSignal(signal)
  signal.throwIfAborted()
  if (error) throw new Error(error.code === 'PGRST202' ? 'Research tracking is not set up. Apply the latest database migration.' : error.message)
  return data as T
}

export function submitPreTopic(moduleId: string, answers: PreTopicAnswers) {
  return researchRpc<void>('submit_topic_prequestionnaire', { target_module: moduleId, prior: answers.prior, expected: answers.expected, ratings: answers.ratings })
}

export type ActivityEvent = 'app_open' | 'topic_open' | 'active' | 'report_view'
// Logging never interrupts the student; a failed write is dropped.
export function logActivity(event: ActivityEvent, sessionId?: string | null) {
  void supabase().rpc('log_activity', { event_name: event, target_session: sessionId || null }).then(() => undefined, () => undefined)
}

export type DailyActivity = { date: string; students: number; minutes: number }
export type RetentionCohort = { week: string; size: number; active: (number | null)[] }
export type TopicCalibration = { moduleId: string; title: string; course: string | null; responses: number; completed: number; expected: number | null; actual: number | null }
export type ResearchAnalytics = {
  days: number; generatedAt: string
  engagement: { participants: number; everActive: number; active: number; returning: number; minutes: number; medianMinutes: number | null; topicOpens: number; topicsCompleted: number; trackingStartedAt: string | null; daily: DailyActivity[]; cohorts: RetentionCohort[] }
  prequestionnaire: {
    responses: number; students: number; completed: number; expected: number | null; actual: number | null; gap: number | null
    points: { expected: number; actual: number; title: string }[]
    ratings: { rating: number; count: number; scored: number; score: number | null }[]
    prior: Record<PriorExposure, number>; topics: TopicCalibration[]
  }
}
export const loadResearchAnalytics = (days: number, course: string) => researchRpc<ResearchAnalytics>('admin_research_analytics', { window_days: days, target_course: course || null })

export type ResearchCourse = { id: string; name: string }
export const loadResearchCourses = () => researchRpc<ResearchCourse[]>('admin_research_courses')

export type ResearchRowsKind = 'prequestionnaire' | 'activity' | 'activity_summary'
const columns: Record<ResearchRowsKind, string[]> = {
  prequestionnaire: ['participant_code', 'course_id', 'module_id', 'topic_title', 'session_id', 'questionnaire_version', 'submitted_at', 'prior_exposure', 'expected_score', 'concept_id', 'concept_name', 'concept_target', 'self_rating', 'topic_completed', 'report_saved_at', 'topic_score', 'concept_score', 'research_first_score', 'research_final_score'],
  activity: ['participant_code', 'event', 'occurred_at', 'session_id', 'course_id', 'module_id'],
  activity_summary: ['participant_code', 'first_active_at', 'last_active_at', 'active_days', 'active_weeks', 'active_minutes', 'app_opens', 'topic_opens', 'report_views', 'assigned_topics_started', 'assigned_topics_completed'],
}

export function researchCsv(kind: ResearchRowsKind, rows: Record<string, unknown>[]) {
  // Topic titles are instructor text, so neutralize spreadsheet formulas.
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${(/^[\s]*[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`
  }
  return '﻿' + [columns[kind], ...rows.map(row => columns[kind].map(column => row[column]))].map(row => row.map(cell).join(',')).join('\r\n')
}

export const trackingDictionary = `Feynman research tracking: pre-topic-v1 and activity-v1
Population: approved students with a signed consent agreement. With a course selected, only students enrolled in that course. Rows use the same participant codes as the research score exports; names and emails are only in the restricted roster file.

PRE-TOPIC QUESTIONS (feynman-prequestionnaire.csv)
Asked once per student and assigned topic, before the first attempt starts. Restarts do not ask again. Topics started before this feature have no answers. One row per concept.
prior_exposure: none | this_course | elsewhere ("Have you studied this topic before?")
expected_score: 0-100 in steps of 10 ("What score do you expect on this topic?")
self_rating: 1 Not at all, 2 Slightly, 3 Moderately, 4 Well, 5 Very well ("How well do you understand this concept right now?")
session_id: the first attempt's session. Scores come from that session's latest completed report; blank while unfinished.
topic_score / concept_score: the student-facing score (1 correct, 0.5 corrected mistake, 0 skipped) as a percentage of assigned items.
research_first_score / research_final_score: rubric credit, as in the scoring data dictionary.
Calibration gap = expected_score - topic_score. Positive means overconfident.

ACTIVITY (feynman-activity.csv, feynman-activity-summary.csv)
Events: app_open (app loaded, at most once per 5 minutes), topic_open (a session opened, at most once per session per 5 minutes), report_view (a topic report opened), active (one per minute while the app is visible and the student used the mouse, keyboard or touch in the last 2 minutes).
active_minutes counts active events, so it measures engaged time, not time with the tab open.
active_days and active_weeks use UTC dates. Weeks start on Monday.
Retention cohorts group students by the UTC week of their first recorded activity. Week N is the share of the cohort with any activity N weeks later.
Tracking starts when the research tracking migration is applied; earlier activity is not available.
`

export async function downloadResearchRows(kind: ResearchRowsKind, course: string) {
  const rows = await researchRpc<Record<string, unknown>[]>('admin_research_rows', { kind, target_course: course || null })
  saveFile(researchCsv(kind, rows), `feynman-${kind.replace('_', '-')}.csv`, 'text/csv;charset=utf-8')
}
export function downloadTrackingDictionary() { saveFile(trackingDictionary, 'tracking-data-dictionary.txt', 'text/plain;charset=utf-8') }
export function saveFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
