import { EventEmitter } from 'events';
import logger from '../../utils/logger.js';

/**
 * Standard Platform Domain Events
 * Modules should emit and listen to these events rather than tightly coupling service imports.
 */
export interface DomainEventPayloads {
  'order.completed': { tenantId: string; branchId?: string; orderId: string; totalAmount: number; customerId?: string };
  'tenant.created': { tenantId: string; slug: string; name: string };
  'subscription.updated': { tenantId: string; status: string; planId: string };
  'payment.received': { tenantId: string; amount: number; reference: string };
}

export type DomainEventName = keyof DomainEventPayloads;

class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Allow multiple cross-module listeners
  }

  /**
   * Type-safe domain event dispatch
   */
  public emitEvent<K extends DomainEventName>(eventName: K, payload: DomainEventPayloads[K]): boolean {
    logger.debug({ eventName, tenantId: payload.tenantId }, 'Domain event dispatched');
    return super.emit(eventName, payload);
  }

  /**
   * Type-safe domain event subscription with auto error-handling wrapper
   */
  public onEvent<K extends DomainEventName>(eventName: K, listener: (payload: DomainEventPayloads[K]) => void | Promise<void>): this {
    return super.on(eventName, async (payload: DomainEventPayloads[K]) => {
      try {
        await listener(payload);
      } catch (err) {
        logger.error({ err, eventName, tenantId: payload.tenantId }, 'Unhandled error in domain event listener');
      }
    });
  }
}

/**
 * Singleton Domain Event Bus for asynchronous cross-module decoupling
 */
export const eventBus = new DomainEventBus();
