# RUN 1: the violation, executed

Command:

```
npx vitest run violation
```

Working directory shown below as `<repo-root>/example/revocation-path`; that prefix is the
only thing normalized from the raw terminal capture, everything after it is unedited.

```
 RUN  v3.2.7 <repo-root>/example/revocation-path

 ✓ violation/test/wall-clock-only-revocation.test.ts (2 tests) 1009ms
   ✓ Revocation Path violation: a wall-clock-only timeout is not a revocation path > logs a timed_out transition while the underlying OS process is still alive  406ms
   ✓ Revocation Path violation: a wall-clock-only timeout is not a revocation path > keeps writing to the external ledger well past its own logged timeout  602ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  22:50:41
   Duration  1.21s (transform 31ms, setup 0ms, collect 25ms, tests 1.01s, environment 0ms, prepare 62ms)
```

Both tests pass, and that is the point: the transition log is technically CHOP-9 compliant, and
that compliance hides the actual defect instead of catching it. The suite in
[`violation/test/wall-clock-only-revocation.test.ts`](./violation/test/wall-clock-only-revocation.test.ts)
starts [`WallClockOnlyRunner`](./violation/src/wall-clock-only-runner.ts) against
[`unattended-writer.mjs`](./violation/src/unattended-writer.mjs) with `ignoreSigterm = true` --
a stand-in for a real agent process stuck mid-tool-call, unresponsive to a graceful `SIGTERM`,
which is exactly the failure mode a plain `timeout` (no `--kill-after`) cannot handle.

- **Test 1** waits past the configured 150ms timeout and confirms two things at once: the
  runner's transition log *does* carry a `{ before: 'running', after: 'timed_out' }` entry
  (CHOP rule 9 is satisfied on its own terms), and the underlying OS process is *still alive*
  (`process.kill(pid, 0)` does not throw). The log says the run ended. It did not.
- **Test 2** measures the ledger file -- the stand-in for real external writes -- immediately
  after the logged timeout and again 400ms later. The count keeps growing:
  `writesLater > writesAtTimeout` held in the actual run. Every one of those extra lines is a
  side effect a working revocation path exists to prevent, and none of them were.

`WallClockOnlyRunner` exposes no `revoke()` method at all -- there is no on-demand lever of any
kind, only the wall clock, mirroring the real defect this example generalizes: an unattended,
highly privileged process bounded solely by an untested, `SIGTERM`-only timeout, with no way for
an external caller to end it sooner without finding its PID by hand.
