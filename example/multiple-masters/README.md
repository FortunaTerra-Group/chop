# Example: No Multiple Masters (CHOP rule 7)

A small, runnable order-status scenario showing what CHOP rule 7 catches and what fixing it
looks like, rather than just describing it in prose.

> The code, the bug, and both test runs below are real and were actually executed.
> Model: Claude Sonnet 5. Date: 2026-09-13.

## The scenario

An order has one status field. Two services react to two different real-world events for that
same order:

- `NotificationService` handles a customer's refund request.
- `FulfillmentService` handles the warehouse confirming a shipment.

Both write to `order.status` directly. Nothing designates either one as the owner, and nothing
checks whether an incoming event is still relevant by the time it arrives.

[`violation/`](./violation) implements that version. [`fixed/`](./fixed) implements the same
scenario with a single owner, `OrderStatusService`, that is the only thing allowed to write the
field; the other two services now call into it instead of touching status themselves.

## Which rule this demonstrates

Primarily **CHOP rule 7, No Multiple Masters**: exactly one service should write a given state
field. The fix also leans on rule 1 (Single Source of Truth: `OrderStatusService` is now the one
place `order.status` lives) and rule 2 (Encapsulate Transitions: the only way to change status is
through `applyRefundRequested` / `applyShipmentConfirmed`, not a direct field write). CHOP.md
groups 1, 6, and 7 together as the "write authority was ambiguous" failure class for exactly this
reason.

The failure mode itself, two independent writers racing to set the same field with the result
depending on arrival order rather than on which write is actually correct, is a well-documented
class of distributed-systems bug, usually discussed under "dual write" or "last write wins"
race conditions. This example is an original toy scenario built to demonstrate that class, not a
transcription of any real company's incident.

## Running it

```sh
cd example/multiple-masters
npm install
npm run test:violation   # RUN 1: the bug, reproduced
npm run test:fixed       # RUN 2: the fix, verified
npm test                 # both suites together
```

## What each run shows

- [`RUN-1-violation.md`](./RUN-1-violation.md): the same two events, processed in two different
  orders, end with two different final statuses. One of them is wrong. Source:
  [`violation/src/order-store.ts`](./violation/src/order-store.ts),
  [`violation/src/notification-service.ts`](./violation/src/notification-service.ts),
  [`violation/src/fulfillment-service.ts`](./violation/src/fulfillment-service.ts),
  test at [`violation/test/multiple-masters.test.ts`](./violation/test/multiple-masters.test.ts).
- [`RUN-2-fixed.md`](./RUN-2-fixed.md): the same two events, in both orders, now end at the same,
  correct final status, plus a transition log entry recording the change. Source:
  [`fixed/src/order-status-service.ts`](./fixed/src/order-status-service.ts),
  [`fixed/src/notification-service.ts`](./fixed/src/notification-service.ts),
  [`fixed/src/fulfillment-service.ts`](./fixed/src/fulfillment-service.ts),
  test at [`fixed/test/single-owner.test.ts`](./fixed/test/single-owner.test.ts).

Both `violation/` and `fixed/` stay in the repository side by side, on purpose: either one can be
run on its own at any time, so the violation is not just a claim about code that used to exist,
it is code you can still run and watch fail the same way today.
