import { DomainEvent, Order, OrderStatus, TransitionLogEntry } from './types';

/**
 * FIX (CHOP-1, CHOP-2, CHOP-7): OrderStatusService is the only writer of
 * order.status. NotificationService and FulfillmentService no longer touch
 * status directly -- they call one of the two methods below, which is what
 * "encapsulate transitions" (CHOP-2) means in practice: the field has one
 * owner, and every change to it goes through that owner's explicit API.
 *
 * The precedence rule in applyTransition is what makes the outcome
 * independent of arrival order: a fact only moves the status if it is at
 * least as new as the fact that set the current status. Two direct writers
 * had no way to guarantee that, because neither knew what the other had
 * written or when.
 */
export class OrderStatusService {
  private readonly orders = new Map<string, Order>();
  private readonly log: TransitionLogEntry[] = [];

  create(id: string, status: OrderStatus): void {
    this.orders.set(id, { id, status, statusEventAt: 0 });
  }

  getStatus(id: string): OrderStatus {
    return this.getOrder(id).status;
  }

  getTransitionLog(): readonly TransitionLogEntry[] {
    return this.log;
  }

  applyRefundRequested(event: DomainEvent, actor: string): void {
    this.applyTransition(event, 'refunded', actor);
  }

  applyShipmentConfirmed(event: DomainEvent, actor: string): void {
    this.applyTransition(event, 'shipped', actor);
  }

  private applyTransition(event: DomainEvent, next: OrderStatus, actor: string): void {
    const order = this.getOrder(event.orderId);

    if (event.occurredAt < order.statusEventAt) {
      // An older fact arriving late must not overwrite a newer one.
      return;
    }

    const before = order.status;
    order.status = next;
    order.statusEventAt = event.occurredAt;

    // CHOP-9: every transition records before, after, actor, and timestamp.
    this.log.push({ orderId: order.id, before, after: next, actor, timestamp: event.occurredAt });
  }

  private getOrder(id: string): Order {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error(`Unknown order: ${id}`);
    }
    return order;
  }
}
