/** Sequential disposable UI regression; build first. No production URL or account. */
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
const cwd = process.cwd();
const out = resolve(process.env.PRO8_REPORT_DIR ?? '../pro8-ui-evidence');
await mkdir(out, { recursive: true });
const report = {
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  kind: 'agent-automated-validation-not-human-UAT',
  startedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    browser: 'Chromium via configured Playwright module/executable (or installed defaults)',
    network: 'localhost', data: 'disposable synthetic PGlite and controlled API fixtures', production: false,
  },
  suites: [],
};
const env = { ...process.env, UI_REPORT_DIR: out, UI_SCREENSHOT_DIR: out };
for (const suite of ['schedules', 'journals', 'confirmations', 'duties', 'exams', 'finance', 'support-cases', 'tasks', 'drafts', 'preferences', 'pro-7', 'shell', 'pro-7-production']) {
  const startedAt = new Date().toISOString(), start = performance.now();
  let output = '', timedOut = false;
  const code = await new Promise((accept) => {
    const child = spawn(process.execPath, ['tests/ui/' + suite + '.mjs'], {
      cwd, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stop = () => {
      if (!child.pid) return;
      try {
        if (process.platform === 'win32') child.kill('SIGKILL');
        else process.kill(-child.pid, 'SIGKILL');
      } catch { /* The test normally cleans up its own server. */ }
    };
    const timer = setTimeout(() => { timedOut = true; stop(); }, 180_000);
    const append = (chunk) => { output = (output + chunk).slice(-1_048_576); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', (error) => { append(error.message); });
    child.on('close', (exitCode) => { clearTimeout(timer); stop(); accept(exitCode ?? -1); });
  });
  await writeFile(out + '/' + suite + '.log', output);
  report.suites.push({
    suite, command: 'node tests/ui/' + suite + '.mjs', startedAt, finishedAt: new Date().toISOString(),
    exitCode: code, timedOut, elapsedSeconds: Math.round((performance.now() - start) / 10) / 100,
    summary: output.slice(-3500),
  });
  await writeFile(out + '/results.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ suite, exitCode: code, timedOut, elapsedSeconds: report.suites.at(-1).elapsedSeconds }));
}
report.finishedAt = new Date().toISOString();
await writeFile(out + '/results.json', JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.suites.some((suite) => suite.exitCode !== 0 || suite.timedOut) ? 1 : 0;
