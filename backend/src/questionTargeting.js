import { InvalidOutputError } from './structuredOutput.js';

export const targetedQuestionInstructions = 'Every question must identify one concrete claim, relationship, assumption, quantity, step, or scenario condition to investigate. Ask directly about that point. Never ask the student to walk or talk you through their reasoning, explain their thinking generally, elaborate, or tell you more. Mentioning a topic in a preamble does not make a generic question targeted. Ask what changes, what causes a stated outcome, how two named quantities relate, or what a specific student phrase means, without supplying the answer or treating a suspected misconception as established.';

// Reject common generic requests even when preceded by a topic-specific sentence.
// This is a guardrail, not a complete semantic judgment of question quality.
export function assertTargetedQuestion(message) {
  const text = message.toLowerCase().replace(/[’‘]/g, "'");
  const walkThrough = /\b(?:walk|talk|take|guide)\b[^.!?]{0,60}\bthrough\b/;
  const generalReasoning = /\b(?:explain|describe|share|clarify|outline|expand on|elaborate on)\s+(?:(?:your|the|that|this)\s+)?(?:reasoning|thinking|thought process|logic|steps|approach)\b/;
  const vagueRequest = /\b(?:tell me more|(?:can|could|would|will) you (?:please )?elaborate|(?:can|could|would|will) you (?:please )?(?:explain|clarify|expand on) (?:that|this|it))\s*[?.!]?\s*$/;
  const vagueWhy = /\b(?:why (?:do you|would you) (?:think|say|believe) (?:that|so)|how did you (?:get|arrive at|reach|come to) (?:that|this|your) (?:answer|conclusion)|what makes you (?:think|say|believe) (?:that|so))\s*[?.!]?\s*$/;
  if ([walkThrough, generalReasoning, vagueRequest, vagueWhy].some(pattern => pattern.test(text))) throw new InvalidOutputError('The question asks for generic reasoning. Replace it with one question naming the specific claim, relationship, assumption, or scenario condition to investigate.');
}
