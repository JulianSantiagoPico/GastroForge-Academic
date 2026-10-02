# Appresso Production Readiness & Monorepo Restructuring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure GastroForge-Academic into a clean monorepo (`backend/` and `frontend/`), fix time-dependent test flakiness, ensure production migration execution, integrate real healthcheck with graceful shutdown, and implement an interactive traffic simulation playground in the frontend.

**Architecture:** Split the codebase into independent npm workspaces (`backend/` for NestJS, `frontend/` for Vite/React). The backend exposes an internal burst-simulation endpoint that signs requests on the server (preserving HMAC security), which the frontend playground consumes to let operators visualize anomaly detection under controlled bursts without client-side secrets.

**Tech Stack:** NestJS 11, TypeORM 0.3, PostgreSQL (Neon), Redis (IoRedis), React 18, Vite 6, Vitest, Jest.

**Spec:** [docs/PLAN_IMPLEMENTACION_APPRESSO_NEON.md](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/docs/PLAN_IMPLEMENTACION_APPRESSO_NEON.md) and [docs/GUIA_CONFIGURACION_NEON_REDIS.md](file:///c:/Users/User/Desktop/Programacion/GastroForge-Academic/docs/GUIA_CONFIGURACION_NEON_REDIS.md).

## Global Constraints

- Never expose `APPRESSO_HMAC_SECRET` or Neon credentials to the frontend or browser bundles.
- Conventional commits only; no AI co-authorship.
- All tests must pass with `maxWorkers=1` deterministically regardless of the system local time or UTC hour of the day.
- Backward compatibility: existing `/api/v1/appresso/*` contracts must remain intact.

## Review Focus

1. Time-dependent test flakiness: tests passing at night (UTC 20:00-05:00) but failing during morning hours (UTC 05:00-12:00) due to `TimeBandPolicy` resolving higher thresholds.
2. Production migration failure: Docker production container dropping `ts-node` while migration scripts still rely on it.
3. Premature connection termination: missing `enableShutdownHooks()` leading to unhandled socket errors on Redis/Postgres on container teardown.
4. Healthcheck false positives: `/health` returning 200 OK while database or Redis connections are dead.
5. Insecure load testing from browser: frontend attempting to sign HMAC directly with client-side secrets.

---

### Task 1: Monorepo Workspace Restructuring (`backend/` & `frontend/`)

**Files:**
- Create: `package.json` (root workspace manifest)
- Move to `backend/`: `src/`, `scripts/`, `Dockerfile`, `.dockerignore`, `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.js`, `package.json`
- Modify: `backend/package.json`, `frontend/package.json`

**Interfaces:**
- Root orchestrates builds and tests: `npm run build`, `npm test` execute across workspaces.
- `backend` workspace maintains all NestJS dependencies and scripts.
- `frontend` workspace maintains all Vite/React dependencies.

- [ ] **Step 1: Create backend directory and move backend files**
Move all backend-specific source files, configs, and scripts into `backend/`. Keep `docs/`, `reports/`, and `.git/` at the repository root.

- [ ] **Step 2: Create root package.json with npm workspaces**
```json
{
  "name": "gastroforge-academic-monorepo",
  "private": true,
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces",
    "backend:dev": "npm run start:dev --workspace=backend",
    "backend:test": "npm run test --workspace=backend",
    "frontend:dev": "npm run dev --workspace=frontend",
    "frontend:build": "npm run build --workspace=frontend",
    "frontend:test": "npm run test --workspace=frontend"
  }
}
```

- [ ] **Step 3: Update backend/package.json and backend/Dockerfile**
Remove root-level frontend delegator scripts (`dashboard:*`) from `backend/package.json`. Update paths in `backend/Dockerfile` to build cleanly inside the workspace.

- [ ] **Step 4: Verify monorepo builds and tests**
Run: `npm run build` from root.
Expected: Both `backend` and `frontend` build successfully without path resolution errors.

- [ ] **Step 5: Commit workspace restructuring**
```bash
git add .
git commit -m "chore(repo): restructure into backend and frontend npm workspaces"
```

---

### Task 2: Fix Time-Dependent Test Flakiness in Transactions Service

**Files:**
- Modify: `backend/src/modules/appresso/transactions/transactions.service.spec.ts`

**Interfaces:**
- Consumes: `TransactionsService`, `TimeBandPolicy`, `TimeBandName`
- Produces: Deterministic test suite passing regardless of current UTC hour.

- [ ] **Step 1: Write failing test case demonstrating time vulnerability**
Verify that running `TransactionsService` during morning UTC hours without a fixed policy fails 4 test assertions expecting threshold 3.

- [ ] **Step 2: Inject deterministic TimeBandPolicy in general test suites**
In `transactions.service.spec.ts`, instantiate a deterministic test policy with a default threshold of 3 for the generic concurrency and anomaly test cases, while preserving the dedicated UTC time-band test suite:
```typescript
const defaultTestPolicy = new TimeBandPolicy({
  windowMs: 3000,
  bands: [
    {
      name: TimeBandName.NOCHE_MADRUGADA,
      startSeconds: 0,
      endSeconds: 86400,
      threshold: 3,
    },
  ],
});
service = new TransactionsService(mockEntityManager as any, metrics, defaultTestPolicy);
```

- [ ] **Step 3: Run backend test suite to verify 100% pass rate**
Run: `npm run backend:test -- --runInBand`
Expected: 11 passed test suites, 87 passed tests, 0 failures.

- [ ] **Step 4: Commit test fix**
```bash
git add backend/src/modules/appresso/transactions/transactions.service.spec.ts
git commit -m "fix(appresso): eliminate time-dependent flakiness in transactions service tests"
```

---

### Task 3: Production Migrations and Dockerfile Configuration

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/Dockerfile`
- Modify: `backend/src/database/data-source.ts`

**Interfaces:**
- Consumes: TypeORM CLI, compiled JS migrations in `dist/migrations/*.js`
- Produces: `npm run migration:run:prod` executable in production container without devDependencies.

- [ ] **Step 1: Add compiled migration execution script in backend/package.json**
```json
"migration:run:prod": "typeorm migration:run -d dist/database/data-source.js"
```

- [ ] **Step 2: Update Dockerfile for production release readiness**
Ensure `backend/Dockerfile` keeps `dist/migrations` and exposes an entrypoint or release command capable of running migrations before starting `dist/main.js`.

- [ ] **Step 3: Test compiled data source resolution**
Run: `node dist/database/data-source.js` (or inspect exports) to verify that compiled JS correctly registers `dist/migrations/*.js`.

- [ ] **Step 4: Commit migration runner updates**
```bash
git add backend/package.json backend/Dockerfile backend/src/database/data-source.ts
git commit -m "chore(backend): add production migration script and docker config"
```

---

### Task 4: Graceful Shutdown and Real Healthcheck

**Files:**
- Modify: `backend/src/main.ts`
- Modify: `backend/src/modules/health/health.controller.ts`
- Modify: `backend/src/modules/health/health.controller.spec.ts`

**Interfaces:**
- Consumes: `EntityManager` (Postgres query `SELECT 1`), `RedisSlidingWindowAdapter` (`isAvailable()`)
- Produces: `GET /api/v1/health` with live component readiness.

- [ ] **Step 1: Enable shutdown hooks in main.ts**
```typescript
app.enableShutdownHooks();
```

- [ ] **Step 2: Update HealthController with live status checks**
Check connectivity to Postgres and Redis if enabled:
```typescript
@Get()
async getHealth() {
  const isDbHealthy = await this.checkPostgres();
  const isRedisHealthy = this.redisAdapter?.isAvailable() ?? true;
  const status = isDbHealthy && isRedisHealthy ? 'ok' : 'degraded';
  return {
    status,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      postgres: isDbHealthy ? 'up' : 'down',
      redis: isRedisHealthy ? 'up' : 'degraded',
    },
  };
}
```

- [ ] **Step 3: Write tests for HealthController**
Verify that `getHealth` returns `ok` when services respond and `degraded` when PostgreSQL ping fails.

- [ ] **Step 4: Commit healthcheck and shutdown hooks**
```bash
git add backend/src/main.ts backend/src/modules/health/
git commit -m "feat(health): add live service readiness check and enable shutdown hooks"
```

---

### Task 5: Frontend Interactive Traffic Simulator / Playground

**Files:**
- Create: `backend/src/modules/appresso/simulation/simulation.controller.ts`
- Create: `backend/src/modules/appresso/simulation/simulation.module.ts`
- Modify: `backend/src/modules/appresso/appresso.module.ts`
- Create: `frontend/src/components/TrafficSimulator.tsx`
- Create: `frontend/src/components/TrafficSimulator.spec.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Backend Endpoint: `POST /api/v1/appresso/simulation/burst`
  - Request: `{ user?: string, count: number, delayMs?: number, paymentMethod?: string }`
  - Internal: signs each transaction with `APPRESSO_HMAC_SECRET` and executes via `TransactionsService.processTransaction`.
  - Response: `{ summary: { sent: number, accepted: number, anomalies: number, avgLatencyMs: number }, results: ProcessTransactionResponse[] }`
- Frontend: `TrafficSimulator` component renders sliders/inputs for request count, triggers simulation, and graphs/lists live results without holding HMAC secrets.

- [ ] **Step 1: Write backend simulation controller test**
Test that `POST /api/v1/appresso/simulation/burst` rejects counts > 20 (guarding server resources) and processes valid bursts returning signed transaction execution results.

- [ ] **Step 2: Implement backend simulation endpoint**
Implement controller and service logic in `simulation.controller.ts`, registering it in `AppressoModule`.

- [ ] **Step 3: Add API client method in frontend/src/services/api.ts**
```typescript
export async function runTrafficSimulation(params: { user?: string; count: number; delayMs?: number }) {
  const res = await fetch(`${API_BASE_URL}/api/v1/appresso/simulation/burst`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}
```

- [ ] **Step 4: Create TrafficSimulator UI component in frontend**
Add interactive control panel with user input, burst count slider (1-20), execute button, latency display, and anomaly badges.

- [ ] **Step 5: Write frontend component tests**
Run `npm run frontend:test` to verify `TrafficSimulator` renders, handles loading states, and displays simulation results.

- [ ] **Step 6: Commit simulation playground**
```bash
git add backend/src/modules/appresso/simulation/ frontend/src/
git commit -m "feat(dashboard): add interactive traffic simulation playground"
```

---

### Task 6: Vercel Deployment Configuration for Frontend

**Files:**
- Create: `frontend/vercel.json`
- Modify: `frontend/.env.example`
- Modify: `frontend/README.md`

**Interfaces:**
- `vercel.json` rewrites all routing to `index.html` (SPA routing).
- `VITE_APPRESSO_API_BASE_URL` configured for production build.

- [ ] **Step 1: Add frontend/vercel.json**
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

- [ ] **Step 2: Document Vercel build settings and environment variables**
Document root directory as `frontend`, build command as `npm run build`, and output directory as `dist`.

- [ ] **Step 3: Run full monorepo build verification**
Run: `npm run build` and `npm test` across root.
Expected: Both workspaces build and pass 100% of tests.

- [ ] **Step 4: Commit Vercel deployment configuration**
```bash
git add frontend/vercel.json frontend/.env.example frontend/README.md
git commit -m "chore(frontend): configure vercel SPA deployment settings"
```
