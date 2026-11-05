import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Readable } from 'node:stream';
import { createApiServer } from './server.js';
import { generatePuzzle, puzzlePrompt, validateGeneratedPuzzle, validatePuzzleDescription, assemblePuzzlePreview } from './puzzleGeneration.js';
import { InvalidOutputError } from './structuredOutput.js';
import { puzzleSkillInstructions, selectPuzzleSkills } from './puzzleSkills.js';
import { AIError } from './providers/LanguageModelProvider.js';
import { testAccountService, testAuthorization } from './accessTestHelper.js';

const sample = () => ({
  title: 'Lift a load', topic: 'Mechanical advantage', problem: 'Use an ideal pulley to lift a 60 N load. Choose the applied force.',
  input: { kind: 'number', label: 'Applied force', unit: 'N', min: 1, max: 60, initialValue: 5, choices: [] },
  solution: { value: 30, tolerance: .1, explanation: 'Two rope segments share the 60 N load, so 30 N is needed.' },
  feedback: { success: 'The load rises.', failure: 'Compare the applied force with the tension in each supporting rope.' },
  figureCode: 'function mountPuzzle({HL,stage,svg,onValue},initialConfig){const bag=HL.disposer();bag.add(HL.pointer(stage,{move(){},down(p){onValue(Math.max(1,Math.min(60,p[0])));},leave(){}}));const line=HL.mk("path",{d:"M100 100L200 200",class:"sil"},svg);return{update(config){line.setAttribute("d",config.checked?"M100 80L200 180":"M100 100L200 200");},destroy(){bag.dispose();svg.replaceChildren();}};}',
});
async function invoke(server, body, authorization = testAuthorization) {
  const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  Object.assign(req, { method: body === undefined ? 'GET' : 'POST', url: '/api/developer/puzzles', headers: { authorization, host: 'localhost:3001', origin: 'http://localhost:5173', 'content-type': 'application/json' } });
  return new Promise(resolve => server.emit('request', req, { setHeader() {}, writeHead(status) { this.status = status; }, end(body) { resolve({ status: this.status, data: JSON.parse(body) }); } }));
}
test('prompt is reusable and preserves learned interaction, math, and rendering requirements', () => {
  const { prompt, schema } = puzzlePrompt();
  for (const required of ['{{PUZZLE_DESCRIPTION}}', 'EVERY finite value', 'config.checked', 'FULL draggable body', 'spring overshoot', 'tset REQUIRES FOUR', 'mountPuzzle', 'Ohm']) assert.ok(prompt.includes(required), required);
  assert.equal(schema.properties.figureCode.type, 'string');
});
test('description validation rejects empty, non-text, and oversized requests before querying', async () => {
  for (const description of ['', '  ', null, 4, 'x'.repeat(8001)]) assert.throws(() => validatePuzzleDescription({ description }), /Describe a puzzle/);
  assert.equal(validatePuzzleDescription({ description: '  A pulley.  ' }), 'A pulley.');
  let calls = 0;
  await assert.rejects(generatePuzzle({ description: '' }, () => { calls++; }), /Describe a puzzle/);
  assert.equal(calls, 0);
});
test('numeric puzzle accepts continuous reachable inputs and rejects unreachable or pre-solved setups', () => {
  assert.equal(validateGeneratedPuzzle(sample()).solution.value, 30);
  for (const mutate of [p => { p.input.max = 0; }, p => { p.solution.value = 70; }, p => { p.input.initialValue = 30; }, p => { p.solution.tolerance = 50; }, p => { p.input.initialValue = null; }]) {
    const value = sample(); mutate(value); assert.throws(() => validateGeneratedPuzzle(value), InvalidOutputError);
  }
});
test('choice puzzle must offer distinct options with exactly one correct answer', () => {
  const value = sample(); value.input = { ...value.input, kind: 'choice', initialValue: null, choices: [10, 30, 60].map(n => ({ value: n, label: `${n} N` })) };
  assert.equal(validateGeneratedPuzzle(value).input.choices.length, 3);
  value.input.choices[0].value = 30;
  assert.throws(() => validateGeneratedPuzzle(value), InvalidOutputError);
  value.input.choices[0].value = 29.95;
  assert.equal(validateGeneratedPuzzle(value).solution.tolerance, 0, 'choice IDs match exactly, even when physical values are close');
});
test('code is parsed without executing it on the server, and cannot close the trusted script element', () => {
  const value = sample(); value.figureCode = 'throw new Error("must not execute on server");\n' + value.figureCode;
  assert.doesNotThrow(() => validateGeneratedPuzzle(value));
  value.figureCode += '\n</script><script>alert(1)</script>';
  assert.throws(() => validateGeneratedPuzzle(value), /without HTML/);
  value.figureCode = 'function mountPuzzle( {';
  assert.throws(() => validateGeneratedPuzzle(value), /syntax/);
});
test('only malformed structured output is retried; provider failures are not hidden', async () => {
  let calls = 0;
  const result = await generatePuzzle({ description: 'A pulley puzzle' }, async (prompt, messages, response) => {
    if (response.name === 'select_puzzle_skills') return { skillIds: [] };
    calls++; assert.equal(response.name, 'generate_apply_puzzle'); assert.ok(prompt.includes('mountPuzzle'));
    if (calls === 1) return { ...sample(), figureCode: 'function mountPuzzle( {' };
    assert.match(messages[0].content, /invalid JavaScript syntax/); return sample();
  });
  assert.equal(calls, 2); assert.equal(result.repaired, true); assert.ok(result.previewHtml.includes(result.runId));
  calls = 0;
  await assert.rejects(generatePuzzle({ description: 'A pulley puzzle' }, () => { calls++; throw new AIError('Rate limited.', 429); }), /Rate limited/);
  assert.equal(calls, 1);
});
test('preview seals subresources and safely embeds non-code text', () => {
  const value = sample(); value.input.initialValue = 5;
  const html = assemblePuzzlePreview(value, '</script><img src=x>');
  assert.ok(html.includes("connect-src 'none'")); assert.ok(html.includes("script-src 'unsafe-inline'"));
  assert.ok(!html.includes('const channel="</script>')); assert.ok(html.includes('\\u003c/script>'));
  assert.ok(html.includes("event.source!==parent")); assert.ok(html.includes('Initial geometry leaves'));
});
test('API requires admin, returns the prompt without provider configuration, and generates with the selected provider', async t => {
  let calls = 0;
  const server = createApiServer({ accountService: testAccountService(), chatgpt: null, env: { ANTHROPIC_API_KEY: 'test-only' }, query: async (_prompt, _messages, response) => { if (response.name === 'select_puzzle_skills') return { skillIds: [] }; calls++; return sample(); } });
  t.after(() => server.close());
  assert.equal((await invoke(server, undefined, '')).status, 401);
  assert.equal((await invoke(server)).status, 200);
  assert.equal((await invoke(server, { description: '' })).status, 400);
  const response = await invoke(server, { description: 'A pulley puzzle' });
  assert.equal(response.status, 200); assert.equal(response.data.provider, 'anthropic'); assert.equal(calls, 1);
  const student = createApiServer({ accountService: testAccountService('student'), chatgpt: null, env: {}, query: () => { throw new Error('must not run'); } });
  t.after(() => student.close());
  assert.equal((await invoke(student)).status, 403); assert.equal((await invoke(student, { description: 'A pulley puzzle' })).status, 403);
  const unconfigured = createApiServer({ accountService: testAccountService(), chatgpt: null, env: {} });
  t.after(() => unconfigured.close());
  assert.equal((await invoke(unconfigured)).status, 200); assert.equal((await invoke(unconfigured, { description: 'A pulley puzzle' })).status, 503);
});

function investigation() {
  const value = sample();
  value.topic = 'Ohmic behavior';
  value.problem = 'Vary the voltage and use the measured current to decide whether the component is ohmic.';
  value.input = { kind: 'choice', label: 'Component behavior', unit: '', min: .5, max: 8, initialValue: null, choices: [{ value: 0, label: 'Ohmic' }, { value: 1, label: 'Non-ohmic' }] };
  value.solution = { value: 0, tolerance: .5, explanation: 'I=V/40, so V/I stays at 40 ohms throughout the explored range.' };
  value.experiment = { control: { label: 'Applied voltage', unit: 'V', min: .5, max: 8, initialValue: 1 }, measurement: { label: 'Measured current', unit: 'A' }, minObservations: 3, instruction: 'Sample several voltage settings before classifying the component.' };
  value.figureCode = 'function mountPuzzle({HL,stage,svg,interactions,onExperimentValue},initialConfig){const bag=HL.disposer();const meter=interactions.reading("Measured current",initialConfig.experimentValue/40,"A");bag.add(HL.pointer(stage,{move(){},down(p){onExperimentValue(p[0]/50);},leave(){}}));return{update(config){meter.update(config.experimentValue/40);},destroy(){bag.dispose();svg.replaceChildren();}};}';
  return value;
}
test('investigation separates physical control bounds from exact categorical answer IDs', () => {
  const result = validateGeneratedPuzzle(investigation());
  assert.deepEqual([result.input.min, result.input.max], [0, 1]);
  assert.deepEqual([result.experiment.control.min, result.experiment.control.max], [.5, 8]);
  assert.equal(result.solution.value, 0); assert.equal(result.solution.tolerance, 0);
  assert.equal(result.experiment.minObservations, 3);
  const html = assemblePuzzlePreview(result, 'investigation-test');
  assert.ok(html.includes('onExperimentValue:'));
  assert.ok(html.includes('"experimentValue":1'));
  assert.ok(html.includes('"value":null'));
});
test('invalid investigation controls, observation requirements, and answer IDs fail explicitly', () => {
  for (const mutate of [p => { p.experiment.control.initialValue = 10; }, p => { p.experiment.control.max = -1; }, p => { p.experiment.minObservations = 1; }, p => { p.solution.value = 12; }, p => { p.figureCode = sample().figureCode; }]) {
    const value = investigation(); mutate(value); assert.throws(() => validateGeneratedPuzzle(value), InvalidOutputError);
  }
});
test('numeric solution errors distinguish a domain mismatch from an invalid tolerance', () => {
  const value = sample(); value.solution.value = 0;
  assert.throws(() => validateGeneratedPuzzle(value), /Classification answers need choices/);
  value.solution.value = 30; value.solution.tolerance = 20;
  assert.throws(() => validateGeneratedPuzzle(value), /Numeric tolerance/);
});
test('generation prompt describes observation-driven inference without premature classification', () => {
  const { prompt, schema, version } = puzzlePrompt();
  for (const requirement of ['INVESTIGATION', 'onExperimentValue', 'Current is evidence', 'Choice IDs are categories', 'Ohmic', 'minObservations']) assert.ok(prompt.includes(requirement), requirement);
  assert.ok(schema.required.includes('experiment')); assert.equal(version, 'apply-puzzles-v5');
});

test('generation loads only selected skill bodies and preserves selection across repairs', async () => {
  const { prompt, skillCatalog } = puzzlePrompt();
  assert.deepEqual(skillCatalog.map(skill => skill.id), ['circuit']);
  assert.ok(!prompt.includes('SKILL: circuit'));
  assert.ok(!prompt.includes('const terminals ='));
  const instructions = [];
  let selections = 0;
  const result = await generatePuzzle({ description: 'Investigate a mystery component by varying its supply voltage.' }, async (instruction, messages, response) => {
    if (response.name === 'select_puzzle_skills') {
      selections++;
      assert.ok(instruction.includes('SKILL CATALOG'));
      assert.ok(!instruction.includes('const terminals ='));
      assert.match(messages[0].content, /mystery component/);
      return { skillIds: ['circuit'] };
    }
    instructions.push(instruction);
    return instructions.length === 1 ? { ...investigation(), figureCode: 'broken' } : investigation();
  });
  assert.equal(result.repaired, true);
  assert.equal(result.promptVersion, 'apply-puzzles-v5');
  assert.deepEqual(result.skillIds, ['circuit']);
  assert.equal(selections, 1);
  assert.equal(instructions.length, 2);
  assert.equal(instructions[0], instructions[1]);
  for (const requirement of ['SKILL: circuit', 'Cam(45, 0.5, 1.38)', 'const terminals =', 'Kirchhoff', 'ammeter has no bypass', 'socket-before-resistor']) assert.ok(instructions[0].includes(requirement), requirement);
});

test('no matching skill keeps all skill bodies out of the generation call', async () => {
  const calls = [];
  const result = await generatePuzzle({ description: 'A pulley lifting a load; the circuit is just an analogy.' }, async (instructions, _messages, response) => {
    calls.push(response.name);
    assert.ok(!instructions.includes('const terminals ='));
    assert.ok(!instructions.includes('SKILL: circuit'));
    return response.name === 'select_puzzle_skills' ? { skillIds: [] } : sample();
  });
  assert.deepEqual(calls, ['select_puzzle_skills', 'generate_apply_puzzle']);
  assert.deepEqual(result.skillIds, []);
  assert.equal(puzzleSkillInstructions([]), '');
  assert.throws(() => puzzleSkillInstructions(['unknown']), /Unknown puzzle skill/);
});

test('invalid skill selections are retried and never reach puzzle generation', async () => {
  for (const invalid of [null, {}, { skillIds: 'circuit' }, { skillIds: ['unknown'] }, { skillIds: ['circuit', 'circuit'] }]) {
    let calls = 0;
    await assert.rejects(generatePuzzle({ description: 'A circuit' }, async (_instructions, _messages, response) => {
      calls++;
      assert.equal(response.name, 'select_puzzle_skills');
      return invalid;
    }), InvalidOutputError);
    assert.equal(calls, 2);
  }
  let attempts = 0;
  assert.deepEqual(await selectPuzzleSkills('A circuit', async () => ++attempts === 1 ? {} : { skillIds: ['circuit'] }, AbortSignal.timeout(1000)), ['circuit']);
  let calls = 0;
  await assert.rejects(selectPuzzleSkills('A circuit', async () => { calls++; throw new AIError('Rate limited.', 429); }, AbortSignal.timeout(1000)), /Rate limited/);
  assert.equal(calls, 1);
});

test('generated apparatus rejects lettering and routes annotations to host helpers', () => {
  for (const code of ['HL.mk("text",{},svg)', "mk('tspan',{},svg)", "interactions.label(svg,'Battery',[0,0])", "HL.mk('foreignObject',{},svg)"]) {
    const value = sample(); value.figureCode = value.figureCode.replace('const bag=', `${code};const bag=`);
    assert.throws(() => validateGeneratedPuzzle(value), /No text in the Hairline apparatus/);
  }
  const { prompt } = puzzlePrompt();
  for (const requirement of ['NEVER draw text', 'TOP LEFT', 'BOTTOM RIGHT', 'dial must rotate', 'slider must move', 'three decimal places']) assert.ok(prompt.includes(requirement), requirement);
  const html = assemblePuzzlePreview(sample(), 'text-free');
  assert.ok(html.includes('svg text,svg foreignObject{display:none!important;}'));
  assert.ok(html.includes('HL:presentation.HL'));
});
test('presentation colors components, places annotations, and rounds only displayed readings', () => {
  const makeNode = () => ({ children: [], classList: { values: [], add(value) { this.values.push(value); } }, style: {}, setAttribute() {}, append(...nodes) { this.children.push(...nodes); } });
  const stage = makeNode(), component = makeNode(), svg = { contains: node => node === component };
  const context = { document: { createElement: makeNode, createTextNode: text => ({ textContent: text }) } };
  const source = readFileSync(new URL('../assets/puzzles/presentation.js', import.meta.url), 'utf8');
  const presentation = runInNewContext(`${source};puzzlePresentation`, context)({ mk: () => makeNode() }, stage, svg, {});
  presentation.interactions.legend(component, 'Battery · 6 V', 'blue');
  assert.equal(stage.children[0].className, 'puzzle-legend');
  assert.equal(component.classList.values[0], 'puzzle-component-blue');
  assert.equal(stage.children[0].children[0].children[0].style.backgroundColor, '#2869a3');
  const reading = presentation.interactions.reading('Current', 1.23456789, 'A');
  const output = stage.children[1].children[0].children[1];
  assert.equal(stage.children[1].className, 'puzzle-outputs');
  assert.equal(output.textContent, '1.235 A');
  reading.update(.000000123456); assert.equal(output.textContent, '1.23e-7 A');
  reading.update(.05); assert.equal(output.textContent, '0.05 A');
  assert.throws(() => reading.update(NaN), /finite/);
  assert.throws(() => presentation.HL.mk('text', {}, svg), /outside the apparatus/);
  assert.throws(() => presentation.interactions.label(), /legend/);
});
