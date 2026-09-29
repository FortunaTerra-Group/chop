import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WallClockOnlyRunner } from '../src/wall-clock-only-runner';

const SCRIPT_PATH = fileURLToPath(new URL('../src/unattended-writer.mjs', import.meta.url));

function countLines(path: string): number {
  try {
    return readFileSync(path, 'utf8').split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('Revocation Path violation: a wall-clock-only timeout is not a revocation path', () => {
  let workdir: string;
  let ledgerPath: string;
  let runner: WallClockOnlyRunner;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'chop-revocation-violation-'));
    ledgerPath = join(workdir, 'ledger.log');
    runner = new WallClockOnlyRunner();
  });

  afterEach(() => {
    // Test cleanup only. SIGKILL is not something WallClockOnlyRunner's own
    // API exposes anywhere. That missing capability is the point being
    // demonstrated; this call exists so the suite does not leak processes.
    const pid = runner.getPid();
    if (pid) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
    rmSync(workdir, { recursive: true, force: true });
  });

  it('logs a timed_out transition while the underlying OS process is still alive', async () => {
    // A misbehaving/hung agent: it swallows SIGTERM instead of exiting on
    // it, the same as a real LLM-agent process mid-tool-call.
    runner.start(SCRIPT_PATH, ledgerPath, 20, 150, true);

    await sleep(400);

    const entry = runner.getTransitionLog().find((e) => e.after === 'timed_out');
    // CHOP-9 (Transition Logging) is satisfied: the transition was recorded.
    expect(entry).toMatchObject({ before: 'running', after: 'timed_out' });

    const pid = runner.getPid();
    // THE FLAW: the transition log proves the run was recorded as stopped.
    // It does not prove the process stopped. It didn't.
    expect(pid && isAlive(pid)).toBe(true);
  });

  it('keeps writing to the external ledger well past its own logged timeout', async () => {
    runner.start(SCRIPT_PATH, ledgerPath, 20, 150, true);

    await sleep(200); // just past the 150ms timeout
    const writesAtTimeout = countLines(ledgerPath);

    await sleep(400); // the real-damage window a working revocation path exists to close
    const writesLater = countLines(ledgerPath);

    // A working revocation path would have stopped the ledger from growing
    // once the run was logged as ended. Here it keeps growing: real
    // external side effects (each line stands in for one live write: a
    // GitHub comment, a Discord message, an email) that the logged
    // 'timed_out' transition did nothing to prevent.
    expect(writesLater).toBeGreaterThan(writesAtTimeout);
  });
});
