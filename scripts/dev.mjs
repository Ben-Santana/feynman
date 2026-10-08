import { spawn } from 'node:child_process';
import { readFileSync, watch, watchFile, unwatchFile } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
const backendDirectory = fileURLToPath(new URL('../backend/', import.meta.url));
const sourceDirectory = join(backendDirectory, 'src');
const sharedTypes = fileURLToPath(new URL('../frontend/src/learningTypes.js', import.meta.url));
const children = new Set();
let stopping = false;
let restarting = false;
let backend;
function startBackend() {
  backend = spawn(process.execPath, ['--env-file-if-exists=.env', 'src/server.js'], { cwd: backendDirectory, stdio: 'inherit' });
  children.add(backend);
  backend.on('exit', code => {
    children.delete(backend);
    if (stopping) return;
    if (restarting) { restarting = false; startBackend(); }
    else stop(code || 0);
  });
  backend.on('error', () => stop(1));
}
startBackend();
const frontend = spawn(process.execPath, [vite], { cwd: fileURLToPath(new URL('../frontend/', import.meta.url)), stdio: 'inherit' });
children.add(frontend);
frontend.on('exit', code => stop(code || 0));
frontend.on('error', () => stop(1));
// Filter actual source paths. Native Node watch mode on macOS can restart for
// writes outside its watch paths, including OAuth credentials and prompts.
const sourceWatcher = watch(sourceDirectory, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  const path = resolve(sourceDirectory, filename);
  if (!path.startsWith(sourceDirectory + sep) || !path.endsWith('.js') || path.endsWith('.test.js')) return;
  restartBackend();
});
let typesSource = readFileSync(sharedTypes, 'utf8');
watchFile(sharedTypes, { interval: 500 }, () => {
  let next;
  try { next = readFileSync(sharedTypes, 'utf8'); }
  catch { return; } // Editors may briefly remove a file during atomic saves.
  if (next !== typesSource) { typesSource = next; restartBackend(); }
});
function restartBackend() {
  if (stopping || restarting) return;
  restarting = true;
  console.info('Backend source changed; restarting Feynman API.');
  backend.kill('SIGTERM');
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  sourceWatcher.close();
  unwatchFile(sharedTypes);
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
