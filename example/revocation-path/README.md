# Example: Revocation Path (CHOP-9 addendum)

A small, runnable unattended-agent scenario showing what the Revocation Path addendum to
CHOP-9 (Transition Logging) catches and what fixing it looks like, rather than just describing
it in prose.

> The code, the bug, and both test runs below are real and were actually executed.
> Model: Claude Sonnet 5. Date: 2026-09-28.

## The scenario

A runner starts an unattended agent process that has live, real-world write access -- each
line it appends to a shared ledger file stands in for one external side effect (a comment
posted, a message sent, an email delivered). The agent occasionally misbehaves: mid-run, it
stops responding to `SIGTERM`, the same as a real process stuck inside a slow or hung tool
call.

[`violation/`](./violation) bounds that run with a wall-clock timeout only: when the timeout
elapses, the runner sends one `SIGTERM` and logs a `timed_out` transition. Nothing else ever
checks for a "stop now" signal while the process is running, and the timeout's own kill never
escalates past `SIGTERM`. [`fixed/`](./fixed) adds a `revoke()` action that is independent of
the wall clock, signals the process's whole group, and escalates to `SIGKILL` -- and only
records the transition once the process is *confirmed* dead.

## Which rule this demonstrates

Primarily **CHOP rule 9, Transition Logging**, extended by a corollary this example is meant to
motivate: *a transition log proves an agent's actions were recorded, not that they could be
stopped.* Any agent with live external-write access needs an independently-tested revocation
path -- a mechanism a real test proves actually terminates the process -- not merely a
wall-clock timeout, because a timeout fires on duration, never on behavior. (At FortunaTerra
this corollary is written down as a binding addendum to rule 9; CHOP.md itself states only the
base rule, and this example demonstrates the gap the addendum exists to close.)

The violation example is built specifically to keep CHOP rule 9 itself satisfied: every
transition, including the `timed_out` one, is logged with `before`, `after`, `actor`, and
`timestamp`. That is what makes it worth showing -- a diff that passes a CHOP-9 checklist can
still leave an unattended agent with live write access running.

This example is an original toy scenario built to demonstrate that class, not a transcription
of any real company's incident. It generalizes a real internal finding: an unattended, highly
privileged agent invocation bounded only by an untested, `SIGTERM`-only wall-clock timeout, with
no on-demand way to end it sooner.

## Running it

```sh
cd example/revocation-path
npm install
npm run test:violation   # RUN 1: the flaw, reproduced
npm run test:fixed       # RUN 2: the fix, verified
npm test                 # both suites together
```

## What each run shows

- [`RUN-1-violation.md`](./RUN-1-violation.md): a `timed_out` transition gets logged correctly,
  and the underlying OS process is still alive and still writing to the ledger well after that.
  Source: [`violation/src/wall-clock-only-runner.ts`](./violation/src/wall-clock-only-runner.ts),
  [`violation/src/unattended-writer.mjs`](./violation/src/unattended-writer.mjs), test at
  [`violation/test/wall-clock-only-revocation.test.ts`](./violation/test/wall-clock-only-revocation.test.ts).
- [`RUN-2-fixed.md`](./RUN-2-fixed.md): the same misbehaving process is confirmed dead in well
  under a second against a 999-second wall-clock timeout, the ledger stops growing at the moment
  of revocation, and the `revoked` transition is only logged once death is confirmed. Source:
  [`fixed/src/revocable-runner.ts`](./fixed/src/revocable-runner.ts),
  [`fixed/src/unattended-writer.mjs`](./fixed/src/unattended-writer.mjs), test at
  [`fixed/test/revocable-runner.test.ts`](./fixed/test/revocable-runner.test.ts).

Both `violation/` and `fixed/` stay in the repository side by side, on purpose: either one can
be run on its own at any time, so the flaw is not just a claim about code that used to exist, it
is code you can still run and watch fail the same way today.
