import type { IRealtimeService } from './realtime.interface.js';
import { FirestoreRealtimeService } from './firestore-realtime.service.js';
import { MemoryRealtimeService } from './memory-realtime.service.js';
import env from '../../config/env.js';

export * from './realtime.interface.js';
export * from './firestore-realtime.service.js';
export * from './memory-realtime.service.js';

let realtimeInstance: IRealtimeService;

if (env.NODE_ENV === 'test') {
  realtimeInstance = new MemoryRealtimeService();
} else {
  realtimeInstance = new FirestoreRealtimeService();
}

export const realtimeService: IRealtimeService = realtimeInstance;
