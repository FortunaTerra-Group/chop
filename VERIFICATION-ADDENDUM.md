# CHOP Verification and Consistency Addendum (V1 to V5)

The ten rules in [CHOP.md](./CHOP.md) say where state lives and how it changes. These five say how a change **proves** it did what it claims, across every surface it touched. V1 to V4 govern what a change must prove; V5 governs whether the proving apparatus can fail at all. It is last because it is the one that makes the other four mean anything.

This file states the principles. The executable gates that enforce them in a given organization are tooling, and are not part of this standard. Throughout, the *orchestrator* is whatever runs the check and is not the agent that made the change: a CI job, a script, a human.

## V1. Cross-surface consistency

A change touching more than one client surface (iOS, Android, web) asserts parity across **all** of them on three axes: back-end ↔ front-end contract shape, security posture (auth model, row-level policy, headers), and API version. No surface may quietly deviate. A metric recomputed on one client and read from the engine on another is two sources of truth wearing one label.

## V2. Real-life and adversarial gating

Beyond unit tests, every increment ships three further kinds of test, tied to that increment's stated goal and gating the merge: **real-life** (the actual journey, on the actual stack), **randomized** (seeded or property-based inputs), and **adversarial** (auth bypass, tampering, races, idempotency). A green unit suite says the code matches the author's model of the problem; these say the model matches the world.

## V3. UI verification by the orchestrator, never by the agent's claim

A UI change is verified by driving the **real** interface and capturing an **ordered sequence of on-device snapshots** that the orchestrating process checks itself: DOM, image, and order. The agent's statement that it worked is not evidence. This is non-waivable: if a snapshot cannot be produced for any reason (device absent, wrong host, capability missing), the gate **stops and hands off to a human** with a `Blocked` verdict. It is never marked green by assumption. A platform that cannot be driven from the orchestrator's host gets a structured handoff to a host that can, and blocks until it returns.

## V4. UX coherence and cross-seam parity

A UI change is judged as **one experience**, not a set of screens that each happen to render. Sweep the dimension families (journey coherence, single-backend parity across seams, heuristic usability, state coverage, visual fidelity, accessibility, copy, reasonableness and honesty of what is shown, onboarding, perceived performance, evidence, adversarial UX) and treat a defect nobody owns as still a defect. Five rules bind:

- **(a) One backend, thin clients** (CHOP rules 1, 7, 8). No surface recomputes a value the engine owns or invents a default; no surface silently lacks a capability the others have.
- **(b) A number that does not move with its own inputs is fabricated.** Validate numbers by *variation*, not by eyeballing. You cannot tell a derived 2,150 from a hallucinated one by looking; only by its sensitivity.
- **(c) No data is not no defects.** A dimension nobody measured is *unassessed*, never clean.
- **(d) Hiding must never be cheaper than admitting.** No input a caller can withhold, shrink, or empty may yield a better verdict than an honest one. An empty list is a claim ("we looked, there are none") and must be made explicitly, never inferred from silence. A surface you decline to declare is still in scope; the gate reconciles against what your own artifacts prove exists.
- **(e) Four terminal states, never two.** **PASS** · **FAIL** (the product is broken) · **BLOCKED** (the harness could not measure it) · **MALFORMED** (the caller handed in an incoherent input and gets no verdict about their product at all). Collapsing BLOCKED or MALFORMED into FAIL reports your failure as their defect; collapsing either into PASS is the skip button. A run that measured nothing is not a clean run.

V4 inherits V3's stop condition: no self-verified snapshot, no pass.

## V5. Gate integrity: a check that cannot fail is not a check

V1 to V4 say what a change must prove. V5 says the proving apparatus is itself under test. A green is a claim about the product only if the check could have gone red. Four rules bind:

- **(a) Prove every load-bearing assertion bites.** Revert the behavior an assertion guards and confirm *that assertion* goes red, per assertion, not per suite. An untested assertion is decoration; an unfalsifiable check contributes nothing to the verdict and everything to the reader's confidence.
- **(b) No vacuous greens.** A check that passes without asking anything is worse than no test: it spends the budget of a real one, counts toward coverage, and certifies what it never examined. The recurring shapes: the tautology (`expect(true).toBe(true)`); the coincidental green (`length > 0`, true even when every request failed); the empty-state-satisfied word search; the right-answer-wrong-reason (a 404 for a closed door *and* for an empty store); the precondition-as-pass (an early `return` inside a test body that the runner counts as passed; an unmet precondition is BLOCKED, so `throw`); and the worst, a logger masquerading as an assertion, a helper that records a finding and continues, producing a fully green suite with the product broken exactly where the helper said it was. **A load-bearing finding is an assertion, never a log.**
- **(c) The harness's own blind spots are the real enemy.** When the harness is the proxy, every assertion running on it inherits the gap. A browser harness that loads no stylesheet makes "is visible" pass on a panel that is 95% clipped, because nothing is clipped when nothing is styled; an automation click that auto-scrolls a hidden element into view makes a missing affordance indistinguishable from a working one. Load the real stylesheet and assert visibility *geometry* before interacting, never DOM existence alone. No stylesheet, no visibility verdict.
- **(d) Drive the product, not the endpoint, and cover the whole state machine.** A step reachable only through the API is a failure (a missing affordance), never a pass. A walk that drives only the forward path certifies only the forward path: drive the terminal and reverse transitions too (rejected, expired, withdrawn, countered), assert the visible state marker each time, or an atomic-reset defect (CHOP rule 5) ships while the gate stays green.

## Verification capacity

A verification standard that cannot be run at the pace the team ships is a standard on paper. Size the verification budget with the feature budget, not after it. When the two collide: expand verification capacity first; throttle delivery second; lower a quality threshold only last, and never silently.
