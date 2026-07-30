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

  // ─── RabbitMQ (CloudAMQP) ─────────────────────────────────────────────────
  // CloudAMQP provides an amqps:// URL with TLS. Copy it from your CloudAMQP
  // dashboard → instance → AMQP URL.
  RABBITMQ_URL: url(),

  // ─── Firebase ─────────────────────────────────────────────────────────────
  // Provide EITHER a file path OR a base64-encoded JSON string.
  // The firebase.ts config resolves which one to use.
  FIREBASE_SERVICE_ACCOUNT_PATH: str({ default: '' }),
  FIREBASE_SERVICE_ACCOUNT_BASE64: str({ default: '' }),

  // ─── JWT ──────────────────────────────────────────────────────────────────
  JWT_SECRET: secureSecret(),
  JWT_REFRESH_SECRET: secureSecret(),


  // ─── Paymob ───────────────────────────────────────────────────────────────
  PAYMOB_API_KEY: str({ default: '' }),
  PAYMOB_HMAC: str({ default: '' }),

  // ─── Cloudinary ───────────────────────────────────────────────────────────
  CLOUDINARY_CLOUD_NAME: str({ default: '' }),
  CLOUDINARY_API_KEY: str({ default: '' }),
  CLOUDINARY_API_SECRET: str({ default: '' }),
});

export default env;
