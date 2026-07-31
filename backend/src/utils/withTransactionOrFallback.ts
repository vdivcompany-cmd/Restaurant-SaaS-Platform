import mongoose, { type ClientSession } from 'mongoose';
import logger from './logger.js';

/**
 * Executes a unit of work within a Mongoose transaction.
 * If running on a standalone Mongoose instance (or if replica sets are unavailable/test env),
 * it safely falls back to executing the operation without a transactional session,
 * avoiding fatal application crashes on standalone installations.
 */
export async function withTransactionOrFallback<T>(
  work: (session: ClientSession | undefined) => Promise<T>
): Promise<T> {
  if (process.env['NODE_ENV'] === 'test') {
    return await work(undefined);
  }

  let session: ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isStandaloneError =
      message.includes('replica set') ||
      message.includes('Standalone') ||
      message.includes('Transaction numbers are only allowed');

    if (isStandaloneError) {
      logger.warn(
        { err: message },
        'MongoDB Standalone instance detected during transaction attempt — falling back to non-transactional operation'
      );
      return await work(undefined);
    }
    throw err;
  } finally {
    if (session) {
      try {
        const endRes = session.endSession();
        if (endRes && typeof endRes.then === 'function') {
          await endRes.catch(() => {});
        }
      } catch {
        // ignore endSession errors
      }
    }
  }
}
