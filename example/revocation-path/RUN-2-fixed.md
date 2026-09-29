# RUN 2: the fix, executed

Command:

```
npx vitest run fixed
```

Working directory shown below as `<repo-root>/example/revocation-path`; that prefix is the
only thing normalized from the raw terminal capture, everything after it is unedited.

```
 RUN  v3.2.7 <repo-root>/example/revocation-path

 ✓ fixed/test/revocable-runner.test.ts (7 tests) 2936ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > kills a SIGTERM-ignoring process in well under its 999s wall-clock timeout  370ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > stops the ledger from growing once revoked  665ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > records a transition log entry with before, after, actor, and timestamp (CHOP-9) only once death is confirmed  365ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > still honors the wall-clock timeout when nobody calls revoke  602ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > reports revoked: false, without throwing, for a run that already ended  365ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > handles two truly concurrent revoke() calls without either throwing, killing the process exactly once  367ms
   ✓ Revocation Path fix: RevocableRunner terminates on demand, independent of the wall clock > reports revoked: true, without throwing, when the process already exited on its own before revoke() is called  205ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  23:09:46
   Duration  3.15s (transform 40ms, setup 0ms, collect 33ms, tests 2.94s, environment 0ms, prepare 58ms)
```

[`fixed/src/revocable-runner.ts`](./fixed/src/revocable-runner.ts) introduces `revoke()` as an
action independent of the wall clock: it signals the guarded process's whole process group
(the child is spawned with `detached: true`) with `SIGTERM`, waits a short grace window, and
(if the process is still alive, exactly as it is here against the same `ignoreSigterm` agent from
RUN 1) escalates to `SIGKILL`, which cannot be caught, trapped, or ignored. The `revoked`
transition is only appended to the log once the process is *confirmed* dead, never merely
"signaled."

Two further failure modes are handled, both added after an independent review caught them in the
first version of this fix: the two `process.kill(-pid, ...)` calls are wrapped so a process that
already exited on its own (crash, normal completion) doesn't make `terminate()` throw an uncaught
`ESRCH` error; and an in-flight guard makes two overlapping `terminate()` calls (a concurrent
`revoke()` racing another `revoke()`, or racing the wall-clock timeout's own internal call)
resolve safely instead of both running the kill sequence at once.

- **Test 1** starts the same SIGTERM-ignoring process with a 999-second wall-clock timeout, then
  calls `revoke()` after 150ms. The process is confirmed dead (`process.kill(pid, 0)` throws)
  well under a second later, nowhere near the configured timeout.
- **Test 2** shows the ledger genuinely stops growing at the moment of revocation:
  `writesLater === writesAtRevoke` 300ms after the call returns, the same real-damage window
  RUN 1 left wide open.
- **Test 3** asserts the transition log entry carries `before: 'running'`, `after: 'revoked'`,
  the caller-supplied `actor`, and a numeric `timestamp`: CHOP rule 9, now backed by a
  confirmed kill rather than a hopeful one.
- **Test 4** confirms the wall-clock path is unchanged when nobody revokes: a 200ms timeout with
  no `revoke()` call still ends the process and logs `timed_out`, so the fix is additive, not a
  regression on the baseline behavior.
- **Test 5** confirms `revoke()` on an already-ended run reports `revoked: false` rather than
  throwing or double-logging a transition. This is the *sequential* case: by the time the second
  call runs, `state` has already moved off `'running'`, so the ordinary guard at the top of
  `revoke()` catches it before `terminate()` is ever entered a second time.
- **Test 6** exercises the case Test 5 cannot: two `revoke()` calls fired concurrently
  (`Promise.all`), both reading `state === 'running'` before either has finished. Without the
  in-flight guard added to `terminate()`, both calls would run the kill sequence at once; with it,
  exactly one calls `process.kill()` and transitions the log, the other returns `revoked: false`
  immediately, and the process is still confirmed dead by the end.
- **Test 7** kills the process's group out from under the runner with an external `SIGKILL`
  before `revoke()` is ever called, simulating a crash the runner didn't cause. `revoke()` still
  resolves (`revoked: true`) instead of throwing the uncaught `ESRCH` a naive `process.kill()`
  call would raise against an already-dead target.

## Proving the load-bearing assertion is not a tautology

Before finalizing this file, the `SIGKILL` escalation inside `terminate()` was disabled
(`if (false && !diedFromTerm)`) and the suite rerun:

```
npx vitest run fixed
```

```
 ❯ fixed/test/revocable-runner.test.ts (7 tests | 5 failed) 4347ms
   × ... kills a SIGTERM-ignoring process in well under its 999s wall-clock timeout 590ms
     → expected false to be true // Object.is equality
   × ... stops the ledger from growing once revoked 861ms
     → expected 39 to be 24 // Object.is equality
   × ... records a transition log entry with before, after, actor, and timestamp (CHOP-9) only once death is confirmed 559ms
     → expected undefined to match object { before: 'running', …(2) }
   × ... still honors the wall-clock timeout when nobody calls revoke 603ms
     → expected true to be false // Object.is equality
   ✓ ... reports revoked: false, without throwing, for a run that already ended  963ms
   × ... handles two truly concurrent revoke() calls without either throwing, killing the process exactly once 563ms
     → expected [ false, false ] to deeply equal [ false, true ]
   ✓ ... reports revoked: true, without throwing, when the process already exited on its own before revoke() is called  205ms

 Test Files  1 failed (1)
      Tests  5 failed | 2 passed (7)
```

Five of seven tests went red the moment the escalation was removed, including the wall-clock
control test, because without `SIGKILL` the same SIGTERM-ignoring agent survives the timeout
path too, not only the on-demand one. Test 6 (concurrent revoke) also goes red: with escalation
gone, neither racer can actually kill the process, so both correctly return `revoked: false`
where the working fix expects exactly one `true`.

The two that stayed green are not a gap in the escalation test, they are testing a different
code path entirely. Test 5 (sequential already-ended) and Test 7 (killed externally before
`revoke()` is called) both confirm the process is dead in the *first* `waitForExit` call, right
after the `SIGTERM`, before the disabled branch is ever reached. Their assertions never exercise
`SIGKILL` at all, so disabling it cannot turn them red: this is why Test 1 (the direct,
`SIGTERM`-ignoring case) is the one that has to fail for the escalation to be proven load-bearing,
not Test 5 or Test 7. Passing while disabled is the *correct*, expected outcome for those two,
not a missed case. The `SIGKILL` branch was then restored and the full suite (`npx vitest run`,
both `violation/` and `fixed/`) rerun green before this file and
[`RUN-1-violation.md`](./RUN-1-violation.md) were finalized: 9 passed, 0 failed, no orphan
processes left running afterward.
