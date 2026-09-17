# CRM LINE OA — Project Guide

Full-stack CRM for a LINE Official Account: friends/members, broadcast campaigns, message
templates (Flex), auto-reply keyword rules, audiences, rich menus, LIFF member login (OTP).

Two **independent git repos** in this workspace (own `.git` each, not submodules):

```
crm-lineoa-api/   NestJS — HTTP API + async Worker (same repo, two entrypoints, no separate worker repo)
crm-lineoa-web/   Next.js frontend
```

Deeper docs (read before structural changes): `crm-lineoa-api/docs/architecture/*.md` (Mermaid
diagrams), `crm-lineoa-api/PROJECT-SPEC.md` / `crm-lineoa-web/PROJECT-SPEC.md` (spec + Thai TODO
log, `[Done]` = shipped).

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TS, Tailwind v4, shadcn/ui (`@base-ui/react`), Recharts, `@line/liff`, `xlsx` |
| Backend | NestJS 10, TS, Prisma + PostgreSQL, JWT/Passport, Swagger (`/docs`), RabbitMQ, Redis (`ioredis`), MinIO/S3, `@line/bot-sdk`, Winston, `prom-client` |
| Infra (local) | `docker-compose.yml` → Postgres, RabbitMQ (:15672 UI), MinIO (:9000/:9001), Redis |
| Prod | Vercel (FE) · GCP e2-micro VM behind Cloudflare (API+Worker+RabbitMQ) · Neon Postgres · GCS |

> ⚠️ **`FRONTEND-SETUP.md`/spec mention TanStack Query, React Hook Form, Zod — none are installed.**
> Real pattern: plain `fetch()` via `src/lib/api-client.ts` + manual `useState`/`useEffect`. Verify
> `package.json` before assuming a library exists.

---

## Architecture

- **API** (`src/main.ts`) — all HTTP: REST for FE, LINE webhook, LIFF endpoints. Prefix `api/v1`
  (excludes `/metrics`, `/docs`). CORS = explicit allow-list (`FRONTEND_URL`/`CORS_ORIGINS`/
  `LIFF_ENDPOINT_URL` + localhost), never wildcard.
- **Worker** (`src/worker/main.ts`) — no HTTP, consumes RabbitMQ + a 30s scheduler poll. Run via
  `npm run start:worker`.
- No HTTP between API ↔ Worker — RabbitMQ only.

| Queue | Publisher | Consumer | Purpose |
|---|---|---|---|
| `broadcast.send` | API (send-now) + Worker scheduler (due `scheduledFor`) | Worker | LINE multicast send, writes `BroadcastLog` |
| `auto-reply.process` | API (webhook message/postback) | Worker | Keyword-match reply/push |

Request flow: `Controller → DTO (class-validator, whitelist+forbidNonWhitelisted+transform) →
Service → Prisma → Postgres → JSON`.

Webhook flow: verify `X-Line-Signature` → save `WebhookEvent` → enqueue → **return 200 fast**
(LINE expects <3s — never call LINE API or do heavy work synchronously in the handler).

### Backend modules (`src/modules/*`)

| Module | Routes | Responsibility |
|---|---|---|
| `auth` | `/auth/*` | register/login/profile, JWT |
| `line` | `/line/*` | webhook, account CRUD/verify, LINE users, quota |
| `campaigns` | `/broadcasts/*` | broadcast CRUD, stats, send-now |
| `templates` | `/templates/*` | text/image/video/flex/carousel/multi, media upload, merge-tags |
| `audiences` | `/audiences/*` | segment builder, live estimate |
| `auto-messages` | `/auto-messages/*` | keyword → template rules |
| `rich-menu` | `/rich-menus/*` | CRUD, layouts, custom areas, apply-to-member |
| `member-login` | `/member-login/*` | LIFF OTP request/verify |
| `dashboard` | `/dashboard` | stats/charts, Redis-cached |
| `messages`, `users`, `storage`, `common/metrics` | — | inbound msg log, app users, MinIO/S3, Prometheus |

Cross-cutting: `queue/` (publishers), `redis/`, `prisma/`, `worker/` (consumers + scheduler).
Full route list: Swagger `/docs`.

### Database (`prisma/schema.prisma`)

`cuid()` PKs, `@@map`ped snake_case tables.

```
User ──< LineAccount ──< LineUser ──< Message / WebhookEvent / OtpSession
  │           └──< RichMenu
  ├──< Broadcast >── MessageTemplate ──< AutoMessage
  │       └──< BroadcastLog
  └──< Audience
```

| Model | Notes |
|---|---|
| `LineUser` | `status` (following/blocked), `userType` (Guest/Member), `userTier` (Silver/Gold/Platinum), unique `phone` per account |
| `Audience` | `type` discriminator + free-form `criteria` Json — no membership table, computed on read |
| `MessageTemplate` | `messages` Json = current source of truth; `content` string = **legacy, don't use for new code** |
| `Broadcast`/`BroadcastLog` | campaign header + per-recipient status (pending/sent/failed) + retry count |
| `AutoMessage` | keyword rule → template, `priority` (lower wins), unique `(userId, keyword)` |
| `RichMenu` | `menuType` (default/member), `areas` Json for custom tap regions |

Commands: `db:migrate` (dev), `db:migrate:deploy` (prod), `db:studio`, `db:seed`.

### Frontend structure

Route groups: `(auth)` login · `(app)` sidebar app (dashboard, broadcasts, templates,
auto-message, line-users, audiences, rich-menu, settings) · `(liff)` LIFF pages, no admin auth.

Feature-folder pattern per domain in `src/features/<domain>/`:

| Folder | Contains |
|---|---|
| `components/` | presentational (tables, filters, headers) |
| `containers/` | page orchestration: fetch + state, composes components |
| `lib/api.ts` | `fetch()` calls via `constants/api.ts` endpoint map |
| `lib/*.ts` | domain logic (filters, mappers, merge-tags) |
| `types/` | local TS types |

Pages under `app/(app)/**/page.tsx` are thin wrappers around a container.

Auth: JWT in `localStorage` (`lib/auth.ts`), attached via `getAuthHeaders()`; 401 clears storage +
hard-redirects to `/login` (no refresh-token flow client-side). `assertOkResponse()` is the shared
error parser — use it in every `lib/api.ts`.

---

## Coding rules

**API response format**
- No global response envelope/interceptor exists — controllers return the raw service result and
  Nest serializes it directly (`{ ...fields }`, not `{ data, meta }`). Match this: don't invent a
  wrapper for a new endpoint unless changing it everywhere.
- Errors use Nest's default `HttpException` shape (`{ statusCode, message, error }`). Throw
  `BadRequestException`/`NotFoundException`/etc. from services — don't hand-roll error JSON.
- DTOs are the contract: every field the frontend sends/reads must be declared (global
  `ValidationPipe` strips/rejects anything else).

**Business logic — no hardcoding**
- LINE credentials, quotas, DB/queue/storage endpoints, OTP code/TTL, CORS origins — all via env
  (`ConfigModule`/`process.env`), never inlined. Check `.env.example` before adding a new setting.
- Domain constants that *do* belong in code (rich-menu layout presets, message-type enums, tier
  list) live in a `constants/` file, not scattered as magic strings — extend the existing one
  (`src/modules/rich-menu/constants/layouts.ts`, `src/constants/user-tier.ts`) rather than
  re-declaring.
- Audience/segment logic is computed at read time from `LineUser` — don't hardcode audience
  membership or snapshot counts outside the cache layer.

**Database**
- Schema changes go through `prisma migrate dev` — never hand-edit generated migrations or the DB
  directly for anything meant to ship.
- Use `messages` (Json) on `MessageTemplate`, not the legacy `content` field.
- Add indexes when filtering by a new `LineUser`/`Audience` field at scale (follow the existing
  `(lineAccountId, userType)` / `(lineAccountId, userTier)` pattern).
- Writes that affect `dashboard-cache.ts` or `templates-cache.ts` reads must invalidate that
  cache, not just commit to Postgres.

**Testing**
- Current coverage is minimal: one backend spec (`templates/merge-tags.spec.ts`), **no frontend
  tests**. Don't assume test infra exists for a feature — check first.
- New non-trivial business logic (merge-tag resolution, audience criteria evaluation, retry/backoff,
  webhook signature validation) should get a Jest unit test alongside it, following
  `merge-tags.spec.ts` as the pattern (`npm test` / `npm run test:watch`).
- Don't add a new test framework/runner without asking — Jest is already configured
  (`jest.config.js`, `test:e2e` via `test/jest-e2e.json`).

**General**
- Webhook handler stays fast — no sync LINE calls, enqueue instead.
- CORS is an allow-list — new frontend origins go in env, not code.
- Frontend has no global state lib / TanStack Query — follow the existing `useEffect` + local
  state pattern unless explicitly asked to introduce one.
- `crm-lineoa-api` and `crm-lineoa-web` are separate repos — commit to the correct one.

---

## Local development

```bash
# Backend
cd crm-lineoa-api && docker compose up -d && cp .env.example .env
npm install && npm run db:migrate
npm run start:dev            # API
npm run start:worker         # Worker (separate terminal)

# Frontend
cd crm-lineoa-web && cp .env.example .env   # NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
npm install && npm run dev
```

RabbitMQ UI `:15672` (guest/guest) · MinIO console `:9001` (minioadmin/minioadmin) · Swagger
`/docs`. LIFF local test: `/liff/login?lineUserId=Uxxxxxxxx` or `NEXT_PUBLIC_LIFF_MOCK_USER_ID`.
