import { InvalidOutputError } from './structuredOutput.js';

export const questionIntegrityInstructions = `Keep assessed knowledge out of the question: give only necessary observable facts and task givens, never a definition, formula, computational procedure, causal link, correct alternative, or interpretation that the student is being asked to supply. Existing statements are not automatically safe hints: do not restate the missing link even if it occurs elsewhere in the transcript. Ask the learner to choose the relationship or method themselves. Do not add corrective contrasts such as 'rather than impose the expected count'. Treat disputed claims as attributed hypotheses: ask 'What makes you think [claim]?' or 'In your account, how are [named quantities] related?' Never ask 'Why does X establish/rule out/guarantee Y?' when that implication is the suspected misconception; this grammatically assumes it is true. Do not smuggle the correction into a skeptical preamble. At Remember elicit the actual name or fact, not whether one was given. Preserve the supported level: recall at Remember, existing relationships at Understand, use of a method at Apply, and examination of relationships or assumptions at Analyze.`;

export const targetedQuestionInstructions = 'Every question must identify one concrete claim, relationship, assumption, quantity, step, or scenario condition to investigate. Ask directly about that point. Never ask the student to walk or talk you through their reasoning, explain their thinking generally, elaborate, or tell you more. Mentioning a topic in a preamble does not make a generic question targeted. Ask what changes, what causes a stated outcome, how two named quantities relate, or what a specific student phrase means, without supplying the answer or treating a suspected misconception as established.';

// Reject common generic requests even when preceded by a topic-specific sentence.
// This is a guardrail, not a complete semantic judgment of question quality.
export function assertTargetedQuestion(message) {
  const text = message.toLowerCase().replace(/[â€™â€˜]/g, "'");
  const walkThrough = /\b(?:walk|talk|take|guide)\b[^.!?]{0,60}\bthrough\b/;
  const generalReasoning = /\b(?:explain|describe|share|clarify|outline|expand on|elaborate on)\s+(?:(?:your|the|that|this)\s+)?(?:reasoning|thinking|thought process|logic|steps|approach)\b/;
  const vagueRequest = /\b(?:tell me more|(?:can|could|would|will) you (?:please )?elaborate|(?:can|could|would|will) you (?:please )?(?:explain|clarify|expand on) (?:that|this|it))\s*[?.!]?\s*$/;
  const vagueWhy = /\b(?:why (?:do you|would you) (?:think|say|believe) (?:that|so)|how did you (?:get|arrive at|reach|come to) (?:that|this|your) (?:answer|conclusion)|what makes you (?:think|say|believe) (?:that|so))\s*[?.!]?\s*$/;
  if ([walkThrough, generalReasoning, vagueRequest, vagueWhy].some(pattern => pattern.test(text))) throw new InvalidOutputError('The question asks for generic reasoning. Replace it with one question naming the specific claim, relationship, assumption, or scenario condition to investigate.');
}

// Conservative wording checks supplement the semantic suitability review. They
// catch supplied solution scaffolds and factive framing, not scientific truth.
export function assertQuestionIntegrity(message) {
  const value = message.replace(/[’‘]/g, "'");
  const suppliedMethod = /\b(?:the (?:relationship|formula|equation) is|when you isolate|showing the division you use|rather than impose the expected count|when you check .{1,60} by dividing)\b/i;
  const factiveInference = /\b(?:why does|how does|what makes)\b[^?]{0,160}\b(?:establish that|rule out|lead to a guaranteed|mean appropriate for)\b/i;
  if (suppliedMethod.test(value)) throw new InvalidOutputError('The question supplies a relationship, procedure, or corrective hint. Give observable facts only and ask the learner to choose the relationship or method.');
  if (factiveInference.test(value)) throw new InvalidOutputError('The question presupposes a disputed implication. Attribute the claim to the learner and ask what supports it without asserting or correcting it.');
}
