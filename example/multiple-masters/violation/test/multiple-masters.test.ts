import { beforeEach, describe, expect, it } from 'vitest';
import { OrderStore } from '../src/order-store';
import { NotificationService } from '../src/notification-service';
import { FulfillmentService } from '../src/fulfillment-service';

const ORDER_ID = 'order-1';
const REFUND_REQUESTED_AT = new Date('2026-01-01T09:00:00Z').getTime();
const SHIPMENT_CONFIRMED_AT = new Date('2026-01-01T10:00:00Z').getTime();

describe('CHOP-7 violation: NotificationService and FulfillmentService both write order.status', () => {
  let store: OrderStore;
  let notificationService: NotificationService;
  let fulfillmentService: FulfillmentService;

  beforeEach(() => {
    store = new OrderStore();
    store.create(ORDER_ID, 'pending');
    notificationService = new NotificationService(store);
    fulfillmentService = new FulfillmentService(store);
  });

  it('loses the shipment update when the older refund event is processed last', () => {
    // Real-world chronology: a refund was requested at 09:00; the warehouse
    // shipped the order anyway at 10:00. The shipment is the later fact, so
    // 'shipped' is the only status that reflects reality once both have
    // happened.
    fulfillmentService.handleShipmentConfirmed({ orderId: ORDER_ID, occurredAt: SHIPMENT_CONFIRMED_AT });
    notificationService.handleRefundRequested({ orderId: ORDER_ID, occurredAt: REFUND_REQUESTED_AT });

    const finalStatus = store.get(ORDER_ID).status;

    // BUG: last WRITE wins, not last EVENT. NotificationService's write lands
    // second and overwrites the correct 'shipped' status with 'refunded',
    // even though the refund event it is acting on (09:00) is older than the
    // shipment it just clobbered (10:00).
    expect(finalStatus).toBe('refunded');
  });

  it('produces a different, order-dependent status for the exact same two events', () => {
    // Same two events, only the processing order is swapped.
    notificationService.handleRefundRequested({ orderId: ORDER_ID, occurredAt: REFUND_REQUESTED_AT });
    fulfillmentService.handleShipmentConfirmed({ orderId: ORDER_ID, occurredAt: SHIPMENT_CONFIRMED_AT });

    const finalStatus = store.get(ORDER_ID).status;

    // This time the result happens to match reality, but only because
    // FulfillmentService happened to run last. Nothing in the store enforces
    // that -- the previous test already shows the opposite order produces
    // the wrong answer with the identical two events.
    expect(finalStatus).toBe('shipped');
  });
});
