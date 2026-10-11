# Merchant Onboarding API

A production-oriented slice of a merchant payments onboarding platform, built with
**NestJS + TypeScript**. Sales reps file merchant applications, an asynchronous
risk/KYB check runs in the background, and an assigned reviewer records a decision —
with role-based **and** object-level authorization throughout, plus an audit trail.

> Backend only. The interactive surface is **Swagger** at `/docs`.

---

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | NestJS 11 (modules, DI, DTOs, guards, pipes, interceptors, central exception filter) |
| Language | TypeScript (CommonJS) |
| Database | PostgreSQL 16 + TypeORM, with reviewed **migrations** (`synchronize: false`) |
| Async | Redis + BullMQ (risk-review queue + worker) |
| Auth | JWT (Passport) + role-based + object-level authorization |
| Docs | OpenAPI / Swagger (`/docs`, bearer auth) |
| Tests | Jest (unit) + Supertest (e2e) |
| Local dev | Docker Compose (api + Postgres + Redis) |

---

## Quick start (Docker — recommended)

```bash
cp .env.example .env            # values are dev-only placeholders
docker compose up --build
```

On boot the api container **runs migrations**, **seeds baseline users**, then starts.

- API:      http://localhost:3000/api
- Swagger:  http://localhost:3000/docs

### Try it in Swagger
1. `POST /api/auth/login` with a seeded user (below) → copy `accessToken`.
2. Click **Authorize** (top right), paste the token.
3. Exercise the endpoints. Re-authorize as a different user to switch roles and watch
   authorization change.

---

## Seeded users

All share the password from `SEED_DEFAULT_PASSWORD` (default `Password123!`).

| Email | Role | Purpose |
| --- | --- | --- |
| `admin@example.com` | ADMIN | Full access; assigns reviewers |
| `reviewer@example.com` | REVIEWER | Records risk decisions |
| `sales1@example.com` | SALES | Creates/edits own applications |
| `sales2@example.com` | SALES | Second sales user — used to prove object-level isolation |

---

## Local dev (without the api container)

Run just the infra in Docker and the app on your host:

```bash
cp .env.example .env            # DB_HOST/REDIS_HOST already default to localhost
docker compose up -d postgres redis
npm install
npm run migration:run
npm run seed
npm run start:dev
```

Migration commands:

```bash
npm run migration:run       # apply
npm run migration:revert    # roll back the last migration
npm run migration:generate -- src/database/migrations/<Name>   # from entity changes
```

---

## Domain model & lifecycle

A **MerchantApplication** moves through a guarded state machine
(`src/applications/application-state.ts`):

```
DRAFT --submit--> SUBMITTED --assign(admin)--> UNDER_REVIEW --decide(reviewer)--> APPROVED
  ^                                                 |                             REJECTED
  +--------------- edit/resubmit <-- INFO_REQUESTED +
```

- Editable only in `DRAFT` / `INFO_REQUESTED`.
- Any disallowed transition is rejected (`Invalid transition: X -> Y`).
- `riskStatus` is a **separate axis** (`PENDING -> LOW | MEDIUM | HIGH | FAILED`) set by
  the async worker; it is **advisory** — the reviewer makes the final call.

### Endpoints
| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/auth/login` | public |
| POST | `/api/applications` | SALES, ADMIN |
| GET | `/api/applications` | any (SALES scoped to own) |
| GET | `/api/applications/:id` | any (object-level enforced) |
| PATCH | `/api/applications/:id` | SALES/ADMIN (while editable) |
| POST | `/api/applications/:id/submit` | SALES, ADMIN |
| POST | `/api/applications/:id/assign` | ADMIN |
| POST | `/api/applications/:id/decision` | assigned REVIEWER |
| GET | `/api/applications/:id/audit` | ADMIN, REVIEWER |

---

## Security: RBAC **and** object-level authorization

Two independent layers:

1. **Role-based (route-level)** — global `JwtAuthGuard` + `RolesGuard` (`@Roles(...)`).
   Determines *which kinds of action* a role may attempt.
2. **Object-level (row-level)** — enforced in the service layer, not just guards:
   - A SALES user may only read/edit applications **they created** — verified against
     `createdById`. Hitting another user's application by id returns **403**.
   - Only the **assigned reviewer** (`assignedReviewerId`) may record a decision.

The e2e suite explicitly proves the bypass attempts fail
(`test/app.e2e-spec.ts` -> *object-level authorization*).

---

## Async risk review (reliability design)

Submitting an application enqueues a BullMQ job; the worker (`src/risk/`) simulates a
third-party KYB call. Two deliberate properties:

- **Verdict vs. outage are different things.** A risk *verdict* (LOW/MEDIUM/HIGH) is a
  **return value** and never retries. A transient upstream *outage* is a **thrown error**
  (`RiskServiceUnavailableError`) which BullMQ **retries with exponential backoff**
  (`attempts: 3`). Exhausting retries marks `riskStatus = FAILED` (an infrastructure
  outcome, not a business rejection).
- **Idempotency (two layers).** The enqueue uses a deterministic `jobId`
  (`risk-<appId>`) so a duplicate submit in-flight won't double-queue; and the worker
  guards its write (`UPDATE ... WHERE riskStatus = PENDING`) so a re-run never applies a
  verdict twice.

### Simulating the risk engine (`src/risk/kyb-simulator.ts`)

The KYB call is **deterministic** — driven off the application's own fields, not random —
so you can force any path on demand by what you put in the application:

| To trigger… | Set the application to… | Result |
| --- | --- | --- |
| LOW verdict | `monthlyProcessingVolume` ≤ 250,000 | `riskStatus = LOW` |
| MEDIUM verdict | `monthlyProcessingVolume` 250,001–1,000,000 | `riskStatus = MEDIUM` |
| HIGH verdict (by volume) | `monthlyProcessingVolume` > 1,000,000 | `riskStatus = HIGH` |
| HIGH verdict (by profile) | `businessName` contains `HIGHRISK` | `riskStatus = HIGH` |
| Transient outage → retry → recover | `businessName` contains `TIMEOUT` | throws on attempts 1–2, succeeds on attempt 3 (watch the backoff) |

**How to watch it:** submit an application, then poll `GET /api/applications/:id` and watch
`riskStatus` move off `PENDING`; the worker's retry/verdict lines show in the api logs
(`docker compose logs -f api`). A verdict (even HIGH) is a successful **return** and is never
retried; a `TIMEOUT` outage is a **thrown** error that BullMQ retries with exponential
backoff. The thresholds/keywords live in one short function — `src/risk/kyb-simulator.ts`.

---

## Audit trail & sensitive data

- Significant actions are recorded in `audit_logs` (created, updated, submitted,
  reviewer-assigned, risk-assessed, decision-recorded).
- **Nothing sensitive is logged.** `src/audit/redaction.util.ts` redacts keys matching
  `password|secret|token|authorization|api-key|ssn|tax-id|card|cvv|pin`, and
  `ownerTaxId` is masked to last-4 in both logs and API responses.

**Fields that would need field-level encryption at rest** in a real system (documented,
not implemented in this time-box): `owner_tax_id` (EIN/SSN) and any future bank
account / routing numbers. The approach would be a TypeORM transformer backed by a
KMS/DEK envelope scheme, keeping the audit redaction layer as defense-in-depth.

---

## Testing

```bash
npm test          # unit tests (no infra needed)
npm run test:e2e  # integration tests (needs Postgres + Redis + migrations)
```

- **Unit** (`*.spec.ts` in `src/`): state machine, KYB simulator (verdict vs outage),
  risk idempotency/retry classification, and object-level authorization rules.
- **e2e** (`test/app.e2e-spec.ts`): authentication, the object-level bypass attempts
  (403), the full lifecycle, async risk processing (polled), and the audit trail. It
  self-seeds users, so run it against the compose Postgres/Redis:
  ```bash
  docker compose up -d postgres redis
  npm run migration:run
  npm run test:e2e
  ```

---

## Architecture decisions & trade-offs

- **Migrations over `synchronize`.** Schema is explicit and reviewable; the initial
  migration is hand-authored and verified via `migration:run` against Postgres.
- **Object-level checks in the service**, not only guards — ownership is a domain rule,
  so keeping it in the service makes it uniformly enforced and unit-testable.
- **Risk worker decoupled from the applications service** (writes results via the
  repository) to avoid a circular dependency and keep the worker independently testable.
- **Advisory risk** (chosen): the reviewer decides regardless of verdict. Simpler and
  matches "the reviewer makes the call"; gating approval on risk would be a small
  extension of `recordDecision`.
- **Response mapping** via `ApplicationResponseDto.fromEntity` so entities are never
  serialized raw (no `passwordHash` leakage, `ownerTaxId` masked).

### Intentionally out of scope (optional enhancements)
Webhook 3DS callbacks, MongoDB audit storage, and a standalone ADR document — skipped to
keep the core complete and well-tested within the time-box.

---

## Project structure

```
src/
  config/          typed config + env validation
  common/          exception filter, redaction, password util, numeric transformer
  auth/            login, JWT strategy, guards (JWT + roles), decorators
  users/           user entity + service
  applications/    entity, state machine, DTOs, service (CRUD + authz), controller
  risk/            BullMQ producer, worker, idempotent assessment, KYB simulator
  audit/           audit entity + service (+ redaction)
  database/        migrations + seed
```

---

## AI assistance disclosure

An AI coding assistant was used to scaffold boilerplate (module/DTO wiring, repetitive
test setup) and to draft documentation. All code was reviewed, adjusted, and verified by
me: the project builds (`npm run build`), unit tests pass (`npm test`), and the design
decisions above are my own. The third-party risk call is explicitly **simulated** per the
assignment.
