import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { InvalidOutputError } from './structuredOutput.js';
import { puzzleSkillCatalog, puzzleSkillInstructions, selectPuzzleSkills } from './puzzleSkills.js';

export const puzzlePromptVersion = 'apply-puzzles-v5';
const asset = name => readFileSync(new URL(`../assets/puzzles/${name}`, import.meta.url), 'utf8');
const kernel = asset('kernel.js');
const interactionSource = asset('interactions.js');
const presentationSource = asset('presentation.js');
const apiIndex = kernel.slice(0, kernel.indexOf('var HL ='));
function generationInstructions(skillIds = []) {
  const references = JSON.parse(asset('examples.json'));
  return `${asset('generation-prompt.md')}\n\n${puzzleSkillInstructions(skillIds)}\n\nPUBLIC HL API\n${apiIndex}\n\nSHARED INTERACTION AND PRESENTATION HELPERS\n${interactionSource}\n${presentationSource}\n\nVISUAL REFERENCES — geometry only; their legacy text labels are forbidden. Use the presentation helpers above. Adapt the contract, do not copy host wiring\n${references.map(item => `${item.topic}: ${item.note}\n${item.source}`).join('\n\n')}`;
}
export const puzzleResponse = {
  name: 'generate_apply_puzzle', description: 'Return one complete playable Apply puzzle and its deterministic solution.',
  schema: { type: 'object', additionalProperties: false, required: ['title', 'topic', 'problem', 'input', 'experiment', 'solution', 'feedback', 'figureCode'], properties: {
    title: { type: 'string' }, topic: { type: 'string' }, problem: { type: 'string' },
    input: { type: 'object', additionalProperties: false, required: ['kind', 'label', 'unit', 'min', 'max', 'initialValue', 'choices'], properties: {
      kind: { type: 'string', enum: ['number', 'choice'] }, label: { type: 'string' }, unit: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, initialValue: { type: ['number', 'null'] },
      choices: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['value', 'label'], properties: { value: { type: 'number' }, label: { type: 'string' } } } },
    } },
    experiment: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['control', 'measurement', 'minObservations', 'instruction'], properties: {
      control: { type: 'object', additionalProperties: false, required: ['label', 'unit', 'min', 'max', 'initialValue'], properties: { label: { type: 'string' }, unit: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, initialValue: { type: 'number' } } },
      measurement: { type: 'object', additionalProperties: false, required: ['label', 'unit'], properties: { label: { type: 'string' }, unit: { type: 'string' } } },
      minObservations: { type: 'integer', minimum: 2, maximum: 6 }, instruction: { type: 'string' },
    } }] },
    solution: { type: 'object', additionalProperties: false, required: ['value', 'tolerance', 'explanation'], properties: { value: { type: 'number' }, tolerance: { type: 'number' }, explanation: { type: 'string' } } },
    feedback: { type: 'object', additionalProperties: false, required: ['success', 'failure'], properties: { success: { type: 'string' }, failure: { type: 'string' } } },
    figureCode: { type: 'string' },
  } },
};
export function puzzlePrompt() { return { version: puzzlePromptVersion, prompt: `${generationInstructions()}\n\nPUZZLE_DESCRIPTION:\n{{PUZZLE_DESCRIPTION}}`, schema: puzzleResponse.schema, skillCatalog: puzzleSkillCatalog() }; }
export function validatePuzzleDescription(input) {
  if (typeof input?.description !== 'string' || !input.description.trim() || input.description.trim().length > 8000) throw new Error('Describe a puzzle in 1–8,000 characters.');
  return input.description.trim();
}
const fail = message => { throw new InvalidOutputError(message); };
const text = (value, label, max = 1200) => typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : fail(`Invalid puzzle ${label}.`);
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1_000_000;
export function validateGeneratedPuzzle(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('The model did not return a puzzle object.');
  const title = text(raw.title, 'title', 80), topic = text(raw.topic, 'topic', 120), problem = text(raw.problem, 'problem');
  const input = raw.input, solution = raw.solution;
  if (!input || !['number', 'choice'].includes(input.kind)) fail('Choose a numeric input or a set of answer choices.');
  const label = text(input.label, 'input label', 80);
  if (typeof input.unit !== 'string' || input.unit.length > 24) fail('Invalid puzzle input unit.');
  if (!Array.isArray(input.choices)) fail('The input choices must be an array.');
  const choices = input.choices.map(choice => ({ value: choice?.value, label: text(choice?.label, 'choice label', 80) }));
  if (input.kind === 'number' && choices.length) fail('Numeric puzzles do not have discrete choices.');
  if (input.kind === 'choice' && (choices.length < 2 || choices.length > 6 || choices.some(choice => !finite(choice.value)) || new Set(choices.map(choice => choice.value)).size !== choices.length || new Set(choices.map(choice => choice.label.toLowerCase())).size !== choices.length)) fail('Choose 2–6 distinct answer choices.');
  // Choice IDs are categories, not measurements. Their domain is the options,
  // independent of an experiment's voltage/height/etc. range. Match IDs exactly.
  const min = input.kind === 'choice' ? Math.min(...choices.map(c => c.value)) : input.min;
  const max = input.kind === 'choice' ? Math.max(...choices.map(c => c.value)) : input.max;
  if (!finite(min) || !finite(max) || min >= max) fail('The puzzle needs a finite, increasing input range.');
  const inRange = value => finite(value) && value >= min && value <= max;
  const isChoice = value => choices.some(choice => choice.value === value);
  if (input.initialValue !== null && !inRange(input.initialValue) || input.kind === 'number' && input.initialValue === null || input.kind === 'choice' && input.initialValue !== null && !isChoice(input.initialValue)) fail('The initial input must be inside its answer domain.');
  if (!solution || !finite(solution.value)) fail('The puzzle needs a finite solution value.');
  if (input.kind === 'number' && !inRange(solution.value)) fail(`The numeric answer is outside its input range (${min}–${max} ${input.unit}). Classification answers need choices and a separate experiment control.`);
  if (input.kind === 'number' && (!finite(solution.tolerance) || solution.tolerance < 0 || solution.tolerance > (max - min) / 20)) fail(`Numeric tolerance must be between 0 and ${(max - min) / 20} ${input.unit}.`);
  if (input.kind === 'choice' && !isChoice(solution.value)) fail('Exactly one answer choice must match the solution ID.');
  const tolerance = input.kind === 'choice' ? 0 : solution.tolerance;
  const explanation = text(solution.explanation, 'solution explanation', 3000);
  if (input.initialValue !== null && Math.abs(input.initialValue - solution.value) <= tolerance) fail('The initial answer must not already solve the puzzle.');
  let experiment = null;
  if (raw.experiment != null) {
    const spec = raw.experiment, control = spec.control;
    if (!control || !finite(control.min) || !finite(control.max) || control.min >= control.max || !finite(control.initialValue) || control.initialValue < control.min || control.initialValue > control.max) fail('The experiment needs its own finite control range and in-range starting value.');
    if (!Number.isInteger(spec.minObservations) || spec.minObservations < 2 || spec.minObservations > 6) fail('Require 2–6 distinct experiment observations.');
    if (typeof control.unit !== 'string' || control.unit.length > 24 || typeof spec.measurement?.unit !== 'string' || spec.measurement.unit.length > 24) fail('Invalid experiment measurement units.');
    experiment = { control: { label: text(control.label, 'experiment control label', 80), unit: control.unit.trim(), min: control.min, max: control.max, initialValue: control.initialValue }, measurement: { label: text(spec.measurement.label, 'measurement label', 80), unit: spec.measurement.unit.trim() }, minObservations: spec.minObservations, instruction: text(spec.instruction, 'experiment instruction', 500) };
  }
  const success = text(raw.feedback?.success, 'success feedback', 400), failure = text(raw.feedback?.failure, 'failure feedback', 400);
  const figureCode = text(raw.figureCode, 'figure code', 60000);
  if (/<\/script\b/i.test(figureCode) || !/\bfunction\s+mountPuzzle\s*\(/.test(figureCode)) fail('Return a mountPuzzle function without HTML or script tags.');
  if (/\b(?:mk|createElementNS|createElement)\s*\(\s*['"`](?:text|tspan|textPath|foreignObject)['"`]|\.label\s*\(/i.test(figureCode)) fail('No text in the Hairline apparatus. Use interactions.legend for color labels and interactions.reading for bottom-right outputs.');
  try { new Script(`"use strict";\n${figureCode}`, { filename: 'generated-puzzle.js' }); }
  catch { fail('The generated figure has invalid JavaScript syntax.'); }
  if (/\bpostMessage\s*\(|\bhairline\s*\(/.test(figureCode)) fail('Use the mountPuzzle/onValue contract, not the old demo messaging or bench.');
  if (!/\bpointer\s*\(/.test(figureCode) || !(experiment ? /\bonExperimentValue\s*\(/ : /\bonValue\s*\(/).test(figureCode)) fail(experiment ? 'Implement experiment manipulation with HL.pointer and onExperimentValue.' : 'Implement direct manipulation with HL.pointer and onValue.');
  return { title, topic, problem, input: { kind: input.kind, label, unit: input.unit.trim(), min, max, initialValue: input.initialValue, choices }, experiment, solution: { value: solution.value, tolerance, explanation }, feedback: { success, failure }, figureCode };
}
const inlineJSON = value => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export function assemblePuzzlePreview(puzzle, channel) {
  const initial = { value: puzzle.input.initialValue, checked: false, solved: false, attempt: 0, experimentValue: puzzle.experiment?.control.initialValue ?? null, observations: puzzle.experiment ? [puzzle.experiment.control.initialValue] : [] };
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'"><style>
html,body{margin:0;background:#fafafa;color:#202022;height:100%;}body{display:grid;place-items:center;}#stage{position:relative;width:min(100vw,125vh);--hairline-plate:#fafafa;--hairline-hi:#202022;--hairline-edge:#55555a;--hairline-mid:#77777c;--hairline-lo:#a3a3aa;touch-action:none;}svg{display:block;width:100%;height:auto;}svg text,svg foreignObject{display:none!important;}
.puzzle-legend,.puzzle-outputs{position:absolute;z-index:1;pointer-events:none;font:clamp(10px,2.8vw,14px)/1.5 system-ui,sans-serif;max-width:44%;background:#fafafa;}.puzzle-legend{top:12px;left:12px;}.puzzle-legend>div{display:flex;gap:7px;align-items:baseline;}.puzzle-legend i{display:inline-block;flex:0 0 8px;height:8px;border-radius:50%;}.puzzle-outputs{bottom:12px;right:12px;text-align:right;font-variant-numeric:tabular-nums;}.puzzle-outputs span{display:block;color:#656569;font-size:.85em;}.puzzle-outputs output{font-size:1.3em;}
${Object.entries({red:'#b83e39',green:'#25764b',blue:'#2869a3',amber:'#946515',teal:'#197b80',gray:'#656569'}).map(([name,color])=>`.puzzle-component-${name} :is(path,circle,ellipse,line,polyline,polygon),:is(path,circle,ellipse,line,polyline,polygon).puzzle-component-${name}{stroke:${color}!important;}`).join('')}
</style></head><body><div id="stage" data-hairline="generated"></div><script>${kernel}</script><script>${interactionSource}</script><script>${presentationSource}</script><script>
(()=>{'use strict';const channel=${inlineJSON(channel)},stage=document.getElementById('stage');
const svg=HL.mk('svg',{viewBox:'0 0 400 320','aria-label':'Interactive puzzle'},stage);HL.inject(stage);
const send=(type,data={})=>parent.postMessage({channel,type,...data},'*');
addEventListener('error',event=>send('puzzle-error',{message:String(event.message).slice(0,300)}));
addEventListener('unhandledrejection',event=>send('puzzle-error',{message:String(event.reason?.message||'Scene failed.').slice(0,300)}));
${puzzle.figureCode}
let scene;try{const presentation=puzzlePresentation(HL,stage,svg,simulationInteractions(svg));scene=mountPuzzle({HL:presentation.HL,stage,svg,interactions:presentation.interactions,onValue:value=>{if(value===null||typeof value==='number'&&Number.isFinite(value))send('puzzle-value',{value});},onExperimentValue:value=>{if(typeof value==='number'&&Number.isFinite(value))send('puzzle-experiment-value',{value});}},${inlineJSON(initial)});if(typeof scene?.update!=='function'||typeof scene?.destroy!=='function')throw new Error('Scene must return update and destroy.');scene.update(${inlineJSON(initial)});
let frames=0;function verifyScene(){try{const box=svg.getBBox();if(box.width>0&&box.height>0){if(box.x < -1 || box.y < -1 || box.x+box.width > 401 || box.y+box.height > 321)throw new Error('Initial geometry leaves the puzzle frame. Regenerate the scene.');send('puzzle-ready');}else if(++frames<90)requestAnimationFrame(verifyScene);else throw new Error('The scene did not draw any visible geometry.');}catch(error){send('puzzle-error',{message:String(error.message).slice(0,300)});}}requestAnimationFrame(verifyScene);}catch(error){send('puzzle-error',{message:String(error.message).slice(0,300)});}
addEventListener('message',event=>{if(event.source!==parent||event.data?.channel!==channel||event.data?.type!=='puzzle-state')return;try{stage.setAttribute('data-solved',String(event.data.config.solved));scene?.update(event.data.config);}catch(error){send('puzzle-error',{message:String(error.message).slice(0,300)});}});
addEventListener('pagehide',()=>{try{scene?.destroy();}catch{}});
})();</script></body></html>`;
}
export async function generatePuzzle(input, query, metadata = {}) {
  const description = validatePuzzleDescription(input), signal = AbortSignal.timeout(210000);
  const skillIds = await selectPuzzleSkills(description, query, signal);
  const instructions = generationInstructions(skillIds);
  let repair = '', puzzle;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await query(instructions, [{ role: 'user', content: JSON.stringify({ puzzleDescription: description, ...(repair ? { repair: `The previous response failed validation: ${repair}. Return the complete corrected puzzle.` } : {}) }) }], puzzleResponse, { signal });
      puzzle = validateGeneratedPuzzle(raw); break;
    } catch (error) { if (!(error instanceof InvalidOutputError) || attempt || signal.aborted) throw error; repair = error.message; }
  }
  const runId = randomUUID();
  return { ...puzzle, ...metadata, runId, promptVersion: puzzlePromptVersion, skillIds, generatedAt: new Date().toISOString(), repaired: Boolean(repair), previewHtml: assemblePuzzlePreview(puzzle, runId), checks: ['Input bounds and reachable answer', 'Exactly one correct choice (when applicable)', 'JavaScript syntax'], limitation: 'Scene rendering and subject-matter correctness still require review.' };
}
