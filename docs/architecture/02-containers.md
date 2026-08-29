# Containers

process และ infra **ที่รันจริง** ของ `crm-lineoa-api` — ไม่ใช่เป้าหมายใน spec เก่า

แอปนี้แยกเป็น 2 process จากโค้ดชุดเดียวกัน:

| Process | Entry | HTTP |
|---------|-------|------|
| **API** | `src/main.ts` → `node dist/main.js` | `PORT` (default 3000), prefix `api/v1` |
| **Worker** | `src/worker/main.ts` → `node dist/worker/main.js` | metrics ที่ `WORKER_METRICS_PORT` (default 9465) เท่านั้น ไม่มี REST สำหรับ Frontend |

รัน local:

```bash
npm run start:dev          # API
npm run start:worker       # Worker
```

---

## Local (พัฒนาบนเครื่อง)

Infra อยู่ใน Docker, API/Worker รันบน host (Node)

```mermaid
flowchart TB
  subgraph host [Host machine]
    FE[Frontend :3000]
    API[API :3000 or :3001]
    W[Worker<br/>metrics :9465]
  end

  subgraph compose [docker-compose.yml]
    PG[(PostgreSQL :5432)]
    RMQ[RabbitMQ :5672<br/>UI :15672]
    MINIO[MinIO :9000<br/>console :9001]
  end

  subgraph obs [docker-compose.observability.yml]
    PROM[Prometheus :9090]
    GRAF[Grafana :3030]
    LOKI[Loki :3100]
    PT[Promtail]
    NE[Node Exporter :9100]
  end

  FE -->|REST /api/v1| API
  LINE[LINE Platform] -->|webhook| API
  API --> PG
  W --> PG
  API --> RMQ
  W --> RMQ
  API --> MINIO
  API -->|/metrics| PROM
  W -->|:9465/metrics| PROM
  API -->|JSON logs| LOKI
  PT -->|tail ./logs| LOKI
  NE --> PROM
  PROM --> GRAF
  LOKI --> GRAF
  W --> LINE
  API --> LINE
```

### บริการ local

| บริการ | มาจาก | Port / URL | บทบาท |
|--------|--------|------------|--------|
| API | `npm run start:dev` | `PORT` ใน `.env` (default 3000) | REST + webhook |
| Worker | `npm run start:worker` | metrics `9465` | consume queue, cron broadcast |
| Frontend | repo แยก | มักเป็น `:3000` | ถ้าชนพอร์ต ให้ API ใช้ `PORT=3001` |
| PostgreSQL | `docker-compose.yml` | `localhost:5432` | DB (`crm_lineoa_db`) |
| RabbitMQ | `docker-compose.yml` | `5672`, UI `15672` | queue `broadcast.send`, `auto-reply.process` |
| MinIO | `docker-compose.yml` | API `9000`, console `9001` | bucket `crm-oa-storage` |
| Prometheus | `docker-compose.observability.yml` | `9090` | scrape metrics |
| Grafana | ชุดเดียวกัน | `3030` (admin/admin) | dashboard CRM |
| Loki | ชุดเดียวกัน | `3100` | log |
| Promtail | ชุดเดียวกัน | — | อ่าน `./logs` ส่ง Loki |
| Node Exporter | ชุดเดียวกัน | `9100` | CPU/RAM/disk ของ host |

สตาร์ท infra:

```bash
docker compose up -d
npm run obs:up    # optional — Grafana stack
```

Prometheus scrape API ที่ `host.docker.internal:3001` (ดู `observability/prometheus/prometheus.yml`) ถ้า API ไม่ใช่พอร์ต 3001 ต้องแก้ scrape target ให้ตรง

Object storage local ใช้ MinIO ผ่าน env `S3_*` (S3-compatible) ไม่ใช่ AWS จริง

---

## Production (EC2)

จาก `docker-compose.prod.yml` + GitHub Actions (`deploy-prod.yml`)

บน EC2 มี **API, Worker, RabbitMQ** ใน Docker เดียวกัน  
**ไม่มี** Postgres / MinIO ใน compose นี้

```mermaid
flowchart TB
  FE[Frontend<br/>แยก deploy เช่น Amplify]
  LINE[LINE Platform]

  subgraph ec2 [EC2 — docker-compose.prod.yml]
    API[api container<br/>:3000 → host API_HOST_PORT]
    W[worker container<br/>node dist/worker/main.js]
    RMQ[rabbitmq<br/>internal only]
  end

  RDS[(Amazon RDS<br/>PostgreSQL)]
  S3[Amazon S3<br/>S3_* env]

  FE -->|HTTPS REST JWT| API
  LINE -->|webhook HTTPS| API
  API --> RDS
  W --> RDS
  API --> RMQ
  W --> RMQ
  API --> S3
  API --> LINE
  W --> LINE
```

| ชิ้น | ที่อยู่ | หมายเหตุ |
|------|---------|----------|
| `api` | container จาก `Dockerfile` | `CMD node dist/main.js`, รัน migrate ถ้า `RUN_MIGRATIONS=true` |
| `worker` | image เดียวกัน | override command เป็น worker, `RUN_MIGRATIONS=false` |
| `rabbitmq` | container ใน `crm_network` | **ไม่เปิดพอร์ตออก host** |
| PostgreSQL | **RDS** | `DATABASE_URL` จาก secrets |
| Object storage | **AWS S3** | `S3_ENDPOINT=s3.ap-southeast-1.amazonaws.com` |
| Frontend | นอก stack นี้ | CORS ผ่าน `FRONTEND_URL` / `CORS_ORIGINS` / `LIFF_ENDPOINT_URL` |
| Observability | ยังไม่ได้อยู่ใน `docker-compose.prod.yml` | Grafana stack เป็นของ local |

Worker ขึ้นหลัง API healthy เพราะ API รัน migrate ก่อน

---

## Queue และใครเป็นคนยิง LINE

```mermaid
flowchart LR
  subgraph apiProc [API process]
    WH[Webhook + REST]
    PQ[Queue publishers]
  end

  subgraph workerProc [Worker process]
    BC[BroadcastConsumer]
    AR[AutoReplyConsumer]
    SCH[BroadcastScheduler<br/>cron every 30s]
  end

  Q1[broadcast.send]
  Q2[auto-reply.process]
  LINE[LINE Messaging API]
  PG[(PostgreSQL)]

  WH --> PG
  WH --> PQ
  PQ --> Q1
  PQ --> Q2
  SCH --> PG
  SCH --> Q1
  Q1 --> BC
  Q2 --> AR
  BC --> LINE
  AR --> LINE
  BC --> PG
```

- **API** เขียน DB ทันทีตอน webhook (ข้อความ, follow/unfollow) แล้วโยนงานตอบไป queue
- **Worker** เป็นคนเรียก LINE Reply/Push/Multicast สำหรับ broadcast และ auto-reply
- **Scheduler** อยู่ใน Worker ไม่ใช่ API — ดึง broadcast สถานะ `scheduled` ที่ถึงเวลา แล้ว enqueue `broadcast.send`

---

## พอร์ตที่เจอบ่อย

| พอร์ต | บริการ |
|------|--------|
| 3000 / 3001 | API หรือ Frontend (อย่าให้ชนกัน) |
| 3030 | Grafana (map จาก container 3000) |
| 3100 | Loki |
| 5432 | Postgres local |
| 5672 | RabbitMQ AMQP |
| 9000 / 9001 | MinIO API / console |
| 9090 | Prometheus |
| 9100 | Node Exporter |
| 9465 | Worker `/metrics` |
| API `/metrics` | Prometheus scrape (นอก `api/v1`) |
| API `/docs` | Swagger |

---

## Source of truth ใน repo

| เรื่อง | ไฟล์ |
|-------|------|
| Process API / Worker | `src/main.ts`, `src/worker/main.ts` |
| Queue ชื่อ | `src/queue/queue.constants.ts` |
| Local infra | `docker-compose.yml` |
| Local Grafana stack | `docker-compose.observability.yml` |
| Prod compose | `docker-compose.prod.yml` |
| Image | `Dockerfile` |
| Env ตัวอย่าง | `.env.example` |
| Deploy | `.github/workflows/deploy-prod.yml` |
