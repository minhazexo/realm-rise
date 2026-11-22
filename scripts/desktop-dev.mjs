// Desktop dev runner: starts the normal Vite dev server, waits until it
// answers, then opens the Electron shell against it. Closing the window stops
// the dev server too, so `bun run desktop:dev` is one command.
import { spawn } from 'node:child_process';

const PORT = 3000;
const URL = `http://localhost:${PORT}/`;
const isWin = process.platform === 'win32';
const bunx = isWin ? 'bunx.cmd' : 'bunx';

function start(cmd, args, env) {
  return spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
}

async function waitForServer(timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(URL);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const vite = start(bunx, ['vite'], {});
let electron = null;
let closing = false;

function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  try { electron?.kill(); } catch { /* already gone */ }
  try { vite.kill(); } catch { /* already gone */ }
  setTimeout(() => process.exit(code), 150);
}

vite.on('exit', (code) => {
  if (!closing) { console.error(`[desktop] vite exited (${code})`); shutdown(code ?? 1); }
});

if (!(await waitForServer())) {
  console.error('[desktop] dev server did not start');
  shutdown(1);
} else {
  electron = start(bunx, ['electron', '.'], { ROTR_DEV_URL: URL });
  electron.on('exit', (code) => shutdown(code ?? 0));
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
