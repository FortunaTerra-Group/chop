import { OrderStatusService } from './order-status-service';
import { DomainEvent } from './types';

/**
 * FIX (CHOP-7): FulfillmentService no longer writes order.status either.
 */
export class FulfillmentService {
  constructor(private readonly orderStatusService: OrderStatusService) {}

  handleShipmentConfirmed(event: DomainEvent): void {
    this.orderStatusService.applyShipmentConfirmed(event, 'FulfillmentService');
  }
}
