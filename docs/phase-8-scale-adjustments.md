# Phase 8 — Cloud Scale Adjustments & AI Agentic Gateway

**Prerequisite:** Phase 7 complete (live on Vercel Serverless cloud runtime with custom Hostinger domain and managed database connections).
**Reference:** see `future-saas-scaling-and-ai-strategies.md` for our enterprise scaling roadmap.

---

## 🌟 Architecture & Philosophy
Following our transition to **Vercel Serverless Architecture** (Option 2 cloud modernization), traditional infrastructure management burdens (Linux VPS provisioning, PM2 clustering, Nginx reverse proxy tuning, and embedded backend worker engines) have been completely discarded in favor of managed cloud services. 

Scaling from here relies on automatic serverless elasticity and event-driven operational triggers. Nothing in this phase requires manual hardware configuration — each optimization focuses on smart data management and external AI workflow orchestration.

---

## 🛠️ Event-Driven Scaling Triggers

### A — Vercel Serverless Elastic Concurrency
* **Trigger:** Surge in ordering traffic during peak restaurant dining hours.
* **Action Required (Zero-DevOps):** Vercel Serverless automatically spins up horizontal worker containers to handle thousands of simultaneous HTTP requests without manual intervention or PM2 cluster scripts.
* **Monitoring Check:** Review runtime latency directly in Vercel Cloud Analytics dashboard.

### B — MongoDB Atlas Connection Pooling & Index Optimizations
* **Trigger:** Database queries take longer than 50ms during high-volume cashier checkouts.
* **Action Required:**
  1. Verify connection string in Vercel environment secrets leverages MongoDB Atlas Serverless/Shared tier connection pooling.
  2. Confirm compound indexes (`{ tenantId: 1, branchId: 1 }`) are active across all operational domain models.

### C — Cloud n8n AI Workflow Integration (Chatbot Kill-Switch)
* **Trigger:** Customer chat interactions require automated conversational ordering without costing excessive LLM tokens when restaurants are closed or kitchens are under heavy stress.
* **Action Implemented:**
  1. **Manager Kill-Switch & Operations Control:** Restaurant managers control `isOpen` and `isChatbotActive` switches in their dashboard profile (`PUT /api/v1/restaurants/profile`).
  2. **n8n Gateway Endpoint:** External cloud n8n workflows poll `GET /api/v1/restaurants/:tenantId/ai-status` prior to invoking LLM inference. If `"canAnswer": false`, n8n immediately echoes the manager's custom `offlineReply` apology string, halting further vector search or OpenAI API cost consumption.
  3. **RAG Vector Catalog Exporter:** n8n cloud workflows fetch `GET /api/v1/menu/rag-catalog/:tenantId` to retrieve formatted textual summaries (`ragItems[*].text`) and metadata for turnkey embedding into Upstash Vector database namespaces.

### D — Upstash Redis Tier-Based Quotas & Caching
* **Trigger:** Protection against "Noisy-Neighbor" traffic spikes or automated scraper bots.
* **Action Implemented:**
  1. Global and auth rate-limiters operate on distributed Upstash Redis counters.
  2. Menu catalogs and frequent reads are cached with instantaneous invalidation triggers upon manager updates (`bulkImportMenu`).

---

## 📦 Deliverables Status
- [x] Vercel Serverless automatic horizontal scaling active.
- [x] Operational manager override switches (`isOpen`, `isChatbotActive`) incorporated into Restaurant schema.
- [x] High-speed n8n Cloud AI interrogation endpoints (`/ai-status`, `/rag-catalog`) deployed and verified with 100% integration testing success!
