import { beforeEach, describe, expect, it } from 'vitest';
import { OrderStatusService } from '../src/order-status-service';
import { NotificationService } from '../src/notification-service';
import { FulfillmentService } from '../src/fulfillment-service';

const ORDER_ID = 'order-1';
const REFUND_REQUESTED_AT = new Date('2026-01-01T09:00:00Z').getTime();
const SHIPMENT_CONFIRMED_AT = new Date('2026-01-01T10:00:00Z').getTime();

describe('CHOP-7 fix: OrderStatusService is the single owner of order.status', () => {
  let orderStatusService: OrderStatusService;
  let notificationService: NotificationService;
  let fulfillmentService: FulfillmentService;

  beforeEach(() => {
    orderStatusService = new OrderStatusService();
    orderStatusService.create(ORDER_ID, 'pending');
    notificationService = new NotificationService(orderStatusService);
    fulfillmentService = new FulfillmentService(orderStatusService);
  });

  it('resolves to the chronologically correct status when shipment is processed first', () => {
    fulfillmentService.handleShipmentConfirmed({ orderId: ORDER_ID, occurredAt: SHIPMENT_CONFIRMED_AT });
    notificationService.handleRefundRequested({ orderId: ORDER_ID, occurredAt: REFUND_REQUESTED_AT });

    // The older refund event can no longer clobber the newer shipment fact.
    expect(orderStatusService.getStatus(ORDER_ID)).toBe('shipped');
  });

  it('resolves to the same status when the same two events are processed in the opposite order', () => {
    notificationService.handleRefundRequested({ orderId: ORDER_ID, occurredAt: REFUND_REQUESTED_AT });
    fulfillmentService.handleShipmentConfirmed({ orderId: ORDER_ID, occurredAt: SHIPMENT_CONFIRMED_AT });

    // Same two events, opposite arrival order, same outcome -- this is the
    // determinism the two-master version in ../violation could not provide.
    expect(orderStatusService.getStatus(ORDER_ID)).toBe('shipped');
  });

  it('records a transition log entry with before, after, actor, and timestamp (CHOP-9)', () => {
    fulfillmentService.handleShipmentConfirmed({ orderId: ORDER_ID, occurredAt: SHIPMENT_CONFIRMED_AT });

    const [entry] = orderStatusService.getTransitionLog();
    expect(entry).toMatchObject({
      orderId: ORDER_ID,
      before: 'pending',
      after: 'shipped',
      actor: 'FulfillmentService',
      timestamp: SHIPMENT_CONFIRMED_AT,
    });
  });
});
