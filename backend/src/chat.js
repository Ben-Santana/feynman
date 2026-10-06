import { loadPrompts } from './promptStore.js';
import { checklistItems, checklistText } from '../../frontend/src/rubricChecklist.js';
import { extractArchiveText } from './uploadExtract.js';
import { randomUUID } from 'node:crypto';
import { learningTypes, resolveLearningType, needsScenarioOpening } from '../../frontend/src/learningTypes.js';
const initialPrompts = loadPrompts();
export const rubrics = Object.fromEntries(['remember', 'understand', 'apply', 'analyze'].map(level => [level, initialPrompts.text('chat.rubric.' + level)]));
const statuses = ['supported', 'needs_clarification', 'flawed', 'missing'];
const resultKinds = ['correct', 'incorrect', 'undetermined', 'not_applicable'];
export const classroomRole = initialPrompts.text('chat.classroomRole');

const responseProperties = {
  message: { type: 'string' },
  expression: { type: 'string', enum: ['neutral', 'attentive', 'confused', 'wary', 'excited'] },
};
const exerciseProperty = { type: 'object', properties: { problem: { type: 'string' }, steps: { type: 'array', minItems: 2, maxItems: 10, items: { type: 'string' } }, conclusion: { type: 'string' } }, required: ['problem', 'steps', 'conclusion'], additionalProperties: false };
const paperProperty = { type: 'object', properties: { exercises: { type: 'array', minItems: 3, maxItems: 3, items: exerciseProperty } }, required: ['exercises'], additionalProperties: false };
function makePaper(value) {
  if (!Array.isArray(value?.exercises) || value.exercises.length !== 3) throw new Error('The model returned an incomplete worked solution. Please retry.');
  const papers = value.exercises.map((exercise, index) => {
    if (typeof exercise?.problem !== 'string' || !exercise.problem.trim() || typeof exercise.conclusion !== 'string' || !exercise.conclusion.trim() || !Array.isArray(exercise.steps) || exercise.steps.length < 2 || exercise.steps.length > 10 || exercise.steps.some(step => typeof step !== 'string' || !step.trim())) throw new Error('The model returned an incomplete worked solution. Please retry.');
    const markdown = withoutEmDashes(`# Classroom exercise ${index + 1}\n\n## Problem\n\n${exercise.problem}\n\n## My proposed solution\n\n${exercise.steps.map((step, i) => `### Step ${i + 1}\n\n${step}`).join('\n\n')}\n\n## Final answer\n\n${exercise.conclusion}`);
    return { id: randomUUID(), markdown, problem: withoutEmDashes(exercise.problem), steps: exercise.steps.map(withoutEmDashes), conclusion: withoutEmDashes(exercise.conclusion) };
  });
  const markdown = papers.map((paper, index) => `# Paper ${index + 1}\n\n${paper.markdown}`).join('\n\n');
  if (markdown.length > 30000) throw new Error('The worked solution is too long. Please retry.');
  return { id: randomUUID(), markdown, papers };
}
function messageText(m) {
  return m.content + (m.paper ? `\n\n[Submitted classroom paper, ID: ${m.paper.id}]\n${m.paper.markdown}` : '') + (m.review ? `\n\n[Paper review: ${m.review.grades ? m.review.grades.map((grade, i) => `Paper ${i + 1}: ${grade.grade}${grade.selectedSteps.length ? `; marked steps ${grade.selectedSteps.join(', ')}` : ''}`).join('; ') : m.review.grade}]\n${m.review.explanation}` : '') + (m.boardImage ? '\n\n[Whiteboard image]' : '');
}
function boardBlock(image) {
  return { type: 'image', mimeType: 'image/png', data: image.slice('data:image/png;base64,'.length) };
}
function conversation(messages) {
  return messages.map(m => ({ role: m.role, content: m.boardImage ? [{ type: 'text', text: messageText(m) }, boardBlock(m.boardImage)] : messageText(m) }));
}
const withoutEmDashes = text => text.replace(/\s*—\s*/g, ', ');
const evidenceProperty = { type: 'array', items: { type: 'object', properties: { messageIndex: { type: 'integer' }, quote: { type: 'string' } }, required: ['messageIndex', 'quote'], additionalProperties: false } };
const judgmentProperties = { status: { type: 'string', enum: statuses }, result: { type: 'string', enum: resultKinds }, evidence: evidenceProperty };
const assessmentProperties = {
  reason: { type: 'string' },
  nextQuestionFocus: { type: 'string' },
  criteria: { type: 'array', items: { type: 'object', properties: { aspect: { type: 'string' }, ...judgmentProperties }, required: ['aspect', ...Object.keys(judgmentProperties)], additionalProperties: false } },
  task: { type: 'object', properties: judgmentProperties, required: Object.keys(judgmentProperties), additionalProperties: false },
};
function tool(name, properties) {
  return { name, description: 'Return your response to the application using this tool.', schema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } };
}
export function validate(body) {
  if (!body || !Object.hasOwn(rubrics, body.level) || Object.hasOwn(body, 'mode')) throw new Error('Choose a valid level without an assessment mode.');
  const learningType = resolveLearningType(body.learningType);
  if (typeof body.topic !== 'string' || !body.topic.trim() || body.topic.length > 300) throw new Error('Enter a topic of up to 300 characters.');
  if (!Array.isArray(body.aspects) || !body.aspects.length || body.aspects.length > 20 || body.aspects.some(x => typeof x !== 'string' || !x.trim() || x.length > 1000)) throw new Error('Provide 1–20 required aspects, up to 1,000 characters each.');
  if (body.criterion !== undefined && (typeof body.criterion !== 'string' || !body.criterion.trim() || body.criterion.length > 1000)) throw new Error('Provide a rubric criterion of up to 1,000 characters.');
  if (!Array.isArray(body.messages) || body.messages.length > 100 || body.messages.some((m, i) => m.role !== (i % 2 === 0 ? 'assistant' : 'user') || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000)) throw new Error('Invalid conversation or conversation limit reached.');
  if (body.messages.length && body.messages.at(-1).role !== 'user') throw new Error('The conversation must end with a student message.');
  let latestPaper;
  for (const m of body.messages) {
    if (m.boardImage !== undefined) {
      if (m.role !== 'user' || typeof m.boardImage !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(m.boardImage) || m.boardImage.length > 2_800_000) throw new Error('Invalid whiteboard image.');
      const bytes = Buffer.from(m.boardImage.slice('data:image/png;base64,'.length), 'base64');
      if (bytes.length > 2_000_000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid whiteboard image.');
    }
    if (m.paper !== undefined) {
      if (learningType !== 'quantitative' || body.level !== 'analyze' || m.role !== 'assistant' || !m.paper || typeof m.paper.id !== 'string' || !m.paper.id || typeof m.paper.markdown !== 'string' || !m.paper.markdown.trim() || m.paper.markdown.length > 30000 || (m.paper.papers !== undefined && (!Array.isArray(m.paper.papers) || m.paper.papers.length !== 3 || m.paper.papers.some(p => typeof p.id !== 'string' || !p.id || typeof p.markdown !== 'string' || !p.markdown.trim() || !Array.isArray(p.steps) || p.steps.length < 2 || p.steps.length > 10)))) throw new Error('Invalid classroom paper.');
      latestPaper = m.paper.id;
    }
    if (m.review !== undefined) {
      const review = m.review;
      if (learningType !== 'quantitative' || m.role !== 'user' || !review || !latestPaper || review.paperId !== latestPaper || typeof review.explanation !== 'string' || review.explanation.length > 10000) throw new Error('Invalid paper review.');
      const papers = body.messages.findLast(item => item.paper)?.paper?.papers;
      if (papers?.length) {
        if (!Array.isArray(review.grades) || review.grades.length !== papers.length || review.grades.some((grade, index) => grade.paperId !== papers[index].id || !['pass', 'fail'].includes(grade.grade) || !Array.isArray(grade.selectedSteps) || grade.selectedSteps.some(n => !Number.isInteger(n) || n < 1 || n > papers[index].steps?.length) || (grade.grade === 'fail' && !grade.selectedSteps.length) || (grade.grade === 'pass' && grade.selectedSteps.length))) throw new Error('Sort every paper; a Fail grade requires a marked step.');
      } else if (!['pass', 'fail'].includes(review.grade) || (review.grade === 'fail' && (!Array.isArray(review.selectedSteps) || !review.selectedSteps.length || review.selectedSteps.some(n => !Number.isInteger(n) || n < 1 || n > 10)))) throw new Error('A Fail grade requires at least one marked step on the current paper.');
    }
  }
  return body;
}
function fileContent(file) {
  if (!file || typeof file.data !== 'string' || file.data.length > 7_000_000) throw new Error('Upload a file smaller than 5 MB.');
  const bytes = Buffer.from(file.data, 'base64');
  if (!bytes.length || bytes.length > 5_000_000) throw new Error('Choose a file smaller than 5 MB.');
  const type = typeof file.type === 'string' ? file.type : '';
  if (bytes.subarray(0, 4).toString() === '%PDF') return [{ type: 'document', mimeType: 'application/pdf', data: file.data }];
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return [{ type: 'image', mimeType: 'image/png', data: file.data }];
  if (bytes.subarray(0, 3).toString('hex') === 'ffd8ff') return [{ type: 'image', mimeType: 'image/jpeg', data: file.data }];
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return [{ type: 'image', mimeType: 'image/webp', data: file.data }];
  if (bytes.subarray(0, 4).toString('hex') === '504b0304') return [{ type: 'text', text: extractArchiveText(bytes) }];
  else {
    const extracted = bytes.subarray(0, 100000).toString('utf8');
    const replacementRate = (extracted.match(/�/g) || []).length / Math.max(extracted.length, 1);
    if (bytes.includes(0) || replacementRate > 0.02) throw new Error('Could not read text from this file. Try a PDF, image, Office file, or text-based file.');
    const plain = type === 'text/html' || /^\s*</.test(extracted) ? extracted.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ') : extracted;
    return [{ type: 'text', text: plain.slice(0, 50000) }];
  }
}
function contentsFromFiles(files) {
  if (!Array.isArray(files) || !files.length || files.reduce((sum, file) => sum + (typeof file?.data === 'string' ? Buffer.from(file.data, 'base64').length : 0), 0) > 5_000_000) throw new Error('Upload files totaling less than 5 MB.');
  return files.flatMap(file => [{ type: 'text', text: `Source file: ${String(file.name || 'Untitled').slice(0, 200)}` }, ...fileContent(file)]);
}
const levels = ['remember', 'understand', 'apply', 'analyze'];
function normalizeGeneratedRubrics(concepts) {
  if (!Array.isArray(concepts)) return;
  for (const concept of concepts) {
    for (const level of levels) {
      const items = concept?.rubric?.[level];
      if (!Array.isArray(items)) continue;
      if (items.length > 20 || items.some(item => typeof item !== 'string' || !item.trim() || /[\r\n]/.test(item))) throw new Error('Could not generate a complete rubric. Please retry.');
      concept.rubric[level] = checklistText(items.map(item => item.trim()));
    }
  }
}

export async function conceptsFromStudyTest(file, query, prompts = loadPrompts()) {
  const learningType = resolveLearningType(file?.learningType);
  const content = fileContent(file);
  const schema = { concepts: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', properties: { name: { type: 'string' }, rubric: { type: 'object', properties: Object.fromEntries(levels.map(level => [level, { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 1000 } }])), required: levels, additionalProperties: false } }, required: ['name', 'rubric'], additionalProperties: false } } };
  const system = prompts.text('rubric.extractConcepts', { curriculumContext: prompts.text('rubric.curriculumContext'), writingGuidance: prompts.text('rubric.writingGuidance'), learningTypeGuidance: prompts.text('profile.' + learningType + '.rubricGuidance') });
  const result = await query(system, [{ role: 'user', content: [{ type: 'text', text: prompts.text('rubric.extractRequest') }, ...content] }], tool('extract_concepts', schema));
  const concepts = result?.concepts;
  normalizeGeneratedRubrics(concepts);
  if (!Array.isArray(concepts) || !concepts.length || concepts.length > 20 || concepts.some(x => typeof x?.name !== 'string' || !x.name.trim() || x.name.length > 300 || !x.rubric || levels.some(level => typeof x.rubric[level] !== 'string' || !x.rubric[level].trim() || x.rubric[level].length > 1000))) throw new Error('Could not generate a complete rubric from this file. Please retry or enter it manually.');
  return concepts.map(x => ({ name: x.name.trim(), rubric: Object.fromEntries(levels.map(level => [level, x.rubric[level].trim()])) }));
}

export async function suggestConceptsFromFiles(files, query, selectedType, prompts = loadPrompts()) {
  const learningType = resolveLearningType(selectedType);
  const content = contentsFromFiles(files);
  const result = await query(prompts.text('rubric.suggestConcepts', { curriculumContext: prompts.text('rubric.curriculumContext'), learningTypeGuidance: prompts.text('profile.' + learningType + '.rubricGuidance') }), [{ role: 'user', content: [{ type: 'text', text: prompts.text('rubric.suggestRequest') }, ...content] }], tool('suggest_concepts', { names: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string' } } }));
  if (!Array.isArray(result?.names) || !result.names.length || result.names.length > 20 || result.names.some(name => typeof name !== 'string' || !name.trim() || name.length > 300)) throw new Error('Could not generate concept names. Please retry.');
  return [...new Set(result.names.map(name => name.trim()))];
}

export async function generateLevelRubric(input, query, prompts = loadPrompts()) {
  const learningType = resolveLearningType(input?.learningType);
  if (!input || !levels.includes(input.level)) throw new Error('Choose a valid learning level.');
  if (typeof input.topic !== 'string' || !input.topic.trim() || input.topic.length > 300) throw new Error('Enter a concept of up to 300 characters.');
  const system = prompts.text('rubric.generateLevel', {
    curriculumContext: prompts.text('rubric.curriculumContext'),
    writingGuidance: prompts.text('rubric.writingGuidance'),
    learningTypeGuidance: prompts.text('profile.' + learningType + '.rubricGuidance'),
    level: input.level,
  });
  const result = await query(system, [{ role: 'user', content: JSON.stringify({ concept: input.topic.trim(), level: input.level }) }], tool('generate_rubric', {
    items: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 1000 } },
  }));
  if (!Array.isArray(result?.items) || !result.items.length || result.items.length > 8 || result.items.some(item => typeof item !== 'string' || !item.trim() || /[\r\n]/.test(item)) || checklistText(result.items.map(item => item.trim())).length > 1000) throw new Error('Could not generate rubric items. Please retry.');
  return { items: result.items.map(item => item.trim()) };
}

export async function generateRubric(input, query, prompts = loadPrompts()) {
  const learningType = resolveLearningType(input?.learningType);
  if (!Array.isArray(input?.concepts) || !input.concepts.length || input.concepts.length > 20 || input.concepts.some(concept => typeof concept?.name !== 'string' || !concept.name.trim() || concept.name.length > 300 || !levels.includes(concept.target))) throw new Error('Choose 1–20 named concepts and learning levels.');
  if (input.additionalInstructions !== undefined && (typeof input.additionalInstructions !== 'string' || input.additionalInstructions.length > 5000)) throw new Error('Enter additional rubric instructions of up to 5,000 characters.');
  const previousRubric = input.previousRubric ?? [];
  if (!Array.isArray(previousRubric) || previousRubric.length > 20 || previousRubric.some(item => typeof item?.name !== 'string' || !item.name.trim() || item.name.length > 300 || !item.rubric || levels.some(level => typeof item.rubric[level] !== 'string' || item.rubric[level].length > 1000))) throw new Error('Enter a valid previously generated rubric.');
  // Keep direct API callers within the same five-concept model output limit.
  if (input.concepts.length > 5) {
    const generated = [];
    for (let offset = 0; offset < input.concepts.length; offset += 5) {
      generated.push(...await generateRubric({ ...input, concepts: input.concepts.slice(offset, offset + 5), previousRubric: [...previousRubric, ...generated] }, query, prompts));
    }
    return generated;
  }
  const additionalInstructions = input.additionalInstructions?.trim();
  const files = input.files || [];
  const content = files.length ? contentsFromFiles(files) : [];
  const schema = { concepts: { type: 'array', minItems: input.concepts.length, maxItems: input.concepts.length, items: { type: 'object', properties: { name: { type: 'string' }, rubric: { type: 'object', properties: Object.fromEntries(levels.map(level => [level, { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 1000 } }])), required: levels, additionalProperties: false } }, required: ['name', 'rubric'], additionalProperties: false } } };
  const system = prompts.text('rubric.generate', { curriculumContext: prompts.text('rubric.curriculumContext'), writingGuidance: prompts.text('rubric.writingGuidance'), learningTypeGuidance: prompts.text('profile.' + learningType + '.rubricGuidance'), grounding: files.length ? prompts.text('rubric.groundInFiles') : prompts.text('rubric.groundInKnowledge') });
  const batchSystem = previousRubric.length ? `${system}\nThe previousRubric contains completed concepts from earlier batches. Use it as context for consistent scope and criteria. Return only the requested concepts, in their given order; do not repeat or revise the previous rubric.` : system;
  const result = await query(batchSystem, [{ role: 'user', content: [{ type: 'text', text: JSON.stringify({ concepts: input.concepts, ...(previousRubric.length ? { previousRubric } : {}), ...(additionalInstructions ? { additionalInstructions } : {}) }) }, ...content] }], tool('generate_rubric', schema));
  normalizeGeneratedRubrics(result?.concepts);
  if (!Array.isArray(result?.concepts) || result.concepts.length !== input.concepts.length || result.concepts.some((item, index) => item?.name !== input.concepts[index].name || !item.rubric || levels.some((level, i) => typeof item.rubric[level] !== 'string' || item.rubric[level].length > 1000 || (i <= levels.indexOf(input.concepts[index].target) && !item.rubric[level].trim())))) throw new Error('Could not generate a complete rubric. Please retry.');
  return result.concepts.map((item, index) => ({ name: item.name, rubric: Object.fromEntries(levels.map((level, i) => [level, i <= levels.indexOf(input.concepts[index].target) ? item.rubric[level].trim() : ''])) }));
}

function assessment(result, aspects, messages, level, reviewIndex = -1) {
  const validShape = c => c && statuses.includes(c.status) && resultKinds.includes(c.result) && Array.isArray(c.evidence) && c.evidence.every(e => Number.isInteger(e?.messageIndex) && typeof e.quote === 'string');
  if (typeof result?.reason !== 'string' || !Array.isArray(result.criteria) || result.criteria.length !== aspects.length || result.criteria.some((c, i) => c.aspect !== aspects[i] || !validShape(c)) || !validShape(result.task)) throw new Error('Invalid assessment response. Please retry.');
  const normalize = c => {
    const evidence = c.evidence.flatMap(e => {
      if (!e.quote.trim()) return [];
      const matches = messages.flatMap((m, i) => m.role === 'user' && `${m.content}\n${m.review?.explanation || ''}${m.boardImage ? '\n[Whiteboard image]' : ''}`.includes(e.quote) ? [i] : []);
      if (!matches.length) return [];
      return [{ messageIndex: matches.includes(e.messageIndex) ? e.messageIndex : matches.at(-1), quote: e.quote }];
    });
    return { status: c.status === 'supported' && (!evidence.length || !['correct', 'not_applicable'].includes(c.result)) ? 'needs_clarification' : c.status, result: c.result, evidence };
  };
  const criteria = result.criteria.map(c => ({ aspect: c.aspect, ...normalize(c) }));
  const task = normalize(result.task);
  if (level === 'remember' && task.status !== 'flawed' && criteria.every(c => c.status === 'supported')) {
    task.status = 'supported';
    task.result = 'not_applicable';
    task.evidence = criteria.flatMap(c => c.evidence);
  }
  if (reviewIndex >= 0 && task.status === 'supported' && !task.evidence.some(e => e.messageIndex > reviewIndex)) task.status = 'needs_clarification';
  return { reason: withoutEmDashes(result.reason), nextQuestionFocus: typeof result.nextQuestionFocus === 'string' ? result.nextQuestionFocus.trim() : '', criteria, task, complete: criteria.every(c => c.status === 'supported') && task.status === 'supported' };
}
function reconcile(first, second) {
  const criteria = first.criteria.map((c, i) => c.status === second.criteria[i].status ? c : { ...c, status: 'needs_clarification' });
  const task = first.task.status === second.task.status ? first.task : { ...first.task, status: 'needs_clarification' };
  const complete = criteria.every(c => c.status === 'supported') && task.status === 'supported';
  return { ...first, criteria, task, nextQuestionFocus: complete ? '' : second.nextQuestionFocus || first.nextQuestionFocus, reason: complete ? first.reason : 'I need a little more evidence before finishing.', complete };
}
function followUpFocus(checked, prompts) {
  const target = checked.criteria.find(c => c.status !== 'supported') || (checked.task.status !== 'supported' ? { aspect: 'the overall task', status: checked.task.status } : null);
  if (!target) return '';
  const focus = checked.nextQuestionFocus || target.aspect;
  const instruction = target.status === 'flawed' ? prompts.text('chat.focusFlawed') : prompts.text('chat.focusMissing');
  return prompts.text('chat.followUpFocus', { focus: JSON.stringify(focus), instruction: instruction });
}
export async function chat(input, query, prompts = loadPrompts()) {
  const { level, topic, messages, criterion } = validate(input);
  const learningType = resolveLearningType(input.learningType);
  const profile = { ...learningTypes[learningType], ...prompts.profile(learningType) };
  const paperAnalysis = level === 'analyze' && learningType === 'quantitative';
  const openingScenario = !messages.length && needsScenarioOpening(level, learningType);
  const levelRubric = level === 'remember' || level === 'understand' || learningType === 'quantitative' ? prompts.text('chat.rubric.' + level) : profile.tasks[level];
  // Numbered rubric boxes are authoritative, including for older API callers.
  const aspects = criterion && /^\s*1[.)]\s/m.test(criterion) ? checklistItems(criterion) : input.aspects;
  if (!aspects.length || aspects.length > 20) throw new Error('Provide 1–20 checklist items.');
  const context = prompts.text('chat.context', { learningTypeLabel: profile.label, level: level, curriculum: JSON.stringify({ topic, aspects, criterion: criterion || null }) });
  if (!messages.length && level !== 'analyze' && !openingScenario) return { message: withoutEmDashes(level === 'remember' ? prompts.text('chat.openingRemember', { topic: topic }) : prompts.text('chat.openingOther', { topic: topic })), assessment: null, expression: 'attentive' };
  const latestPaper = messages.findLast(m => m.paper)?.paper;
  const reviewIndex = latestPaper ? messages.findIndex(m => m.review?.paperId === latestPaper.id) : -1;
  const review = reviewIndex >= 0 ? messages[reviewIndex].review : null;
  const needsPaper = paperAnalysis && !latestPaper;
  if (paperAnalysis && review && messages.at(-1)?.review?.paperId === latestPaper.id) {
    const hasMarkedSteps = review.grades ? review.grades.some(grade => grade.selectedSteps.length) : Boolean(review.selectedSteps?.length);
    return { message: hasMarkedSteps ? prompts.text('chat.reviewFail') : prompts.text('chat.reviewPass'), assessment: null, expression: 'confused' };
  }
  const transcript = [{ role: 'user', content: prompts.text('chat.beginSession') }, ...conversation(messages)];
  let checked = null;
  if (messages.length && (!paperAnalysis || review)) {
    const evaluatorSystem = prompts.text('chat.evaluator', { context: context, levelRubric: levelRubric, levelHelp: profile.help[level], quantitativeTask: level === 'apply' && learningType === 'quantitative' ? profile.tasks.apply : '', stageEvidence: !paperAnalysis ? prompts.text('chat.stageEvidence') : '' });
    const evaluatorContent = [{ type: 'text', text: JSON.stringify(messages.map((m, messageIndex) => ({ messageIndex, role: m.role, content: messageText(m) }))) }];
    messages.forEach((m, messageIndex) => { if (m.boardImage) evaluatorContent.push({ type: 'text', text: `Whiteboard image for messageIndex ${messageIndex}:` }, boardBlock(m.boardImage)); });
    const evaluatorMessages = [{ role: 'user', content: evaluatorContent.length === 1 ? evaluatorContent[0].text : evaluatorContent }];
    checked = assessment(await query(evaluatorSystem, evaluatorMessages, tool('evaluate_learning', assessmentProperties)), aspects, messages, level, -1);
    if (checked.complete || checked.criteria.some(c => c.status === 'flawed' && c.result === 'correct') || (checked.task.status === 'flawed' && checked.task.result === 'correct')) {
      const second = assessment(await query(prompts.text('chat.secondAssessment', { evaluatorSystem: evaluatorSystem }), evaluatorMessages, tool('evaluate_learning', assessmentProperties)), aspects, messages, level, -1);
      checked = reconcile(checked, second);
    }
    if (paperAnalysis) {
      const judgments = [...checked.criteria, checked.task];
      const points = { supported: 100, needs_clarification: 50, flawed: 0, missing: 0 };
      const grade = Math.round(judgments.reduce((sum, item) => sum + points[item.status], 0) / judgments.length);
      const summaryResponse = await query(prompts.text('chat.finalReport', { context: context }), [{ role: 'user', content: JSON.stringify({ assessment: checked, transcript: messages.map(messageText) }) }], tool('summarize_learning', { summary: { type: 'string' } }));
      if (typeof summaryResponse?.summary !== 'string' || !summaryResponse.summary.trim()) throw new Error('Could not summarize the learning. Please retry.');
      return { message: 'Your learning report is ready.', assessment: checked, expression: 'excited', finalSummary: withoutEmDashes(summaryResponse.summary.trim()), analysisGrade: grade };
    }
    if (checked.complete) return { message: 'Thank you for teaching me!', assessment: checked, expression: 'excited' };
  }
  const responseSystem = prompts.text('chat.response', { context: context, classroomRole: prompts.text('chat.classroomRole'), paperInstructions: needsPaper ? prompts.text('chat.submitPapers') : paperAnalysis ? prompts.text('chat.discussPapers') : '', scenarioInstructions: needsScenarioOpening(level, learningType) ? openingScenario ? prompts.text('chat.openScenario', { scenario: profile.scenarios[level] }) : prompts.text('chat.continueScenario', { task: profile.tasks[level] }) : '', followUp: checked ? followUpFocus(checked, prompts) : '' });
  const responseTool = tool('respond_to_student', { ...responseProperties, ...(needsPaper ? { paper: paperProperty } : {}) });
  let result;
  let paper = null;
  const previousQuestion = messages.findLast(m => m.role === 'assistant')?.content;
  for (let attempt = 0; attempt < (needsPaper ? 3 : 2); attempt++) {
    const retryInstruction = needsPaper ? prompts.text('chat.retryPaper') : prompts.text('chat.retryQuestion', { previousQuestion: JSON.stringify(previousQuestion) });
    result = await query(attempt ? `${responseSystem}\n${retryInstruction}` : responseSystem, transcript, responseTool);
    if (!needsPaper && attempt === 0 && typeof result?.message === 'string' && previousQuestion && result.message.trim().toLocaleLowerCase() === previousQuestion.trim().toLocaleLowerCase()) continue;
    if (!needsPaper) break;
    try { paper = makePaper(result?.paper); break; }
    catch (error) {
      if (attempt === 2 || !/incomplete worked solution|worked solution is too long/.test(error.message)) throw error;
    }
  }
  if (typeof result.message !== 'string' || !result.message.trim() || result.message.length > 12000) throw new Error('The model returned an empty message. Please retry.');
  if (!paper && previousQuestion && result.message.trim().toLocaleLowerCase() === previousQuestion.trim().toLocaleLowerCase()) throw new Error('The model repeated its previous question. Please retry.');
  return { paper, message: paper ? 'I tried three exercises and wrote out my steps. Could you grade each paper Pass or Fail?' : withoutEmDashes(result.message), expression: responseProperties.expression.enum.includes(result.expression) ? result.expression : 'attentive', assessment: checked };
}
