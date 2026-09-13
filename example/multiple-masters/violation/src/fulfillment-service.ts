import { OrderStore } from './order-store';
import { DomainEvent } from './types';

/**
 * VIOLATION (CHOP-7): FulfillmentService also writes order.status directly,
 * with no coordination with NotificationService.
 */
export class FulfillmentService {
  constructor(private readonly store: OrderStore) {}

  handleShipmentConfirmed(event: DomainEvent): void {
    this.store.setStatus(event.orderId, 'shipped');
  }
}
