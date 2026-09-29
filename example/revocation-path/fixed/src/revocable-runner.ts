import { spawn, ChildProcess } from 'node:child_process';
import { RunState, TransitionLogEntry } from './types';

export interface RevokeResult {
  revoked: boolean;
  reason: string;
}

const SIGTERM_GRACE_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * FIX (Revocation Path, the CHOP-9 addendum): revoke() is a separate,
 * externally-callable action, independent of the wall-clock timeout, not a
 * flag consulted only the next time the timeout happens to fire. It signals
 * the child's own PROCESS GROUP (the child is spawned with `detached: true`),
 * not just the single PID, and escalates SIGTERM to SIGKILL after a grace
 * window, mirroring `timeout --kill-after`, so a process that swallows
 * SIGTERM (see unattended-writer.mjs's ignoreSigterm mode) is still
 * terminated, because SIGKILL cannot be caught, trapped, or ignored.
 *
 * Whole-group signaling is asserted by construction here, not independently
 * exercised: every test in this suite uses a leaf process with no children
 * of its own, so the "a grandchild can't outlive the parent it was meant to
 * die with" guarantee is not proven by this test file the way the rest of
 * the class's behavior is.
 *
 * The transition log only records `revoked` once the process is CONFIRMED
 * dead (see waitForExit): a caller must never claim revocation succeeded and
 * then let the process silently keep running.
 *
 * Two failure modes a naive version of this class hits, both fixed below:
 * a process that already exited on its own (crash, normal completion) makes
 * `process.kill(-pid, ...)` throw ESRCH, which must not propagate as an
 * uncaught rejection; and two overlapping terminate() calls (a concurrent
 * revoke() racing the wall-clock timeout's own internal call, or two
 * concurrent revoke() calls) must not both run the kill sequence at once.
 */
export class RevocableRunner {
  private child?: ChildProcess;
  private state: RunState = 'idle';
  private terminating = false;
  private readonly log: TransitionLogEntry[] = [];

  getState(): RunState {
    return this.state;
  }

  getTransitionLog(): readonly TransitionLogEntry[] {
    return this.log;
  }

  getPid(): number | undefined {
    return this.child?.pid;
  }

  start(scriptPath: string, ledgerPath: string, writeIntervalMs: number, timeoutMs: number, ignoreSigterm: boolean): void {
    this.child = spawn('node', [scriptPath, ledgerPath, String(writeIntervalMs), String(ignoreSigterm)], {
      detached: true,
    });
    this.transition('running', 'RevocableRunner');

    setTimeout(() => {
      if (this.state !== 'running') return;
      void this.terminate('wall_clock_timeout', 'timed_out', 'RevocableRunner');
    }, timeoutMs);
  }

  async revoke(reason: string, actor = 'operator'): Promise<RevokeResult> {
    if (this.state !== 'running') {
      return { revoked: false, reason: 'not running' };
    }
    const died = await this.terminate(reason, 'revoked', actor);
    return { revoked: died, reason };
  }

  private async terminate(reason: string, nextState: RunState, actor: string): Promise<boolean> {
    const pid = this.child?.pid;
    // The in-flight guard matters even though callers already check
    // `state !== 'running'` first: state only changes once death is
    // CONFIRMED, several awaits below, so two calls that both read
    // 'running' before either finishes would otherwise both run the kill
    // sequence at once.
    if (!pid || this.terminating) return false;
    this.terminating = true;

    try {
      // Signal the PROCESS GROUP (negative pid), not just the one PID: a
      // guarded process that has spawned its own children needs the whole
      // group signaled, or a child can outlive the parent it was meant to
      // die with.
      this.signal(pid, 'SIGTERM');
      const diedFromTerm = await this.waitForExit(pid, SIGTERM_GRACE_MS);

      if (!diedFromTerm) {
        this.signal(pid, 'SIGKILL');
      }
      const confirmedDead = diedFromTerm || (await this.waitForExit(pid, SIGTERM_GRACE_MS));

      if (confirmedDead) {
        this.transition(nextState, actor);
      }
      return confirmedDead;
    } finally {
      this.terminating = false;
    }
  }

  // A process that already exited on its own (crash, normal completion,
  // OOM) makes this throw ESRCH. The target is gone, which is the outcome
  // we wanted anyway. Any other error is a real, unexpected failure and
  // must still surface.
  private signal(pid: number, sig: NodeJS.Signals): void {
    try {
      process.kill(-pid, sig);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ESRCH') throw err;
    }
  }

  private async waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!this.isAlive(pid)) return true;
      await sleep(10);
    }
    return !this.isAlive(pid);
  }

  private isAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private transition(next: RunState, actor: string): void {
    const before = this.state;
    this.state = next;
    this.log.push({ actor, before, after: next, timestamp: Date.now() });
  }
}
