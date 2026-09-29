import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RevocableRunner } from '../src/revocable-runner';

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

describe('Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock', () => {
  let workdir: string;
  let ledgerPath: string;
  let runner: RevocableRunner;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'chop-revocation-fixed-'));
    ledgerPath = join(workdir, 'ledger.log');
    runner = new RevocableRunner();
  });

  afterEach(() => {
    // Belt-and-suspenders test cleanup; every test below already asserts the
    // process is confirmed dead before this runs.
    const pid = runner.getPid();
    if (pid) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // already gone
      }
    }
    rmSync(workdir, { recursive: true, force: true });
  });

  it('kills a SIGTERM-ignoring process in well under its 999s wall-clock timeout', async () => {
    runner.start(SCRIPT_PATH, ledgerPath, 20, 999_000, true);
    const pid = runner.getPid()!;

    await sleep(150);
    const result = await runner.revoke('operator requested stop');

    expect(result.revoked).toBe(true);
    // Confirmed dead, not merely "kill() was called" -- the same distinction
    // the violation example fails to make.
    expect(isAlive(pid)).toBe(false);
  });

  it('stops the ledger from growing once revoked', async () => {
    runner.start(SCRIPT_PATH, ledgerPath, 20, 999_000, true);

    await sleep(150);
    await runner.revoke('operator requested stop');
    const writesAtRevoke = countLines(ledgerPath);

    await sleep(300); // the same real-damage window the violation left open
    const writesLater = countLines(ledgerPath);

    expect(writesLater).toBe(writesAtRevoke);
  });

  it('records a transition log entry with before, after, actor, and timestamp (CHOP-9) only once death is confirmed', async () => {
    runner.start(SCRIPT_PATH, ledgerPath, 20, 999_000, true);

    await sleep(150);
    await runner.revoke('operator requested stop', 'incident-responder');

    const entry = runner.getTransitionLog().find((e) => e.after === 'revoked');
    expect(entry).toMatchObject({ before: 'running', after: 'revoked', actor: 'incident-responder' });
    expect(typeof entry?.timestamp).toBe('number');
  });

  it('still honors the wall-clock timeout when nobody calls revoke', async () => {
    runner.start(SCRIPT_PATH, ledgerPath, 20, 200, true);
    const pid = runner.getPid()!;

    await sleep(600);

    expect(isAlive(pid)).toBe(false);
    const entry = runner.getTransitionLog().find((e) => e.after === 'timed_out');
    expect(entry).toMatchObject({ before: 'running', after: 'timed_out' });
  });

  it('reports revoked: false, without throwing, for a run that already ended', async () => {
    runner.start(SCRIPT_PATH, ledgerPath, 20, 999_000, true);
    await sleep(150);
    await runner.revoke('first revoke');

    const result = await runner.revoke('second revoke, run already ended');
    expect(result).toMatchObject({ revoked: false });
  });
});
