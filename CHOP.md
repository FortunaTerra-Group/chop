# CHOP: the State Machine Coding Standard

**Version 1.0 · Apache-2.0 · Copyright 2026 FortunaTerra Technologies Inc.**

CHOP (Chat-Oriented Programming) is ten rules about where state lives, who may change it, and how a change proves it happened. It was written for services built and modified by coding agents, where the usual failure is a second owner for state that already had one. It is not a framework or a library; it is ten rules you check a design or a diff against, the same way you would check for SQL injection or an N+1 query. Every rule is short enough to enforce in review and concrete enough to test.

## The ten rules

1. **Single Source of Truth.** One authoritative owner per piece of state. No duplicated state across services.
2. **Encapsulate Transitions.** State changes happen through explicit API calls or event contracts only. No in-place mutations.
3. **Async Behavior.** Every asynchronous operation is modeled explicitly: a promise, a queue, a job with an id. No fire-and-forget without a log line.
4. **UI / Logic Separation.** The presentation layer never holds authoritative state. The server owns the truth; the client receives derived views.
5. **Atomic Reset.** A reset is transactional. A partial reset is forbidden: if step three fails, steps one and two are undone.
6. **Coordination Contracts.** Parent-child relationships between services are declared through an interface contract. No implicit coupling through shared tables, shared files, or shared assumptions.
7. **No Multiple Masters.** Exactly one service writes a given state field. Read replicas are fine; write authority is singular.
8. **Server-Side Statefulness.** Session, auth, and workflow state live server-side. The client gets a derived view, never the source.
9. **Transition Logging.** Every state transition emits a structured record with four fields: `before`, `after`, `actor`, `timestamp`.
10. **Default Scenario Validation.** Every state machine defines its default or fallback scenario, and has a test that exercises it.

## Why these ten

Most state-bug postmortems trace back to one of two root causes. **Write authority was ambiguous** (rules 1, 6, 7): two things thought they owned a field, or a parent and child disagreed about who calls whom. **A transition was invisible** (rules 2, 3, 9): something changed state without going through the one path anyone was watching. Rules 4, 5, 8 and 10 close the gaps that let those two hide: UI-held and client-held state both create a second source of truth by accident; a partial reset leaves a machine in a configuration none of its transitions can produce, which is a different bug from a wrong transition; and a machine with no defined failure path will improvise one in production. Rule 10 is the one teams skip. If the fallback is not written down and tested, the agent will invent it, differently, each time.

## The corollary that costs the most when missed: the Reader Rule

A control surface is only as split as its consumer. If several writers fan out into separate fragment files but the live reader still reads one file, the split changed nothing except where the collision hides. **Before designing any registry, allowlist, manifest, or config surface with more than one producer, name its reader first** (the file and line that actually consumes it), confirm the reader reads the form you write, and record the command that confirmed it. No reader means the artifact is decorative, and any metric built on it is a proxy with no predicate. Where the reader is single-file, the writer must be single-owner; no architecture removes that constraint.

## How to adopt it

1. Put this file in the repository root and reference it from whatever instructions your agents read (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, or equivalent).
2. At design time, before a stateful service is implemented, write down which rule maps to which field and owner. If you cannot name the single owner of a field, you have found the bug before it is written.
3. At review time, check every state-changing diff against rules 1, 2, 7, and 9 first. In our experience a second writer appearing on an existing field, or a transition that bypasses the logged path, is the largest share of real incidents.
4. Add rule 10's fallback test to every state machine before the feature test.
5. When a rule is violated for a reason, write the reason next to the violation. An undocumented exception is a second copy of the truth.

## What this is not

CHOP does not say *how* to implement a state machine. No prescribed library, no required pattern: an actor model, a reducer, a database row with a status column are all fine. It constrains only *who owns what* and *how ownership changes*, which is the part that is hard to fix after the fact and easy to enforce while a design is still on paper. A standard, not a library: adapt the ten rules to your stack; keep the property each one protects.

The companion [verification addendum](./VERIFICATION-ADDENDUM.md) (V1 to V5) covers how a change *proves itself* across surfaces, and why a check that cannot fail is not a check.
