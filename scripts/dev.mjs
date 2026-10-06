import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const vite = join(dirname(require.resolve('vite/package.json')), 'bin/vite.js');
// Keep the OAuth callback listener alive. Native watch mode can restart on
// credential-store writes outside src on macOS. Restart dev for backend edits.
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'src/server.js'], { cwd: fileURLToPath(new URL('../backend/', import.meta.url)), stdio: 'inherit' }),
  spawn(process.execPath, [vite], { cwd: fileURLToPath(new URL('../frontend/', import.meta.url)), stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const child of children) { child.on('exit', code => stop(code || 0)); child.on('error', () => stop(1)); }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
