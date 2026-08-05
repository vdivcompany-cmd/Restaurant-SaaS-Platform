import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

/**
 * Load environment variables from the correct file for the current runtime.
 *   NODE_ENV=production → .env.production (falls back to .env if missing)
 *   anything else       → .env
 *
 * Values already present in process.env (set by the shell or hosting provider)
 * win — the .env file only fills in what's missing. Import this module at the
 * very top of the entrypoint, before anything reads process.env.
 */
const nodeEnv = process.env['NODE_ENV'] ?? 'development';
const cwd = process.cwd();

const preferred = nodeEnv === 'production' ? '.env.production' : '.env';
const preferredPath = path.resolve(cwd, preferred);
const fallbackPath = path.resolve(cwd, '.env');

const target = fs.existsSync(preferredPath) ? preferredPath : fallbackPath;

const result = dotenv.config({ path: target });

if (result.error && fs.existsSync(target)) {
  // File exists but couldn't be parsed — surface it loudly.
  // eslint-disable-next-line no-console
  console.error(`[env] Failed to parse ${target}:`, result.error.message);
} else {
  // eslint-disable-next-line no-console
  console.log(`[env] Loaded ${path.basename(target)} (NODE_ENV=${nodeEnv})`);
}
