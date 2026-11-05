import { accountFetch } from './accounts'
import type { Level } from './learningFlow'

export type GoalStatus = 'demonstrated' | 'partial' | 'needs_work' | 'skipped' | 'not_assessed'
export type ReportGoal = { id: string; conceptId: string; concept: string; level: Level; text: string; status: GoalStatus; firstCredit: number | null; finalCredit: number | null; firstLimitation: string | null; reason: string; evidence: { quote: string; messageIndex: number }[]; assisted: boolean; assistanceUnknown: boolean; independentCheck: string; legacy: boolean }
export type ReportScore = { percent: number | null; scored: number; assigned: number; coverage: number; points: number }
export type TopicReportData = { title: string; startedAt: string; learningType: string; finishMode: 'early' | 'completed'; legacy: boolean; demonstrated: number; assigned: number; first: ReportScore; final: ReportScore; goals: ReportGoal[]; levelChecks: { conceptId: string; concept: string; level: Level; supported: boolean; independentCheck: string; transferCheck: string; reason: string; rubricDemonstrated: boolean; goalId: string }[]; priorities: { goalId: string; conceptId: string; level: Level; concept: string; reason: string; action: string }[]; scoringPolicyVersion: string }
export type ReportResponse = { id?: string; createdAt?: string; report: TopicReportData; snapshots: { id: string; createdAt: string; finishMode: string; watermark: number }[] }
export async function loadTopicReport(sessionId: string, signal: AbortSignal, mode: 'early' | 'completed'): Promise<ReportResponse> {
  const response = await accountFetch(`/api/sessions/${encodeURIComponent(sessionId)}/report?mode=${mode}`, { method: 'POST', signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not save the report. Retry saving.')
  return data
}
export async function downloadResearchFile(params: URLSearchParams) {
  const response = await accountFetch(`/api/admin/research/export?${params}`)
  if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Could not download the export.') }
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = params.get('kind') === 'dictionary' ? 'scoring-data-dictionary.txt' : `feynman-${params.get('kind')}.csv`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export type StudyGuidance = { nextSteps: string[] }
export async function loadStudyGuidance(sessionId: string, snapshot: string | undefined, signal: AbortSignal): Promise<StudyGuidance> {
  const params = new URLSearchParams(snapshot ? { snapshot } : {})
  const response = await accountFetch(`/api/sessions/${encodeURIComponent(sessionId)}/report/guidance?${params}`, { signal })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Could not generate your study summary.')
  return data
}
