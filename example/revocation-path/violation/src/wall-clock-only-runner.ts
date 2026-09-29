import { spawn, ChildProcess } from 'node:child_process';
import { RunState, TransitionLogEntry } from './types';

/**
 * VIOLATION (Revocation Path, the CHOP-9 addendum): the only bound on this
 * run is elapsed wall-clock time. Nothing here ever looks for an external
 * "stop now" signal while the child is running -- there is no on-demand
 * trigger of any kind, and the timeout's own kill is a plain SIGTERM with no
 * escalation. This mirrors the real nexus-daily-audit defect: a bare
 * `timeout "${AUDIT_CLAUDE_TIMEOUT}" "$CLAUDE_BIN" ...`, no `--kill-after`.
 *
 * The transition log below is CHOP-9 compliant on its own terms -- every
 * entry carries before/after/actor/timestamp. That compliance is exactly
 * what makes this example worth having: the log proves the run was
 * *recorded* as stopped. It does not prove the process *stopped*.
 */
export class WallClockOnlyRunner {
  private child?: ChildProcess;
  private state: RunState = 'idle';
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
    this.child = spawn('node', [scriptPath, ledgerPath, String(writeIntervalMs), String(ignoreSigterm)]);
    this.transition('running');

    setTimeout(() => {
      if (this.state !== 'running') return;
      this.child?.kill('SIGTERM');
      this.transition('timed_out');
    }, timeoutMs);
  }

  private transition(next: RunState): void {
    const before = this.state;
    this.state = next;
    this.log.push({ actor: 'WallClockOnlyRunner', before, after: next, timestamp: Date.now() });
  }
}
