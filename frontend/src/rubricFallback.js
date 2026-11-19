// Shared policy for the chat UI and API. No model call is needed to unlock support.
export const RUBRIC_SKIP_AFTER = 6;
const substantiveReply = message => message.role === 'user' && !message.skipRubricItem && !message.helpRequest && !message.finishAssessment && !message.review;

// Wider phrases seen in real chats: insults at the classmate and "I already said this".
const broadFrustration = /\b(?:are you (?:dumb|stupid|slow|serious|kidding|even listening)|wast(?:e|ing) (?:of )?my time|how do you not (?:understand|get)|keep up|(?:as|like) i(?:'ve| have)?(?: just| already)? (?:said|told|mentioned|pointed out)|i(?:'ve| have)? (?:already|just) (?:said|told|answered|explained)|i keep (?:saying|telling|pointing)|(?:twice|three times|again and again) now|which i said|bad review)\b/i;

export function asksForClarity(content) {
  return /\b(?:re-?word|re-?phrase|say (?:that|it) (?:again|differently)|what (?:do|are) you (?:want|need|asking|mean|looking for)|point out (?:the|your) (?:issue|problem|confusion)|i (?:don't|do not) (?:get|understand) (?:this|the|your|that) question|in simpler? terms|what(?:'s| is) (?:the|your) (?:issue|problem|question))\b/i.test(content.replace(/[’]/g, "'"));
}

export function expressesFrustration(content, { broad = false } = {}) {
  // Ignore quoted material so a quotation in an explanation is not treated as distress.
  const text = content.replace(/^>.*$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/"[^"\n]*"|“[^”\n]*”/g, '').replace(/[’]/g, "'");
  if (broad && broadFrustration.test(text)) return true;
  return /\b(?:fuck\w*|shit|shitty|bullshit|damn|goddamn|wtf|bitch|asshole|bastard)\b|\bwhat the hell\b/i.test(text)
    || /\b(?:i(?:'m| am| feel|\s+get(?:ting)?)\s+(?:so\s+|really\s+|very\s+)?(?:frustrated|annoyed|angry|fed up|overwhelmed|pissed off|sick of this)|(?:this|it|that)\s+(?:is\s+|feels\s+)?(?:so\s+|really\s+)?(?:frustrating|annoying|pointless|impossible|stupid)|(?:this|it)\s+sucks|i\s+(?:give up|want to give up|can't do this|cannot do this|hate this)|(?:this|it|that)\s+(?:still\s+)?(?:makes no sense|doesn't make sense)|(?:i\s+)?still\s+(?:don't|do not|can't|cannot)\s+(?:get|understand)|stop\s+(?:asking|repeating))\b/i.test(text);
}

export function rubricAttempts(messages, aspect) {
  return messages.reduce((count, message, index) => count + Number(substantiveReply(message) && messages[index - 1]?.rubricFocus === aspect), 0);
}

export function rubricSkipReason(messages, aspect, { early = false, broad = false } = {}) {
  return skipReason(messages, aspect, early ? 4 : RUBRIC_SKIP_AFTER, 3, broad);
}

function skipReason(messages, aspect, attemptThreshold, frustrationThreshold, broad = false) {
  if (!aspect) return null;
  // A declined offer starts a fresh attempt window for this item.
  const declined = messages.findLastIndex(message => message.role === 'assistant' && message.rubricFocus === aspect && message.skipOfferDeclined);
  if (declined >= 0) messages = messages.slice(declined);

  const frustrated = messages.some((message, index) => substantiveReply(message)
    && !messages[index - 1]?.assistance
    && !messages[index - 1]?.background
    && (messages[index - 1]?.rubricFocus === aspect
      // The opening question may not have a focus until the first assessment.
      || (!messages[index - 1]?.rubricFocus && messages[index + 1]?.rubricFocus === aspect))
    && expressesFrustration(message.content, { broad }));
  const attempts = rubricAttempts(messages, aspect);
  if (frustrated && attempts >= frustrationThreshold) return 'frustration';
  return attempts >= attemptThreshold ? 'attempts' : null;
}

export function skippedRubricItems(messages, aspects) {
  const skipped = new Set();
  messages.forEach((message, index) => {
    if (message.skipRubricItem === undefined) return;
    // Keep skips recorded under the earlier policy valid when reopening saved chats.
    const aspect = message.skipRubricItem;
    if (message.role !== 'user' || !aspects.includes(aspect) || skipped.has(aspect) || messages[index - 1]?.rubricFocus !== aspect || !skipReason(messages.slice(0, index), aspect, 3, 0)) throw new Error('Skip is not available for this rubric item yet.');
    skipped.add(aspect);
  });
  return skipped;
}
