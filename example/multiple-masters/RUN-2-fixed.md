# RUN 2: the fix, executed

Command:

```
npx vitest run fixed
```

Working directory shown below as `<repo-root>/example/multiple-masters`; that prefix is the
only thing normalized from the raw terminal capture, everything after it is unedited.

```
 RUN  v3.2.7 <repo-root>/example/multiple-masters

 ✓ fixed/test/single-owner.test.ts (3 tests) 5ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  22:54:19
   Duration  392ms (transform 81ms, setup 0ms, collect 72ms, tests 5ms, environment 0ms, prepare 112ms)
```

[`fixed/src/order-status-service.ts`](./fixed/src/order-status-service.ts) introduces
`OrderStatusService` as the single writer of `order.status`. `NotificationService` and
`FulfillmentService` (in [`fixed/src/notification-service.ts`](./fixed/src/notification-service.ts)
and [`fixed/src/fulfillment-service.ts`](./fixed/src/fulfillment-service.ts)) no longer touch
status at all; they call `applyRefundRequested` / `applyShipmentConfirmed` on the owner, which is
the only place a transition can happen (CHOP rule 2, Encapsulate Transitions). The owner keeps the
`occurredAt` of whichever event last set the status and refuses to apply an older one, so the
outcome depends on what happened in the world, not on which handler happened to run last.

[`fixed/test/single-owner.test.ts`](./fixed/test/single-owner.test.ts) replays the identical two
events from RUN 1, in both orders:

- Shipment processed first, then refund: status resolves to `shipped`, the same answer RUN 1 got
  by luck of the draw, now guaranteed rather than coincidental.
- Refund processed first, then shipment: status also resolves to `shipped`. This is the case that
  was wrong in RUN 1 (`refunded`); the owner sees the refund event is older than the shipment
  event that just occurred and refuses to move to `refunded`.

A third test asserts the transition log entry recorded for the winning event carries
`before`, `after`, `actor`, and `timestamp` (CHOP rule 9, Transition Logging), so the fix also
leaves behind the record RUN 1's version never produced.

Before writing this file, the precedence check inside `applyTransition` was deliberately disabled
and the suite rerun: the first test above failed with `expected 'refunded' to be 'shipped'`,
confirming the assertion is load-bearing and not a tautology. The check was then restored and the
full suite (`npx vitest run`, both `violation/` and `fixed/`) rerun green before this file and
[`RUN-1-violation.md`](./RUN-1-violation.md) were finalized.
