# Technology & Package Install Guide

This document is the single source of truth for installing all backend dependencies for the Restaurant SaaS Platform. It perfectly matches the backend architecture, folder structure, roadmap, and system design. 

**Note:** This architecture does NOT use Docker. All services must be installed natively or managed via PM2 for both local development and production.

---

## 1. Global Tools & Runtime

Before installing project-specific packages, ensure the following runtime and global tools are installed on your host machine (or VPS).

### Node.js & TypeScript
- **Runtime:** Node.js (v20+ recommended). We recommend using `nvm` to manage Node versions.
- **Package Manager:** `npm` (comes with Node.js).
- **Process Manager:** `pm2` (For running the app in production).

```bash
npm install -g pm2 typescript ts-node
```

> [!NOTE]
> Ensure MongoDB, Redis, and RabbitMQ are installed natively on your host machine or provisioned via a managed cloud provider.

---

## 2. Install Order: Project Initialization

Navigate to the `backend` directory and install the core dependencies.

```bash
cd backend
npm init -y
```

### TypeScript Setup
**Target Folders:** `/` (Project Root)
**Why:** Required to compile and run TypeScript.

```bash
npm install -D typescript @types/node ts-node
npx tsc --init
```

---

## 3. Backend Core

**Target Folders:** `src/app.ts`, `src/server.ts`, `src/middleware/`
**Why:** Express is our web framework. The other packages handle parsing, performance, and standard error management.

- `express`: Core framework.
- `express-async-errors`: Automatically catches async route errors.
- `http-status-codes`: Standardized HTTP status codes.
- `cors`: Handles Cross-Origin requests.
- `compression`: Compresses response bodies.
- `cookie-parser`: Parses Cookie header and populates `req.cookies`.

```bash
npm install express express-async-errors http-status-codes cors compression cookie-parser
npm install -D @types/express @types/cors @types/compression @types/cookie-parser
```

---

## 4. Validation

**Target Folders:** `src/config/env.ts`, `src/modules/*/validation.ts`
**Why:** Zod is used for strict runtime and static type validation of incoming API payloads. Envalid ensures environment variables are strongly typed and present at startup.

```bash
npm install zod envalid dotenv
```

---

## 5. Authentication, Authorization & Security

**Target Folders:** `src/middleware/auth.middleware.ts`, `src/middleware/rateLimit.middleware.ts`, `src/modules/auth/`
**Why:** JWT for stateless authentication, bcrypt for hashing user passwords, helmet for securing HTTP headers, and rate limiting to prevent brute-force attacks.

```bash
npm install jsonwebtoken bcryptjs helmet express-rate-limit
npm install -D @types/jsonwebtoken @types/bcryptjs
```

---

## 6. Database (MongoDB)

**Target Folders:** `src/config/database.ts`, `src/modules/*/model.ts`
**Why:** Mongoose is the primary ODM (Object Data Modeling) library for MongoDB.

```bash
npm install mongoose
```

---

## 7. Caching (Redis)

**Target Folders:** `src/config/redis.ts`, `src/services/cache/`
**Why:** Redis provides low-latency caching for menus and sessions. 

```bash
npm install redis
```

---

## 8. Message Queue (RabbitMQ)

**Target Folders:** `src/config/rabbitmq.ts`, `src/services/queue/`
**Why:** Amqplib connects to RabbitMQ for asynchronous task processing and event-driven architecture.

```bash
npm install amqplib
npm install -D @types/amqplib
```

---

## 9. Realtime (Firebase)

**Target Folders:** `src/config/firebase.ts`, `src/services/realtime/`
**Why:** Firebase Admin SDK pushes real-time order updates to the frontend without querying the main database continuously.

```bash
npm install firebase-admin
```

---

# AI Stack

Our platform leverages an advanced AI architecture for automated support, order recommendations, and semantic search over restaurant menus. This completely resides in the `src/ai` and `src/modules/` directories.

**Target Folders:** `src/ai/`, `src/modules/menu/`, `src/modules/feedback/`

### AI Frameworks (LangChain & LangGraph)
**Why:** 
- **LangChain:** The core framework for orchestrating LLM calls, building prompts, and implementing Retrieval-Augmented Generation (RAG).
- **LangGraph:** Orchestrates complex, stateful multi-actor AI workflows (e.g., an automated agent managing a customer complaint or a multi-step ordering process).
- **OpenAI:** The default configured provider for LLM models (configurable).

```bash
npm install langchain @langchain/core @langchain/community @langchain/openai @langchain/langgraph
```

### Vector Database (Upstash)
**Why:** Upstash Vector Database provides serverless vector search capabilities. We use it to store embeddings of menu items for semantic search, and embeddings of past feedback for RAG.
- `@upstash/vector`: Official SDK for vector search.
- `@upstash/redis`: (Optional) Serverless redis SDK if needed by specific AI memory states in the future.

```bash
npm install @upstash/vector @upstash/redis
```

---

## 10. Utilities & Integrations

**Target Folders:** `src/utils/`, `src/integrations/`
**Why:** 
- `uuid` & `nanoid`: For generating unique identifiers (e.g., public order IDs).
- `date-fns`: Lightweight utility for manipulating dates and times (e.g., subscription checks).
- `axios`: For making external HTTP requests to Paymob and n8n webhooks.
- `cloudinary` & `multer`: For handling image uploads (e.g., menu photos) via form-data.
- `mime-types`: For determining file types during uploads.

```bash
npm install uuid nanoid date-fns axios cloudinary multer mime-types
npm install -D @types/uuid @types/multer @types/mime-types
```

---

## 11. Logging & Monitoring

**Target Folders:** `src/utils/logger.ts`, `src/middleware/requestLogger.middleware.ts`
**Why:** Pino is a high-performance, JSON-based logger. `pino-http` acts as an express middleware for request logging.

```bash
npm install pino pino-http
npm install -D pino-pretty
```

---

## 12. Background Jobs (Cron)

**Target Folders:** `src/workers/`
**Why:** Node-cron runs scheduled periodic tasks directly in Node.js processes, such as nightly subscription verification.

```bash
npm install node-cron
npm install -D @types/node-cron
```

---

## Final Verification Checklist

- [x] All packages map directly to the folder structure.
- [x] Docker references have been completely removed.
- [x] Upstash Vector database is integrated into the AI Stack.
- [x] LangChain and LangGraph are integrated.
- [x] Production standards (rate limiting, security headers, logging) are included.
