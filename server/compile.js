// Runs Python helpers (fontTools) as child processes: optional JSON on
// stdin, binary or text on stdout, a JSON status line on stderr.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const VENV = path.join(here, '.venv', 'bin', 'python');
const TIMEOUT_MS = Number(process.env.GENTYPE_COMPILE_TIMEOUT || 60000);

export function pythonBin() {
  if (process.env.GENTYPE_PYTHON) return process.env.GENTYPE_PYTHON;
  return fs.existsSync(VENV) ? VENV : 'python3';
}

// runPython(script, args, stdin) — or runPython('-c', [code, ...args]).
export function runPython(script, args = [], input = '', { timeout = TIMEOUT_MS } = {}) {
  const argv = script === '-c' ? ['-c', ...args] : [script, ...args];
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin(), argv, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    let settled = false;
    const finish = (fn) => { if (!settled) { settled = true; clearTimeout(timer); fn(); } };
    const timer = setTimeout(() => finish(() => { child.kill('SIGKILL'); reject(new Error('Font compilation timed out')); }), timeout);
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', (e) => finish(() => reject(new Error(`Could not start Python (${pythonBin()}): ${e.message}`))));
    child.on('close', (code) => finish(() => {
      const stderr = Buffer.concat(err).toString('utf8').trim();
      const last = stderr.split('\n').pop();
      let status = {};
      try { status = JSON.parse(last); } catch { /* not a status line */ }
      if (code !== 0) return reject(new Error(status.error || stderr || `Python exited with code ${code}`));
      resolve({ data: Buffer.concat(out), info: status });
    }));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

let cached = null;
export async function pythonStatus() {
  if (cached) return cached;
  try {
    const { data } = await runPython('-c', ['import json,fontTools;print(json.dumps({"fontTools":fontTools.version}))'], '', { timeout: 15000 });
    cached = { ok: true, bin: pythonBin(), ...JSON.parse(data.toString('utf8')) };
  } catch (e) {
    cached = { ok: false, bin: pythonBin(), error: String(e.message || e) };
  }
  return cached;
}
