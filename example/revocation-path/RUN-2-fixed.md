# RUN 2: the fix, executed

Command:

```
npx vitest run fixed
```

Working directory shown below as `<repo-root>/example/revocation-path`; that prefix is the
only thing normalized from the raw terminal capture, everything after it is unedited.

```
 RUN  v3.2.7 <repo-root>/example/revocation-path

 ✓ fixed/test/revocable-runner.test.ts (5 tests) 2365ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > kills a SIGTERM-ignoring process in well under its 999s wall-clock timeout  367ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > stops the ledger from growing once revoked  665ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > records a transition log entry with before, after, actor, and timestamp (CHOP-9) only once death is confirmed  365ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > still honors the wall-clock timeout when nobody calls revoke  602ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > reports revoked: false, without throwing, for a run that already ended  365ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  22:50:45
   Duration  2.59s (transform 37ms, setup 0ms, collect 30ms, tests 2.36s, environment 0ms, prepare 70ms)
```

[`fixed/src/revocable-runner.ts`](./fixed/src/revocable-runner.ts) introduces `revoke()` as an
action independent of the wall clock: it signals the guarded process's whole process group
(the child is spawned with `detached: true`) with `SIGTERM`, waits a short grace window, and --
if the process is still alive, exactly as it is here against the same `ignoreSigterm` agent from
RUN 1 -- escalates to `SIGKILL`, which cannot be caught, trapped, or ignored. The `revoked`
transition is only appended to the log once the process is *confirmed* dead, never merely
"signaled."

- **Test 1** starts the same SIGTERM-ignoring process with a 999-second wall-clock timeout, then
  calls `revoke()` after 150ms. The process is confirmed dead (`process.kill(pid, 0)` throws)
  well under a second later -- nowhere near the configured timeout.
- **Test 2** shows the ledger genuinely stops growing at the moment of revocation:
  `writesLater === writesAtRevoke` 300ms after the call returns, the same real-damage window
  RUN 1 left wide open.
- **Test 3** asserts the transition log entry carries `before: 'running'`, `after: 'revoked'`,
  the caller-supplied `actor`, and a numeric `timestamp` -- CHOP rule 9, now backed by a
  confirmed kill rather than a hopeful one.
- **Test 4** confirms the wall-clock path is unchanged when nobody revokes: a 200ms timeout with
  no `revoke()` call still ends the process and logs `timed_out`, so the fix is additive, not a
  regression on the baseline behavior.
- **Test 5** confirms `revoke()` on an already-ended run reports `revoked: false` rather than
  throwing or double-logging a transition.

## Proving the load-bearing assertion is not a tautology

Before finalizing this file, the `SIGKILL` escalation inside `revoke()`'s private `terminate()`
method was commented out and the suite rerun:

```
npx vitest run fixed
```

```
 ❯ fixed/test/revocable-runner.test.ts (5 tests | 4 failed) 3551ms
   × ... kills a SIGTERM-ignoring process in well under its 999s wall-clock timeout 569ms
     → expected false to be true // Object.is equality
   × ... stops the ledger from growing once revoked 858ms
     → expected 41 to be 26 // Object.is equality
   × ... records a transition log entry with before, after, actor, and timestamp (CHOP-9) only once death is confirmed 559ms
     → expected undefined to match object { before: 'running', …(2) }
   × ... still honors the wall-clock timeout when nobody calls revoke 602ms
     → expected true to be false // Object.is equality
   ✓ ... reports revoked: false, without throwing, for a run that already ended  960ms

 Test Files  1 failed (1)
      Tests  4 failed | 1 passed (5)
```

Four of five tests went red the moment the escalation was removed -- including the wall-clock
control test, because without `SIGKILL` the same SIGTERM-ignoring agent survives the timeout
path too, not only the on-demand one. The fifth (already-ended run) still passed correctly,
since it never reaches the escalation branch at all. The `SIGKILL` line was then restored and
the full suite (`npx vitest run`, both `violation/` and `fixed/`) rerun green before this file
and [`RUN-1-violation.md`](./RUN-1-violation.md) were finalized -- 7 passed, 0 failed, no orphan
processes left running afterward.
