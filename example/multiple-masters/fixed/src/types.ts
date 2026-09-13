export type OrderStatus = 'pending' | 'shipped' | 'refunded';

export interface Order {
  id: string;
  status: OrderStatus;
  /** occurredAt of the event that most recently set status. */
  statusEventAt: number;
}

export interface DomainEvent {
  orderId: string;
  /** Epoch ms: when the real-world fact behind this event happened. */
  occurredAt: number;
}

export interface TransitionLogEntry {
  orderId: string;
  before: OrderStatus;
  after: OrderStatus;
  actor: string;
  timestamp: number;
}
