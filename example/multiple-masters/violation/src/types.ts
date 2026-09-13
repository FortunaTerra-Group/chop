export type OrderStatus = 'pending' | 'shipped' | 'refunded';

export interface Order {
  id: string;
  status: OrderStatus;
}

export interface DomainEvent {
  orderId: string;
  /** Epoch ms: when the real-world fact behind this event happened. */
  occurredAt: number;
}
