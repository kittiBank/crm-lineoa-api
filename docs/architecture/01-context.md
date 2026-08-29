# System context

ภาพรวมว่า **ใครคุยกับระบบนี้** และระบบนี้อยู่ตรงไหนระหว่าง Frontend, LINE, API, Worker

Repo นี้คือ **backend เท่านั้น** (`crm-lineoa-api`). Frontend และ LINE Platform อยู่คนละระบบ

---

## ระบบนี้ทำอะไร

CRM สำหรับจัดการ LINE Official Account: ดูเพื่อน, ส่ง broadcast, ตั้ง auto-reply, rich menu, template, และรับ webhook จาก LINE

มี 2 process ใน repo นี้:

| Process | หน้าที่หลัก |
|---------|-------------|
| **API** (`src/main.ts`) | รับ HTTP จาก Frontend / LIFF / LINE webhook |
| **Worker** (`src/worker/main.ts`) | งาน async: ส่ง broadcast, ตอบ auto-reply, poll งาน scheduled |

---

## Actors

```mermaid
flowchart LR
  Admin[CRM Admin]
  LineUser[LINE end user]
  Admin -->|browser| FE[Frontend<br/>crm-frontend / LIFF]
  LineUser -->|LINE app| LINE[LINE Platform]
  LineUser -->|LIFF in LINE| FE
```

- **CRM Admin** — ใช้เว็บ CRM (repo แยก) login ด้วย JWT
- **LINE end user** — คุยกับ OA ใน LINE; บาง flow เปิด LIFF (หน้า frontend) เพื่อ OTP เป็น Member

---

## System context

```mermaid
flowchart TB
  Admin[CRM Admin]
  EndUser[LINE end user]

  FE[Frontend<br/>Next.js / LIFF]
  API[crm-lineoa-api<br/>NestJS HTTP]
  W[crm-lineoa-worker<br/>NestJS process]
  LINE[LINE Platform<br/>Messaging API + Webhook]

  Admin --> FE
  EndUser --> LINE
  EndUser --> FE

  FE -->|REST JWT<br/>/api/v1/*| API
  LINE -->|POST /api/v1/line/webhook| API
  API -->|Reply / Push / Multicast<br/>Rich Menu / Profile / Quota| LINE
  W -->|Reply / Push / Multicast| LINE

  API -->|publish jobs| MQ[RabbitMQ]
  W -->|consume jobs| MQ
```

Frontend **ไม่คุยกับ Worker และไม่คุยกับ LINE โดยตรง** ทุกอย่างผ่าน API หรือผ่าน LINE Platform

---

## การเชื่อมต่อหลัก

### 1. Frontend → API

- REST ภายใต้ prefix `api/v1` (ยกเว้น `/metrics` และ Swagger `/docs`)
- Auth: JWT (`Authorization: Bearer`)
- CORS อนุญาต origin จาก `FRONTEND_URL`, `CORS_ORIGINS`, `LIFF_ENDPOINT_URL` และ localhost

ตัวอย่างที่ Frontend เรียก: login, dashboard, broadcasts, templates, LINE users, rich menus, audiences, auto-messages, LINE OA settings

### 2. LINE Platform → API (webhook)

```
POST /api/v1/line/webhook
Header: X-Line-Signature
```

API ตรวจ signature แล้วจัดการ event (`follow`, `unfollow`, `message`, `postback`, …): บันทึกลง DB และถ้าต้อง auto-reply จะ **enqueue** ไป Worker ไม่ตอบ LINE จาก HTTP request ยาว ๆ

### 3. API / Worker → LINE Messaging API

| ใครเรียก | ใช้เมื่อ |
|----------|----------|
| API | ตั้งค่า OA, rich menu, ดึง profile/quota, welcome push ตอน follow |
| Worker | ส่ง broadcast (`multicast`), ตอบ auto-reply (`replyMessage` / `pushMessage`) |

### 4. API ↔ Worker ผ่าน RabbitMQ

ไม่มี HTTP ระหว่าง API กับ Worker

| Queue | Publisher | Consumer | งาน |
|-------|-----------|----------|-----|
| `broadcast.send` | API (กดส่ง) + Worker scheduler (ทุก 30 วินาที) | Worker | ส่งแคมเปญ |
| `auto-reply.process` | API (webhook message/postback) | Worker | ตอบตามกติกา auto-message |

---

## ขอบเขตของ repo นี้

**อยู่ใน repo**

- HTTP API
- Worker
- Prisma schema / migrations
- Docker Compose สำหรับ infra (local) และ API+Worker (prod)

**อยู่นอก repo**

- Frontend (Next.js) — ชี้มาที่ API ด้วย `FRONTEND_URL`
- LINE Developers Console — ตั้ง webhook URL มาที่ API
- PostgreSQL, RabbitMQ, object storage, Grafana — ดูที่ [02-containers.md](./02-containers.md)

---

## สิ่งที่ diagram นี้จงใจไม่ลงรายละเอียด

- Nest module ทีละตัว
- ทุก REST endpoint (ดู Swagger `/docs`)
- ตารางใน Postgres (ดู `prisma/schema.prisma`)
- Grafana / Prometheus (เป็น infra ไม่ใช่ actor ของธุรกิจ)
