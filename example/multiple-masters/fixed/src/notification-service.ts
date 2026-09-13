import { OrderStatusService } from './order-status-service';
import { DomainEvent } from './types';

/**
 * FIX (CHOP-7): NotificationService no longer writes order.status. It only
 * tells the single owner what happened.
 */
export class NotificationService {
  constructor(private readonly orderStatusService: OrderStatusService) {}

  handleRefundRequested(event: DomainEvent): void {
    this.orderStatusService.applyRefundRequested(event, 'NotificationService');
  }
}
