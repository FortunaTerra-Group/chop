import { OrderStore } from './order-store';
import { DomainEvent } from './types';

/**
 * VIOLATION (CHOP-7): NotificationService writes order.status directly,
 * the same field FulfillmentService also writes below.
 */
export class NotificationService {
  constructor(private readonly store: OrderStore) {}

  handleRefundRequested(event: DomainEvent): void {
    this.store.setStatus(event.orderId, 'refunded');
  }
}
