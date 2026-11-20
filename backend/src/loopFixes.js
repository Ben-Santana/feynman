// Fixes for the "asked again and again" loop. Learners get every fix; developer tools
// can still send an experiment to compare subsets.
import { asksForClarity, expressesFrustration, rubricAttempts } from '../../frontend/src/rubricFallback.js';

export const fixNames = ['keepCredit', 'tolerantQuotes', 'stayOnItem', 'plainAsk', 'clearSkip'];

export function readFixes(experiment, aspects = []) {
  if (!experiment || typeof experiment !== 'object' || Array.isArray(experiment)) return {};
  const fixes = Object.fromEntries(fixNames.flatMap(name => experiment[name] === true ? [[name, true]] : []));
  const earned = Array.isArray(experiment.earned) ? [...new Set(experiment.earned.filter(item => aspects.includes(item)))] : [];
  return Object.keys(fixes).length ? { ...fixes, earned } : {};
}

// Every fix on, with credit carried over from the learner's last saved assessment.
export function learnerFixes(previous, aspects = []) {
  const earned = (previous?.criteria || []).filter(item => item.status === 'supported' && aspects.includes(item.aspect)).map(item => item.aspect);
  return { ...Object.fromEntries(fixNames.map(name => [name, true])), earned: [...new Set(earned)] };
}

// An item supported on an earlier turn stays supported; the level passes once every item has been.
export function keepEarnedCredit(checked, earned = []) {
  if (!checked || !earned.length) return checked;
  const kept = checked.criteria.map(item => item.status !== 'supported' && earned.includes(item.aspect));
  if (!kept.some(Boolean)) return checked;
  const next = structuredClone(checked);
  next.criteria = next.criteria.map((item, index) => kept[index] ? { ...item, status: 'supported', keptCredit: true } : item);
  if (next.refined?.judgments) next.refined.judgments = next.refined.judgments.map((judgment, index) => kept[index] ? { ...judgment, status: 'supported', blockers: [], contradictions: [], keptCredit: true } : judgment);
  if (next.criteria.every(item => item.status === 'supported')) { next.complete = true; next.nextQuestionFocus = ''; }
  return next;
}

// A wrong claim still needs the ordinary probe, so the plain ask is for missing or unclear items only.
export function needsPlainAsk(fixes, messages, aspect, status) {
  if (!fixes.plainAsk || !aspect || status === 'flawed') return false;
  const latest = messages.at(-1)?.content || '';
  return rubricAttempts(messages, aspect) >= 2 || asksForClarity(latest) || expressesFrustration(latest);
}

export const oneItemInstruction = ' The evaluator objective may list several requirements. Use only the part about this requirement and ignore the rest. Ask about one thing, in one sentence, with no second request joined by "and".';

export const plainAskInstruction = frustrated => ` The teacher has already answered about this requirement more than once, or asked what you need. Change approach for this message only. Read the whole conversation first and do not ask again for anything the teacher has already stated correctly, even tersely. Do not say you are lost, stuck, tangled or confused, and do not ask about another example. Say plainly, in one short sentence, which single piece you still do not have, then ask for exactly that piece. Name the kind of thing you need (a rule, a value, a name, a reason) and what it is about, using the teacher's own vocabulary. Never state or hint at its content.${frustrated ? ' Open with an apology of at most six words for going in circles.' : ''}`;
