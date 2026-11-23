import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTeachingGuides, guideInstructions, guideLeak } from './teachingGuide.js';
import { guideChecklist, guideFor, mergeGuide, missingGuideLevels, validLevelGuide } from '../../frontend/src/teachingGuide.js';
import { checklistText } from '../../frontend/src/rubricChecklist.js';

const criteria = [
  'States the general form of a power series centered at a: sum of c_n (x - a)^n.',
  'Recalls the Maclaurin series for e^x, sin x and 1/(1 - x) with their intervals of convergence.',
  'Uses the ratio test to find the radius of convergence and checks both endpoints.',
];
const rubric = { remember: checklistText(criteria), understand: '', apply: '', analyze: '' };
const groups = [
  { title: 'Describe the building blocks', prompts: [{ text: 'Explain what the center and coefficients represent.', criteria: [1] }] },
  { title: 'Connect familiar functions to series', prompts: [{ text: 'Recall the standard expansions covered in this topic and say where they apply.', criteria: [2] }] },
  { title: 'Explain convergence', prompts: [{ text: 'Describe how to find where a series is valid, and check its boundaries.', criteria: [3] }] },
];
const input = { learningType: 'quantitative', concepts: [{ name: 'Power Series', rubric: { remember: rubric.remember } }] };
const reply = guideGroups => async () => ({ guides: [{ key: 'c1.remember', groups: guideGroups }] });
const concept = (extra = {}) => ({ id: 'power', name: 'Power Series', target: 'remember', passed: 0, stageStart: 0, messages: [], draft: '', assessment: null, rubric, guide: { remember: { source: rubric.remember, groups } }, ...extra });
const judged = statuses => ({ complete: false, reason: '', task: { status: 'missing', result: 'undetermined', evidence: [] }, criteria: criteria.map((aspect, index) => ({ aspect, status: statuses[index], result: 'undetermined', evidence: [] })) });

test('a checklist is generated from the rubric items and saved with the rubric it was written for', async () => {
  let request;
  const [result] = await generateTeachingGuides(input, async (instructions, messages, tool) => {
    request = { instructions, body: JSON.parse(messages[0].content), tool };
    return { guides: [{ key: 'c1.remember', groups }] };
  });
  assert.equal(request.instructions, guideInstructions);
  assert.deepEqual(request.body.entries[0].criteria.map(item => item.text), criteria);
  assert.equal(request.tool.name, 'write_teaching_checklists');
  assert.equal(result.name, 'Power Series');
  assert.equal(result.guide.remember.source, rubric.remember);
  assert.deepEqual(result.guide.remember.groups, groups);
  assert.deepEqual(Object.keys(result.guide), ['remember']);
});

test('a checklist that exposes the answer key is rejected, not shown', async () => {
  const leaks = [
    ['formula', 'State that the series is the sum of c_n (x - a)^n.'],
    ['equation', 'Show that the radius R = 1 for the geometric series.'],
    ['number', 'Give the interval from -1 to 1 for the geometric series.'],
    ['copied wording', 'Uses the ratio test to find the radius of convergence, then explain it.'],
  ];
  for (const [name, text] of leaks) {
    let calls = 0;
    const leaking = groups.map((group, index) => index ? group : { ...group, prompts: [{ text, criteria: [1] }] });
    await assert.rejects(generateTeachingGuides(input, async () => { calls++; return { guides: [{ key: 'c1.remember', groups: leaking }] }; }), /formula|number|rubric wording/, name);
    assert.equal(calls, 3, `${name} is retried before failing`);
  }
  assert.equal(guideLeak('Explain what the center and coefficients represent.', criteria, 'Power Series'), null);
  // A number that is part of the concept's own name is not an answer.
  assert.equal(guideLeak('Explain when a 2 by 2 system has one solution.', [], 'Solving 2 by 2 systems'), null);
  assert.match(guideInstructions, /not the name of a curve, theorem, law, test, method/);
});

test('every rubric item must be covered, and a bad first draft is repaired on retry', async () => {
  await assert.rejects(generateTeachingGuides(input, reply(groups.slice(0, 2))), /cover every criterion number from 1 to 3/);
  let calls = 0;
  const [result] = await generateTeachingGuides(input, async instructions => {
    if (!calls++) return { guides: [{ key: 'c1.remember', groups: groups.slice(0, 2) }] };
    assert.match(instructions, /previous response could not be validated/);
    return { guides: [{ key: 'c1.remember', groups }] };
  });
  assert.equal(result.guide.remember.groups.length, 3);
  await assert.rejects(generateTeachingGuides({ learningType: 'quantitative', concepts: [] }, reply(groups)), /Choose 1–2 concepts/);
  await assert.rejects(generateTeachingGuides({ learningType: 'quantitative', concepts: [{ name: 'Power Series', rubric: {} }] }, reply(groups)), /at least one rubric level/);
});

test('a prompt is complete only when every rubric item behind it is demonstrated', () => {
  const grouped = [{ title: 'Describe the building blocks', prompts: [{ text: 'Explain the parts of a series and the standard expansions.', criteria: [1, 2] }] }, groups[2]];
  // A finished level shows every prompt, so states can be read without the one-at-a-time reveal.
  const state = statuses => guideChecklist(concept({ target: 'understand', passed: 1, guide: { remember: { source: rubric.remember, groups: grouped } }, assessments: { remember: judged(statuses) } }), 'remember').groups.map(group => group.prompts.map(prompt => prompt.state));
  assert.deepEqual(state(['missing', 'missing', 'missing']), [['open'], ['open']]);
  assert.deepEqual(state(['supported', 'needs_clarification', 'missing']), [['partial'], ['open']]);
  assert.deepEqual(state(['supported', 'supported', 'flawed']), [['done'], ['open']]);
  assert.deepEqual(state(['supported', 'supported', 'supported']), [['done'], ['done']]);
  // A skipped item is not demonstrated, even on a level that was finished.
  const skipped = judged(['supported', 'supported', 'supported']);
  skipped.criteria[1].skipped = true;
  const finished = guideChecklist(concept({ passed: 1, guide: { remember: { source: rubric.remember, groups: grouped } }, assessments: { remember: skipped } }));
  assert.deepEqual(finished.groups.map(group => group.prompts[0].state), ['partial', 'done']);
  assert.deepEqual({ done: finished.done, total: finished.total }, { done: 1, total: 2 });
});

test('a checklist written for a different rubric is not shown and is prepared again', () => {
  assert.equal(missingGuideLevels(concept()).length, 0);
  assert.ok(guideFor(concept(), 'remember'));
  const edited = concept({ rubric: { ...rubric, remember: checklistText([...criteria.slice(0, 2), 'Differentiates a power series term by term.']) } });
  assert.equal(guideFor(edited, 'remember'), null);
  assert.equal(guideChecklist(edited), null);
  assert.deepEqual(missingGuideLevels(edited), ['remember']);
  assert.deepEqual(missingGuideLevels(concept({ guide: undefined })), ['remember']);
  // Renumbering or respacing the same items does not make it stale.
  assert.ok(guideFor(concept({ rubric: { ...rubric, remember: criteria.map(item => `- ${item}`).join('\n') } }), 'remember'));
  // Saved data is checked before it is shown.
  assert.equal(validLevelGuide({ source: rubric.remember, groups: [{ title: 'x', prompts: [{ text: 'y', criteria: [4] }] }] }, 3), false);
  assert.equal(guideFor(concept({ guide: { remember: { source: rubric.remember, groups: 'nope' } } }), 'remember'), null);
  // A late result for an edited rubric is dropped rather than attached to the wrong items.
  assert.deepEqual(mergeGuide(edited, { remember: { source: rubric.remember, groups } }).guide, {});
  assert.deepEqual(mergeGuide(concept({ guide: undefined }), { remember: { source: rubric.remember, groups } }).guide.remember.groups, groups);
});

test('one checklist that cannot be made safe does not cost the other concepts theirs', async () => {
  const two = { learningType: 'quantitative', concepts: [input.concepts[0], { name: 'Series Tests', rubric: { remember: rubric.remember } }] };
  const leaking = [{ title: 'Recall', prompts: [{ text: 'State that R = 1.', criteria: [1, 2, 3] }] }];
  const result = await generateTeachingGuides(two, async () => ({ guides: [{ key: 'c1.remember', groups }, { key: 'c2.remember', groups: leaking }] }));
  assert.deepEqual(result[0].guide.remember.groups, groups);
  assert.deepEqual(result[1].guide, {});
});

test('prompts appear one at a time, and the next one only after the student has replied', () => {
  const ask = { role: 'assistant', content: 'Teach me.' }, reply = content => ({ role: 'user', content });
  const view = extra => { const list = guideChecklist(concept(extra)); return { shown: list.groups.flatMap(group => group.prompts.map(prompt => `${prompt.state}:${prompt.text.slice(0, 7)}`)), waiting: list.waiting, later: list.later }; };
  const cited = (statuses, at) => { const result = judged(statuses); result.criteria.forEach((item, index) => { if (at[index] !== undefined) item.evidence = [{ messageIndex: at[index], quote: 'x' }]; }); return result; };
  // Before any reply nothing is shown: the student teaches first.
  assert.deepEqual(view({ messages: [ask] }), { shown: [], waiting: true, later: 2 });
  // A reply that earns nothing reveals the first prompt only.
  assert.deepEqual(view({ messages: [ask, reply('hmm')], assessments: { remember: judged(['missing', 'missing', 'missing']) } }), { shown: ['open:Explain'], waiting: false, later: 2 });
  // Finishing a prompt keeps it and hides the next until another reply.
  const first = { remember: cited(['supported', 'missing', 'missing'], [1]) };
  assert.deepEqual(view({ messages: [ask, reply('centers'), ask], assessments: first }), { shown: ['done:Explain'], waiting: true, later: 1 });
  assert.deepEqual(view({ messages: [ask, reply('centers'), ask, reply('not sure')], assessments: first }), { shown: ['done:Explain', 'open:Recall '], waiting: false, later: 1 });
  // Something taught ahead of order is shown as done; skipped prompts do not block the list.
  const ahead = cited(['missing', 'missing', 'supported'], [undefined, undefined, 1]);
  assert.deepEqual(view({ messages: [ask, reply('endpoints'), ask], assessments: { remember: ahead } }), { shown: ['done:Describ'], waiting: true, later: 1 });
  const skipped = cited(['missing', 'missing', 'missing'], []); skipped.criteria[0].skipped = true;
  assert.deepEqual(view({ messages: [ask, reply('skip'), ask, reply('next')], assessments: { remember: skipped } }).shown, ['open:Explain', 'open:Recall ']);
  // Skip and help actions are not teaching replies.
  assert.equal(view({ messages: [ask, { role: 'user', content: 'help', helpRequest: true }] }).waiting, true);
});

test('an item finished after a stated mistake is marked as the half-point case, not as a full point', () => {
  const done = judged(['supported', 'supported', 'supported']);
  const states = mistakes => guideChecklist(concept({ target: 'understand', passed: 1, mistakes, assessments: { remember: done } }), 'remember').groups.map(group => group.prompts[0].state);
  assert.deepEqual(states(undefined), ['done', 'done', 'done']);
  assert.deepEqual(states({ remember: [criteria[1]] }), ['done', 'corrected', 'done']);
  // A mistake that has not been fixed yet is still open, and one from another level does not count.
  const open = guideChecklist(concept({ target: 'understand', passed: 1, mistakes: { remember: [criteria[0]], understand: [criteria[2]] }, assessments: { remember: judged(['flawed', 'supported', 'supported']) } }), 'remember');
  assert.deepEqual(open.groups.map(group => group.prompts[0].state), ['open', 'done', 'done']);
  assert.equal(open.done, 2);
});
