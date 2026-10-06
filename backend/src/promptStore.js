import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promptCatalog } from './promptCatalog.js';

export const promptFile = fileURLToPath(new URL('../prompts.json', import.meta.url));
const specs = new Map(promptCatalog.map(spec => [spec.id, spec]));
export class PromptError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function validateText(spec, text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 30000) throw new PromptError('Enter a nonempty prompt of up to 30,000 characters.');
  const variables = [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]))];
  if (variables.some(variable => !spec.variables.includes(variable)) || spec.variables.some(variable => !variables.includes(variable))) throw new PromptError(`Keep these template variables: ${spec.variables.map(variable => '{{' + variable + '}}').join(', ') || 'none'}.`);
}
export function loadPrompts(path = promptFile) {
  let source, values;
  try { source = readFileSync(path, 'utf8'); values = JSON.parse(source); }
  catch { throw new PromptError('Could not read backend/prompts.json. Check that it contains valid JSON.', 500); }
  if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length !== specs.size || Object.keys(values).some(id => !specs.has(id))) throw new PromptError('The prompt file does not match the prompt catalog.', 500);
  for (const spec of promptCatalog) validateText(spec, values[spec.id]);
  const version = createHash('sha256').update(source).digest('hex');
  return {
    version, values,
    text(id, variables = {}) {
      if (!specs.has(id)) throw new PromptError(`Unknown prompt: ${id}.`, 500);
      return values[id].replace(/\{\{(\w+)\}\}/g, (_, variable) => {
        if (!Object.hasOwn(variables, variable)) throw new PromptError(`Missing prompt variable: ${variable}.`, 500);
        return String(variables[variable]);
      });
    },
    profile(type) {
      return Object.fromEntries(['help', 'tasks', 'scenarios'].map(section => [section, Object.fromEntries(promptCatalog.filter(spec => spec.id.startsWith(`profile.${type}.${section}.`)).map(spec => [spec.id.split('.').at(-1), values[spec.id]]))]));
    },
  };
}
export function listPrompts(path = promptFile) {
  const { version, values } = loadPrompts(path);
  return { file: 'backend/prompts.json', version, prompts: promptCatalog.map(spec => ({ ...spec, text: values[spec.id] })) };
}
export function savePrompt(input, path = promptFile) {
  const spec = specs.get(input?.id);
  if (!spec) throw new PromptError('Choose a known prompt.');
  validateText(spec, input.text);
  const current = loadPrompts(path);
  if (typeof input.version !== 'string' || input.version !== current.version) throw new PromptError('The prompt file changed since you loaded it. Reload the prompts before saving.', 409);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify({ ...current.values, [spec.id]: input.text }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(temporary, path);
  } catch {
    try { unlinkSync(temporary); } catch { /* A failed write may not create a file. */ }
    throw new PromptError('Could not save backend/prompts.json. Check that the backend can write this file.', 500);
  }
  return listPrompts(path);
}
