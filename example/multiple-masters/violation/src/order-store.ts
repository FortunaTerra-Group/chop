import { Order, OrderStatus } from './types';

/**
 * VIOLATION (CHOP-7, No Multiple Masters): this store exposes a plain
 * setStatus method that any caller can invoke. Nothing here designates a
 * single owner of order.status or checks whether a write is even still
 * relevant by the time it lands.
 */
export class OrderStore {
  private readonly orders = new Map<string, Order>();

  create(id: string, status: OrderStatus): void {
    this.orders.set(id, { id, status });
  }

  get(id: string): Order {
    const order = this.orders.get(id);
    if (!order) {
      throw new Error(`Unknown order: ${id}`);
    }
    return order;
  }

  setStatus(id: string, status: OrderStatus): void {
    this.get(id).status = status;
  }
}
