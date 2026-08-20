import { cleanEnv, str, port, url, makeValidator } from 'envalid';

const secureSecret = makeValidator((input) => {
  if (!input || input.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters long for security');
  }
  return input;
});

/**
 * Validates and parses all environment variables at startup.
 * The process will exit immediately with a clear error message if any
 * required variable is missing or invalid — no silent misconfigurations.
 */
const env = cleanEnv(process.env, {
  // ─── App ──────────────────────────────────────────────────────────────────
  NODE_ENV: str({ choices: ['development', 'test', 'production'] }),
  PORT: port({ default: 3000 }),

  // ─── Platform Admin Seeding ───────────────────────────────────────────────
  SUPERADMIN_EMAIL: str({ default: 'admin@platform.com' }),
  SUPERADMIN_PASSWORD: str({ default: 'SuperSecretAdminPassword123!' }),

  // ─── MongoDB ──────────────────────────────────────────────────────────────
  MONGODB_URI: url(),

  // ─── Redis (Upstash) ──────────────────────────────────────────────────────
  // Upstash Redis uses a REST API — not a socket connection.
  // Get these from your Upstash console → Redis database → REST API section.
  UPSTASH_REDIS_REST_URL: url(),
  UPSTASH_REDIS_REST_TOKEN: str(),

  // ─── QStash (Upstash serverless queue) ───────────────────────────────────
  QSTASH_TOKEN: str({ default: '' }),
  QSTASH_CURRENT_SIGNING_KEY: str({ default: '' }),
  QSTASH_NEXT_SIGNING_KEY: str({ default: '' }),
  PUBLIC_API_BASE_URL: url({ default: 'http://localhost:3000' }),

  // ─── Firebase ─────────────────────────────────────────────────────────────
  // Provide EITHER a file path OR a base64-encoded JSON string.
  // The firebase.ts config resolves which one to use.
  FIREBASE_SERVICE_ACCOUNT_PATH: str({ default: '' }),
  FIREBASE_SERVICE_ACCOUNT_BASE64: str({ default: '' }),

  // ─── JWT ──────────────────────────────────────────────────────────────────
  JWT_SECRET: secureSecret(),
  JWT_REFRESH_SECRET: secureSecret(),
  QR_TOKEN_SECRET: secureSecret(),

  // ─── Paymob ───────────────────────────────────────────────────────────────
  PAYMOB_API_KEY: str({ default: '' }),
  PAYMOB_HMAC: str({ default: '' }),

  // ─── Cloudinary ───────────────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: str({ default: '' }),
  CLOUDINARY_API_KEY: str({ default: '' }),
  CLOUDINARY_API_SECRET: str({ default: '' }),

  // ─── Resend Email ─────────────────────────────────────────────────────────
  RESEND_API_KEY: str({ default: '' }),
  RESEND_FROM_EMAIL: str({ default: 'Restaurant SaaS <no-reply@saas-restaurant.com>' }),

  // ─── CORS ─────────────────────────────────────────────────────────────────
  CORS_ORIGIN: str({ default: '' }),

  // ─── Upstash Vector (per-tenant RAG store) ───────────────────────────────
  UPSTASH_VECTOR_REST_URL: str({ default: '' }),
  UPSTASH_VECTOR_REST_TOKEN: str({ default: '' }),

  // ─── Google Gemini (Menu Vision & Vector Embeddings) ────────────────────────
  GEMINI_API_KEY: str({ default: '' }),
  GEMINI_MODEL: str({ default: 'gemini-3.6-flash' }),
  GEMINI_EMBED_MODEL: str({ default: 'gemini-embedding-2' }),
});

export default env;
