// Runs the Python compiler as a child process: JSON payload in, font binary
// out. The venv created by `npm run setup:python` is preferred.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, 'python', 'build_font.py');
const VENV = path.join(here, '.venv', 'bin', 'python');
const TIMEOUT_MS = Number(process.env.GENTYPE_COMPILE_TIMEOUT || 45000);

export function pythonBin() {
  if (process.env.GENTYPE_PYTHON) return process.env.GENTYPE_PYTHON;
  if (fs.existsSync(VENV)) return VENV;
  return 'python3';
}

function run(args, input, { timeout = TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin(), args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out = [];
    const err = [];
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error('Font compilation timed out'));
    }, timeout);
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Could not start Python (${pythonBin()}): ${e.message}`));
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stderr = Buffer.concat(err).toString('utf8').trim();
      if (code !== 0) {
        let message = stderr || `Python exited with code ${code}`;
        try {
          const parsed = JSON.parse(stderr.split('\n').pop());
          if (parsed?.error) message = parsed.error;
        } catch { /* keep raw stderr */ }
        return reject(new Error(message));
      }
      let info = {};
      try { info = JSON.parse(stderr.split('\n').pop()); } catch { /* optional */ }
      resolve({ data: Buffer.concat(out), info });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

export async function compileFont(payload) {
  const { data, info } = await run([SCRIPT], JSON.stringify(payload));
  if (!data.length) throw new Error('The compiler returned an empty file');
  return { data, info };
}

let cached = null;
export async function pythonStatus() {
  if (cached) return cached;
  try {
    const { data } = await run(['-c', 'import json,fontTools,pathops;print(json.dumps({"fontTools":fontTools.version,"pathops":True}))'], '', { timeout: 15000 });
    cached = { ok: true, bin: pythonBin(), ...JSON.parse(data.toString('utf8')) };
  } catch (e) {
    cached = { ok: false, bin: pythonBin(), error: String(e.message || e) };
  }
  return cached;
}
