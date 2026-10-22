import { accountSignal, supabase } from './accounts.ts'

export const gainsScale = ['No Gains', 'A Little Gain', 'Moderate Gain', 'Good Gain', 'Great Gain', 'Not Applicable']
export const helpfulnessScale = ['No Help', 'A Little Help', 'Moderate Help', 'Good Help', 'Great Help', 'Not Applicable']
export const surveySections = [
  { title: 'Gains in conceptual understanding', prompt: 'As a result of using Feynman AI, what gains did you make in your understanding of the following?', questions: [
    ['1', 'The main concept I studied.'],
    ['2', 'The underlying principles that explain how or why the concept works.'],
    ['3', 'The relationships between the concept and other concepts I already know.'],
    ['4', 'How the concept can be applied to unfamiliar problems or situations.'],
  ], open: ['concept_change', 'How, if at all, did your understanding of the concept change after using Feynman AI?'] },
  { title: 'Gains in learning and reasoning skills', prompt: 'As a result of using Feynman AI, what gains did you make in the following skills?', questions: [
    ['5', 'Explaining complex concepts clearly in my own words.'],
    ['6', 'Identifying gaps or misconceptions in my own understanding.'],
    ['7', 'Developing logical explanations for why something works.'],
    ['8', 'Recognizing when my explanation is incomplete or unsupported.'],
    ['9', 'Identifying what I need to review or study further.'],
  ], open: ['skills_developed', 'What, if any, learning or reasoning skills did you develop while using Feynman AI?'] },
  { title: 'Gains in confidence and attitudes', prompt: 'As a result of using Feynman AI, what gains did you make in the following?', questions: [
    ['10', 'Confidence in my understanding of the concept.'],
    ['11', 'Confidence in my ability to explain the concept to someone else.'],
    ['12', 'Comfort with working through concepts I initially find difficult.'],
  ] },
  { title: 'Integration and application of learning', prompt: 'As a result of using Feynman AI, what gains did you make in your ability to do the following?', questions: [
    ['13', 'Connect the concept to other knowledge I have.'],
    ['14', 'Apply the concept in a new situation.'],
    ['15', 'Use systematic reasoning to work through a conceptual problem.'],
  ] },
  { title: 'Helpfulness of Feynman AI activities', prompt: 'How much did each of the following aspects of Feynman AI help your learning?', questions: [
    ['16', "Responding to the AI's follow-up questions."],
    ['17', 'Receiving feedback about my understanding.'],
    ['18', 'Reconsidering my explanation after being asked additional questions.'],
    ['19', 'The overall question-and-answer approach used by Feynman AI.'],
  ], open: ['most_helpful', 'Which aspect of Feynman AI was most helpful to your learning, and why?'] },
  { title: 'Overall learning experience', prompt: '', questions: [], written: [
    ['20', 'Did Feynman AI help you recognize anything about your understanding that you had not previously realized? Please explain.'],
    ['21', 'How, if at all, might using Feynman AI change the way you study or learn in the future?'],
  ] },
]
export const surveyQuestions = surveySections.flatMap(section => [...section.questions, ...(section.open ? [section.open] : []), ...(section.written || [])])
export type SurveyStatus = { sessionId: string; topicTitle: string; submittedAt: string | null } | null
export type SurveyResponse = { studentId: string; name: string; email: string; sessionId: string; topicTitle: string; requiredAt: string; submittedAt: string; version: string; answers: Record<string, string> }
export type SurveyAnalytics = { pending: number; responses: SurveyResponse[] }
export async function surveyRpc<T>(name: string, args = {}): Promise<T> {
  const signal = accountSignal()
  const { data, error } = await supabase().rpc(name, args).abortSignal(signal)
  signal.throwIfAborted()
  if (error) throw new Error(error.code === 'PGRST202' ? 'Survey setup is incomplete. Apply the latest database migration.' : error.message)
  return data as T
}
export const loadSurveyStatus = () => surveyRpc<SurveyStatus>('learning_survey_status')
export const submitSurvey = (answers: Record<string, string>) => surveyRpc<void>('submit_learning_survey', { responses: answers })

export function surveyCsv(responses: SurveyResponse[]) {
  // Prevent spreadsheet formulas in user-entered answers and names.
  const cell = (value: string) => `"${(/^[\s]*[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
  const headings = ['Student ID', 'Name', 'Email', 'Session ID', 'Topic', 'Required at', 'Submitted at', 'Survey version', ...surveyQuestions.map(([id, text]) => `${id}: ${text}`)]
  const rows = responses.map(row => [row.studentId, row.name, row.email, row.sessionId, row.topicTitle, row.requiredAt, row.submittedAt, row.version, ...surveyQuestions.map(([id]) => row.answers[id] || '')])
  return '\uFEFF' + [headings, ...rows].map(row => row.map(cell).join(',')).join('\r\n')
}
