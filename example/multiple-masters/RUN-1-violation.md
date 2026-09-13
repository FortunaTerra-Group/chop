# RUN 1: the violation, executed

Command:

```
npx vitest run violation
```

Working directory shown below as `<repo-root>/example/multiple-masters`; that prefix is the
only thing normalized from the raw terminal capture, everything after it is unedited.

```
 RUN  v3.2.7 <repo-root>/example/multiple-masters

 ✓ violation/test/multiple-masters.test.ts (2 tests) 3ms

 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  22:54:14
   Duration  378ms (transform 60ms, setup 0ms, collect 45ms, tests 3ms, environment 0ms, prepare 119ms)
```

Both tests pass, and that is the point: the bug does not crash anything, it just quietly produces
the wrong status. The
suite in [`violation/test/multiple-masters.test.ts`](./violation/test/multiple-masters.test.ts)
sends the exact same two domain events (a refund requested at 09:00, a shipment confirmed at
10:00) through [`NotificationService`](./violation/src/notification-service.ts) and
[`FulfillmentService`](./violation/src/fulfillment-service.ts), which both write `order.status`
directly on the shared [`OrderStore`](./violation/src/order-store.ts).

- Process shipment then refund: final status is `refunded`, even though the shipment (10:00) is
  the chronologically later fact. The order shows a refund it never actually completed instead of
  the delivery that already happened.
- Process refund then shipment (same two events, opposite order): final status is `shipped`,
  which happens to match reality, but only because `FulfillmentService` ran last. Nothing in the
  store makes that true in general.

Last write wins, not last event. Whichever service's handler happens to run last decides the
field, regardless of which event actually reflects the truer state of the order. That is CHOP
rule 7, No Multiple Masters: two services own the same field, so there is no owner who can be
asked which write should count.
