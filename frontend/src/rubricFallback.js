// Shared policy for the chat UI and API. No model call is needed to unlock support.
export const RUBRIC_SKIP_AFTER = 6;
const substantiveReply = message => message.role === 'user' && !message.skipRubricItem && !message.helpRequest && !message.finishAssessment && !message.review;

export function asksForClarity(content) {
  return /\b(?:re-?word|re-?phrase|say (?:that|it) (?:again|differently)|what (?:do|are) you (?:want|need|asking|mean|looking for)|point out (?:the|your) (?:issue|problem|confusion)|i (?:don't|do not) (?:get|understand) (?:this|the|your|that) question|in simpler? terms|what(?:'s| is) (?:the|your) (?:issue|problem|question))\b/i.test(content.replace(/[’]/g, "'"));
}

// Deliberately narrow: obvious swearing, or a negative word written in capitals ("it is NOT ...").
export function expressesFrustration(content) {
  // Ignore quoted material so a quotation in an explanation is not treated as distress.
  const text = content.replace(/^>.*$/gm, '').replace(/```[\s\S]*?```/g, '').replace(/"[^"\n]*"|“[^”\n]*”/g, '').replace(/[’]/g, "'");
  if (/\b(?:fuck\w*|shit|shitty|bullshit|damn|goddamn|wtf|bitch|asshole|bastard)\b|\bwhat the hell\b/i.test(text)) return true;
  // A capitalised NOT beside gate or operator words is Boolean logic, not emphasis.
  const logic = /\b(?:AND|OR|NAND|NOR|XOR|XNOR)\b/.test(text) || /\bNOT[- ](?:gate|operator|operation|function)/i.test(text);
  return /\b(?:NO|NEVER|STOP|WRONG|DON'T|DONT|CAN'T|CANT|WON'T|WONT|ALREADY|ENOUGH|AGAIN|HATE|DUMB|STUPID|USELESS|POINTLESS|ANNOYING)\b/.test(text) || (!logic && /\bNOT\b/.test(text));
}

// The learner says they do not know the material. Not understanding the classmate's
// question is a different problem, and a skip would not help with it.
export function admitsNotKnowing(content) {
  const text = content.replace(/[’]/g, "'");
  if (asksForClarity(text) || /\b(?:(?:the|this|that|your) question|what you(?:'re| are)? (?:asking|mean|want|need|looking for|missing))\b/i.test(text)) return false;
  return /\b(?:idk|no (?:idea|clue)|not (?:really |too |so |entirely )?sure|unsure|i(?:'m| am) (?:so |really |totally |just )?(?:confused|lost|stuck)|i (?:forget|forgot)|(?:never|haven't|have not|didn't|did not) (?:learn(?:ed|t)?|cover(?:ed)?|studied|study)|(?:i|we) (?:really |honestly |just |still )?(?:don't|dont|do not|can't|cant|cannot|couldn't) (?:really |quite |fully )?(?:know|remember|recall|understand|get|explain))\b/i.test(text);
}

export function rubricAttempts(messages, aspect) {
  return messages.reduce((count, message, index) => count + Number(substantiveReply(message) && messages[index - 1]?.rubricFocus === aspect), 0);
}

export function rubricSkipReason(messages, aspect, { aware = false } = {}) {
  return aware ? awareSkipReason(messages, aspect) : skipReason(messages, aspect, RUBRIC_SKIP_AFTER, 3);
}

// Offer a skip only once the learner has shown they know they are missing this item:
// frustration, or saying they do not know. Counting replies alone never offers it.
function awareSkipReason(messages, aspect) {
  if (!aspect) return null;
  const declined = messages.findLastIndex(message => message.role === 'assistant' && message.rubricFocus === aspect && message.skipOfferDeclined);
  const replies = messages.slice(Math.max(declined, 0)).filter((message, index, list) => substantiveReply(message) && list[index - 1]?.rubricFocus === aspect && !list[index - 1]?.assistance && !list[index - 1]?.background);
  if (replies.some(message => expressesFrustration(message.content))) return 'frustration';
  return replies.some(message => admitsNotKnowing(message.content)) ? 'unsure' : null;
}

function skipReason(messages, aspect, attemptThreshold, frustrationThreshold) {
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
    && expressesFrustration(message.content));
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
    if (message.role !== 'user' || !aspects.includes(aspect) || skipped.has(aspect) || messages[index - 1]?.rubricFocus !== aspect || !(skipReason(messages.slice(0, index), aspect, 3, 0) || awareSkipReason(messages.slice(0, index), aspect))) throw new Error('Skip is not available for this rubric item yet.');
    skipped.add(aspect);
  });
  return skipped;
}
