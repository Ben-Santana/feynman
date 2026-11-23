// Per-turn guidance for the classmate's reply, drawn from the evaluator's
// judgment rather than from another model call. It changes how the classmate
// responds, never what counts as demonstrated.
import { rubricAttempts } from '../../frontend/src/rubricFallback.js';

// Stable rules, placed before the prompt cache boundary.
export const answerFormInstructions = 'Say what a complete answer needs. When the requirement you are asking about needs a particular form of answer or work (an exact value, a decimal approximation, both, an error bound, the working shown, a boundary or special case checked, a reason), ask for that form in the same question, in plain words. Never ask afterwards for a form your question did not request as if the teacher had left it out: if another form is still needed, say it is one more thing you would like to see.';

export const conventionInstructions = 'Counting and indexing. "How many terms" and "the index of the last term" are different questions, most visibly when a series starts at index zero. When your question involves a count, an index, or a starting point, say which one you mean and where the index starts. When the teacher states their own convention, adopt it.';

export const alreadyAnsweredInstructions = 'Before you ask, check your question against every message the teacher has sent, not only the latest. One answer often covers several things at once, such as both of two cases. If the teacher has already explained what you are about to ask, even briefly or inside a longer answer, do not ask it again in any wording. Ask only for something that is genuinely absent.';

// Added to the evaluator so hidden expectations and conventions cannot fail a correct answer.
export const evaluatorFairnessInstructions = '\nBefore leaving any definition missing or unclear, re-read every learner message for it. When one learner message covers several cases or parts at once (for example both of two named cases), credit every definition it satisfies. Never set a nextEvidenceObjective that asks for something a learner message already states correctly.\nAnswer form: require an exact value, a decimal approximation, an error bound, or another particular form of a result only when the rubric item or the question the learner was answering asks for it in words. Otherwise accept any correct, equivalent form, and do not hold an item open only because the learner chose one valid form over another. This concerns the form of a result only: reasoning the rubric requires stays required.\nConventions: "number of terms" and "index of the last term" are different quantities, especially for a series indexed from zero. Judge an answer under the convention the learner states or the question set, and accept every equivalent correct convention. An answer whose convention is unstated and that is correct under a reasonable one is unclear, to be asked about, never incorrect.';

// Which of three situations the latest answer is in. Null when none clearly applies.
export function feedbackKind({ messages, checked, target, contradicted = false }) {
  if (!checked || !messages.length) return null;
  const latest = messages.length - 1;
  const cited = item => item?.evidence?.some(evidence => evidence.messageIndex === latest);
  if (target && (target.status === 'flawed' || contradicted)) return 'mistake';
  const asked = messages.at(-2)?.rubricFocus;
  const askedItem = checked.criteria.find(item => item.aspect === asked);
  const settled = askedItem ? askedItem.status === 'supported' && !askedItem.skipped : checked.criteria.some(item => item.status === 'supported' && !item.skipped && cited(item));
  if (settled && target?.aspect !== asked) return 'new_question';
  if (target && (target.status === 'needs_clarification' || cited(target))) return 'incomplete';
  return null;
}

const shared = ' This replaces the tone rules about confirmations for this message: naming the part you now follow is expected here. Still use no grading words such as "correct", "right", "great", or "well done".';

export function feedbackInstruction(kind) {
  if (kind === 'mistake') return `\nHow to respond this time: something specific the teacher said does not hold up. Make it unmistakable that this is about a statement they made that needs another look, not about a detail they left out: quote or name that one statement and ask them to check it. If other parts of the same answer were fine, say in a few words which part you follow, so they know what they do not need to redo. Do not state or hint at the correction. Do not open with "I still can't see" or "I still don't".${shared}`;
  if (kind === 'incomplete') return `\nHow to respond this time: the teacher's latest answer holds up as far as it goes, and one piece is still absent. First name, in a few of their own words, the part you now follow. Then ask only for the absent piece and say what kind of thing it is (a reason, a condition, a case, a value, a form of the answer). Nothing in your message may suggest that what they said was wrong. Do not open with "I still can't see" or "I still don't".${shared}`;
  if (kind === 'new_question') return `\nHow to respond this time: the teacher's latest answer settled what you asked. Say so by naming, in a few words, what you now follow. Then make it obvious that you are moving to a different point, with a short phrase of your own such as "Separate thing:" or "Next I'm wondering about", and ask it. Do not word the new question as if something about the previous one were still unclear, and do not use "I still can't see" or "I still don't".${shared}`;
  return '';
}

// Two answers about the same point that still do not hold up: repeating the
// request has stopped helping, so point at where to look instead.
export function needsHint(messages, target, contradicted = false) {
  if (!target?.aspect || !(target.status === 'flawed' || contradicted)) return false;
  return rubricAttempts(messages, target.aspect) >= 2;
}

export const hintInstruction = '\nThe teacher has now answered this point more than once and it still does not hold up. Do not ask for the same thing again, and do not merely reword your earlier question. Give one targeted nudge, the way a classmate would: point to one specific feature, case, or property of the task that their answer does not account for, and ask what it tells them (for example a particular input to try, a feature of the graph or setup to look at, or two things to compare). The nudge may say where to look. It must not state the answer, the correct name, a formula, or a value, and must not offer choices to pick from. For this message only, this replaces the rule against giving hints.';

export function demonstratedInstruction(checked) {
  const done = (checked?.criteria || []).filter(item => item.status === 'supported' && !item.skipped).map(item => item.aspect);
  return done.length ? `\nAlready demonstrated, so out of scope for questions: ${JSON.stringify(done)}. Do not ask about these or any part of them again, even if the evaluator's objective mentions them.` : '';
}

const stopWords = new Set('a an and are as at be but by can could did do does for from had has have how i if in is it its me my of on or so that the then there this to was were what when where which who why will with would you your'.split(' '));
const contentWords = text => new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 1 && !stopWords.has(word)));

// A reworded repeat of something already asked. Exact repeats are caught separately.
export function repeatedQuestion(message, earlierQuestions) {
  const next = contentWords(message);
  if (next.size < 4) return null;
  return earlierQuestions.find(earlier => {
    const previous = contentWords(earlier);
    if (previous.size < 4) return false;
    const shared = [...next].filter(word => previous.has(word)).length;
    return shared / (next.size + previous.size - shared) >= 0.8;
  }) ?? null;
}
