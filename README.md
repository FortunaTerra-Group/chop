# CHOP

**Ten rules that keep coding agents from breaking your state machines.**

> Free standard, Apache-2.0. The ten rules are in [`CHOP.md`](./CHOP.md); the five verification rules are in [`VERIFICATION-ADDENDUM.md`](./VERIFICATION-ADDENDUM.md). Drop them into whatever file your coding agents read. The addendum's last rule was written after eight defects shipped through roughly twelve thousand passing tests; if your verification is run by agents, read V5 first. The rest of this page is why the rules exist.

---

When coding agents modify a real system, the usual failure is a second copy of the truth, not a wrong algorithm.

The agent needs a value the client already has, so it caches it. It needs a status the server tracks, so it derives one locally. It needs a reset, so it clears the three tables it knows about. Each change passes review because each change is small and locally reasonable, and each one plants a second owner for something that already had one. Six weeks later two screens disagree about the same record, and nobody can say which is right, because both are, for their copy.

CHOP is the standard we wrote to stop that. It has ten rules and one corollary, and they fit on one page. It is not a framework or a library; it is a list you check a design or a diff against, the way you would check for SQL injection or an N+1 query. If you cannot name the single owner of a field, you have found the bug before it is written.

The name is Chat-Oriented Programming, the step after object-oriented programming. The term is Steve Yegge's; the standard is ours. OOP put ownership of state behind a class boundary. When the code is written in conversation with an agent, the only boundary that holds is one the agent can read, so who owns a piece of state and who may change it has to be written down as a rule.

## The ten rules, and the failure each one names

**1. Single Source of Truth.** One owner per piece of state. *The failure:* a "harmless" local cache that becomes the thing users actually see.

**2. Encapsulate Transitions.** State changes go through an explicit call or event contract. *The failure:* a direct row update from a script that skips the validation the API does.

**3. Async Behavior.** Every asynchronous step is modeled; nothing is fired and forgotten without a log line. *The failure:* a background send that fails silently one time in fifty.

**4. UI / Logic Separation.** The client renders derived views; it never holds the truth. *The failure:* the front end decides the order is "complete" because the last spinner stopped.

**5. Atomic Reset.** Resets are transactional or not at all. *The failure:* a partial reset that clears the queue but not the counter, leaving a state no code path can reach on purpose.

**6. Coordination Contracts.** Parent-child service relationships are declared. *The failure:* two services that agree by coincidence until one of them is refactored.

**7. No Multiple Masters.** One writer per field. *The failure:* two crons that both "fix" the same column, in opposite directions, on alternating nights.

**8. Server-Side Statefulness.** Session, auth, workflow state live on the server. *The failure:* a role flag held in the client that the server trusts to decide what the user may do.

**9. Transition Logging.** Every transition records `before`, `after`, `actor`, `timestamp`. *The failure:* an audit that can prove a value changed but not who changed it from what.

**10. Default Scenario Validation.** The fallback path is written down and tested. *The failure:* the agent invents the empty-state behavior, differently, every time it touches the file.

## Why agents specifically

A human engineer who has worked on a system for a year carries its ownership map in their head. An agent does not; it carries the files in its context window. Where the truth for a value lives is exactly the kind of fact that is not in any one file, so the agent reconstructs it from what it can see, and what it can see is usually the nearest copy. The rules make the ownership map explicit enough that an agent can read it, and rule 9 makes every transition leave a trail the next agent can follow.

That is also why the rules are short. A forty-page architecture document is not going to be in the context window when it matters. Ten lines are.

## Proving a change, not just making one

The ten rules say where state lives and how it moves. They do not say how you know a change did what it claimed. That is the [verification addendum](./VERIFICATION-ADDENDUM.md), five more rules that came out of the same work. The most important is the last one:

> **A check that cannot fail is not a check.** A green is a claim about the product only if the test could have gone red.

We wrote V5 after eight defects shipped through roughly twelve thousand passing tests. Every gate was reporting success. The tests were real; the assertions inside them were not: tautologies, coincidental greens, early returns the runner counted as passes, and one helper that logged findings instead of asserting them, producing a suite indistinguishable from a rigorous one with the product broken exactly where the log said it was.

The rules also do not say what *done* means before the agent starts. That is the companion standard, [goal-contract](https://github.com/FortunaTerra-Group/goal-contract): the contract you write before the code.

## Adopting it

1. Copy the standard into the repository:
   ```sh
   curl -fsSL https://raw.githubusercontent.com/FortunaTerra-Group/chop/main/CHOP.md -o CHOP.md
   ```
2. Reference it from the file your agents read (`AGENTS.md`, `CLAUDE.md`, `.cursorrules`, whatever your tooling uses), for example:
   ```
   All state-changing diffs follow ./CHOP.md rules 1 to 10. Review rules 1, 2, 7 and 9 first.
   ```
3. In review, check state-changing diffs against rules 1, 2, 7 and 9 first. In our experience they catch most of the drift.
4. Write rule 10's fallback test before the feature test.
5. When a rule is violated for a reason, write the reason next to the violation. An undocumented exception is a second copy of the truth.

## Provenance and license

CHOP was written at FortunaTerra in early 2026 for a multi-service system built and maintained largely by coding agents, and has been the review standard there since. The verification addendum followed in July 2026 from the incidents described above. Copyright 2026 FortunaTerra Technologies Inc. Written and maintained by Vivek Iyer ([FortunaTerra-Group](https://github.com/FortunaTerra-Group)). Released under [Apache-2.0](./LICENSE). Issues and pull requests are welcome; the bar for changing a rule is a concrete failure the current wording lets through.
