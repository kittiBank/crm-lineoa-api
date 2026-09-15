# CRM LINE OA — High-Level Architecture

Copy แต่ละบล็อกไป [mermaid.live](https://mermaid.live) แล้ว export PNG / SVG

---

## 1) System layers

```mermaid
flowchart LR
  subgraph FE["Frontend"]
    WEB["Next.js · Vercel"]
  end

  subgraph BE["Backend"]
    API["NestJS API"]
    W["Worker"]
    Q["RabbitMQ"]
  end

  subgraph DATA["Data"]
    DB["Neon Postgres"]
    S["GCS"]
  end

  LINE["LINE"]

  WEB -->|JWT REST| API
  API --> DB
  API --> S
  API -->|enqueue| Q
  Q --> W
  W --> DB
  W --> LINE
  LINE -->|webhook| API
```



---

## 2) Layers

```mermaid
flowchart TB
  A["Frontend<br/>Next.js on Vercel"]
  B["Backend<br/>NestJS API + Worker"]
  C["Data<br/>Postgres · Redis · GCS"]
  D["LINE Platform"]

  A -->|REST / JWT| B
  B --> C
  B --> D
  D -->|webhook| B
```



---

## 3) Broadcast flow

```mermaid
sequenceDiagram
  actor Admin
  participant FE as Frontend
  participant API as API
  participant Q as Queue
  participant W as Worker
  participant LINE as LINE

  Admin->>FE: Send broadcast
  FE->>API: POST /send
  API->>Q: enqueue
  API-->>FE: 202
  Q->>W: consume
  W->>LINE: push message
```



---

## 4) Deploy

```mermaid
flowchart LR
  G["GitHub"] --> C["GitHub Actions"]
  C --> F["Vercel · Frontend"]
  C --> P["GCP · API + Worker"]
  P --> D["Neon + GCS"]
```



---

## 5) Develop → Deploy

```mermaid
flowchart TB
  subgraph DEV["Develop"]
    FE["แก้ Frontend"]
    BE["แก้ Backend"]
    DB["แก้ DB / Prisma"]
  end

  GIT["Push GitHub"]

  subgraph CICD["CI/CD"]
    VERCEL["Vercel"]
    GHA["GitHub Actions"]
  end

  subgraph PROD["Production"]
    WEB["Frontend · Vercel"]
    API["API + Worker · GCP"]
    NEON["Neon Postgres"]
  end

  FE --> GIT
  BE --> GIT
  DB --> GIT

  GIT --> VERCEL
  GIT --> GHA

  VERCEL --> WEB
  GHA --> API
  GHA --> NEON
  API --> NEON
```

---

## 6) ER example — 3 tables

```mermaid
erDiagram
  users ||--o{ broadcasts : owns
  message_templates ||--o{ broadcasts : uses

  users {
    string id PK
    string email
    string role
  }

  message_templates {
    string id PK
    string userId FK
    string name
    string messageType
  }

  broadcasts {
    string id PK
    string userId FK
    string templateId FK
    string name
    string status
  }
```

