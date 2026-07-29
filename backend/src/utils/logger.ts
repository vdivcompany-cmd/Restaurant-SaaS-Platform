import pino from 'pino';
import env from '../config/env.js';

/**
 * Shared Pino logger instance.
 *
 * - In development: clean, colorized, human-readable output via pino-pretty.
 * - In production: JSON lines, structured and machine-parsable.
 */
const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
        singleLine: true,
      },
    },
  }),
});

export default logger;
