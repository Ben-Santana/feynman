import { checklistItems } from './rubricChecklist.js'

// A teaching checklist is student-facing guidance written from a level's rubric
// items. It says what to cover without quoting the rubric. Each prompt keeps the
// one-based numbers of the rubric items it stands for, so its completion state
// comes from the same assessment that grades the conversation.
const levels = ['remember', 'understand', 'apply', 'analyze']
export const guideLimits = { groups: 5, prompts: 4, title: 70, text: 180 }
const sameRubric = (a, b) => JSON.stringify(checklistItems(a || '')) === JSON.stringify(checklistItems(b || ''))

// Structural check shared by the server's output validation and saved data.
export function validLevelGuide(guide, itemCount) {
  if (!guide || typeof guide.source !== 'string' || !Array.isArray(guide.groups) || !guide.groups.length || guide.groups.length > guideLimits.groups) return false
  const covered = new Set()
  for (const group of guide.groups) {
    if (!group || typeof group.title !== 'string' || !group.title.trim() || group.title.length > guideLimits.title || !Array.isArray(group.prompts) || !group.prompts.length || group.prompts.length > guideLimits.prompts) return false
    for (const prompt of group.prompts) {
      if (!prompt || typeof prompt.text !== 'string' || !prompt.text.trim() || prompt.text.length > guideLimits.text || !Array.isArray(prompt.criteria) || !prompt.criteria.length) return false
      for (const number of prompt.criteria) {
        if (!Number.isInteger(number) || number < 1 || number > itemCount) return false
        covered.add(number)
      }
    }
  }
  return covered.size === itemCount
}

// The saved checklist for a level, or null when it is missing or was written for a different rubric.
export function guideFor(concept, level) {
  const guide = concept.guide?.[level]
  const rubric = concept.rubric?.[level] || ''
  return guide && sameRubric(guide.source, rubric) && validLevelGuide(guide, checklistItems(rubric).length) ? guide : null
}

// Levels through the target that have rubric items but no current checklist.
export function missingGuideLevels(concept) {
  return levels.slice(0, levels.indexOf(concept.target) + 1).filter(level => checklistItems(concept.rubric?.[level] || '').length > 0 && !guideFor(concept, level))
}

// The level a student is teaching now; a finished concept shows its last level.
export function guideLevel(concept) {
  return levels[Math.min(Math.max(concept.passed, 0), levels.indexOf(concept.target))]
}

// A prompt is done only when every rubric item behind it is demonstrated. Some
// but not all is partial, so a grouped prompt never looks finished early. Done
// after stating one of its items wrongly is corrected: the half-point case.
//
// The checklist follows the teaching instead of leading it. On the level being
// taught, prompts appear one at a time: finished ones stay, the next one appears
// only after the student has replied in the chat since their last progress, and
// everything after it is counted but not shown.
export function guideChecklist(concept, level = guideLevel(concept)) {
  const guide = guideFor(concept, level)
  if (!guide) return null
  const index = levels.indexOf(level)
  const assessment = concept.assessments?.[level] ?? (!concept.assessments && index === concept.passed ? concept.assessment : null)
  const judged = checklistItems(concept.rubric[level]).map(item => {
    const judgment = assessment?.criteria.find(criterion => criterion.aspect.trim() === item)
    const shown = !judgment?.skipped && (judgment?.status === 'supported' || (!judgment && index < concept.passed))
    return { shown, fixed: shown && Boolean(concept.mistakes?.[level]?.includes(item)), settled: shown || Boolean(judgment?.skipped), evidence: shown ? judgment?.evidence || [] : [] }
  })
  const live = index === concept.passed && index < levels.indexOf(concept.target) + 1
  const prompts = guide.groups.flatMap((group, groupIndex) => group.prompts.map(prompt => {
    const items = prompt.criteria.map(number => judged[number - 1])
    const shown = items.filter(item => item.shown).length
    return { groupIndex, text: prompt.text, state: shown === items.length ? items.some(item => item.fixed) ? 'corrected' : 'done' : shown ? 'partial' : 'open', settled: items.every(item => item.settled), evidence: items.flatMap(item => item.evidence) }
  }))
  // Replies are counted from the last message that earned progress on a finished prompt.
  const messages = concept.messages || []
  const start = concept.stageStart || 0
  const wholeChat = level === 'analyze' && messages.some(message => message.paper)
  const progressAt = Math.max(-1, ...prompts.filter(prompt => prompt.settled).flatMap(prompt => prompt.evidence.map(item => item.messageIndex - (wholeChat ? start : 0))))
  const replied = messages.slice(start).some((message, position) => position > progressAt && message.role === 'user' && !message.skipRubricItem && !message.helpRequest && !message.finishAssessment)
  const current = live ? prompts.findIndex(prompt => !prompt.settled) : -1
  const visible = prompts.map((prompt, position) => !live || prompt.settled || prompt.state !== 'open' || (position === current && replied))
  const groups = guide.groups.map((group, groupIndex) => ({
    title: group.title,
    prompts: prompts.flatMap((prompt, position) => prompt.groupIndex === groupIndex && visible[position] ? [{ text: prompt.text, state: prompt.state }] : []),
  })).filter(group => group.prompts.length)
  const waiting = current >= 0 && !visible[current]
  return { level, groups, done: prompts.filter(prompt => prompt.state === 'done' || prompt.state === 'corrected').length, total: prompts.length, waiting, later: visible.filter(value => !value).length - Number(waiting) }
}

// Adds freshly generated level checklists, keeping any that still match the rubric.
export function mergeGuide(concept, generated) {
  const guide = {}
  for (const level of levels) {
    const next = [generated?.[level], concept.guide?.[level]].find(value => value && sameRubric(value.source, concept.rubric?.[level] || '') && validLevelGuide(value, checklistItems(concept.rubric[level]).length))
    if (next) guide[level] = next
  }
  return { ...concept, guide }
}
