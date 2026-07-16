# LINE OA CRM - Project Specification

## Project Overview

A Full Stack CRM web application for managing a LINE Official Account (LINE OA).

This project is designed as a portfolio project to demonstrate modern Full Stack architecture, including authentication, REST APIs, webhook integration, background workers, message queues, and third-party API integration.

---

# Objectives

- Demonstrate Full Stack architecture
- Integrate with LINE Messaging API
- Implement asynchronous processing using RabbitMQ
- Handle LINE Webhook events
- Build a modern dashboard
- Follow clean architecture principles
- Production-like project structure

---

# Tech Stack

## Frontend

- Next.js (App Router)
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

---

## Backend

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Swagger

---

## Worker

- NestJS
- RabbitMQ Consumer
- LINE Messaging API

---

## Infrastructure

- Docker Compose
- PostgreSQL
- RabbitMQ
- Redis (Optional)
- Nginx (Optional)

---

# Repository Structure

```
crm-frontend/
crm-api/
crm-worker/
```

---

# High Level Architecture

```
                +----------------+
                |   Frontend     |
                +--------+-------+
                         |
                     REST API
                         |
                +--------v-------+
                |   NestJS API   |
                +--------+-------+
                         |
          +--------------+--------------+
          |                             |
     PostgreSQL                    RabbitMQ
                                         |
                                 Broadcast Queue
                                         |
                                 +-------v------+
                                 |    Worker    |
                                 +-------+------+
                                         |
                                  LINE Messaging API
```

---

# Architecture Details

## API Server (crm-lineoa-api)

### Purpose
- Handle HTTP requests from Frontend
- REST API endpoints for CRUD operations
- Webhook receiver for LINE events
- Queue publisher for async tasks
- User authentication and authorization

### Technology Stack
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Authentication**: JWT (access token + refresh token)
- **API Documentation**: Swagger/OpenAPI
- **Validation**: class-validator DTOs
- **Message Queue**: RabbitMQ (amqplib)
- **Logging**: Pino logger
- **Security**: Helmet, CORS, JWT guards

### Core Modules
- **auth**: Login, register, JWT strategy, token generation
- **users**: User CRUD, profile management
- **campaigns**: Broadcast creation, scheduling, status tracking
- **messages**: Store incoming/outgoing messages
- **line**: LINE bot client initialization, webhook receiver
- **templates**: Message template CRUD

### Responsibilities
```
✓ Receive REST requests from Frontend
✓ Validate input with DTOs
✓ Perform business logic
✓ Access database via Prisma
✓ Authenticate/authorize requests
✓ Publish jobs to RabbitMQ queue
✓ Receive webhook events from LINE
✓ Validate webhook signatures
✓ Store webhook events to database
✓ Return JSON responses
✓ Log all operations
```

### Data Flow
```
Frontend Request
    ↓
Express Router (Swagger-documented)
    ↓
Guard (JWT validation)
    ↓
Controller (request handling)
    ↓
DTO Validation (class-validator)
    ↓
Service (business logic)
    ↓
Prisma (database access)
    ↓
PostgreSQL (persistent storage)
    ↓
Response JSON
    ↓
Frontend
```

### Queue Integration
```
User Action (Create Broadcast)
    ↓
Controller receives request
    ↓
Service creates database record
    ↓
Publish message to RabbitMQ
    ↓
Return immediately (202 Accepted)
    ↓
Frontend sees "Processing"
```

### Webhook Integration
```
LINE Platform sends event
    ↓
POST /api/v1/line/webhook
    ↓
Validate signature (HMAC-SHA256)
    ↓
Extract event payload
    ↓
Save WebhookEvent to database
    ↓
Return 200 OK immediately
    ↓
(Optional) Publish to queue for async processing
```

---

## Worker Service (crm-lineoa-worker)

### Purpose
- Consume messages from RabbitMQ
- Send LINE Push API messages asynchronously
- Handle broadcast distribution
- Process webhook events
- Retry failed deliveries
- Log all operations

### Technology Stack
- **Framework**: NestJS Microservice (RabbitMQ transport)
- **Message Queue**: RabbitMQ (amqplib)
- **LINE SDK**: @line/bot-sdk
- **Database**: PostgreSQL via Prisma ORM
- **Logging**: Pino logger
- **Retry Logic**: Exponential backoff with max retries

### Core Modules
- **broadcast-consumer**: Listen to broadcast.send queue
- **webhook-consumer**: Listen to webhook.process queue
- **line-service**: LINE API integration, rate limiting
- **retry-handler**: Retry logic for failed messages

### Responsibilities
```
✓ Connect to RabbitMQ on startup
✓ Subscribe to broadcast.send queue
✓ Subscribe to webhook.process queue
✓ Consume messages from queues
✓ Call LINE Push API
✓ Handle rate limiting (messages/sec)
✓ Retry on failure (exponential backoff)
✓ Update broadcast_logs in database
✓ Handle dead letter queue (DLQ)
✓ Log all operations
✓ Graceful shutdown on termination
```

### Message Flow - Broadcast
```
API (Controller)
    ↓
Create Broadcast record
    ↓
Publish to: broadcast.send queue
Message: { broadcastId: 123, lineAccountId: 1, targetUsers: [...] }
    ↓
Worker receives message
    ↓
Fetch Broadcast details from DB
    ↓
Fetch MessageTemplate details
    ↓
For each target user:
    • Call LINE Push API
    • Get response (success/error)
    • Create BroadcastLog entry
    • Update Broadcast status
    ↓
Mark message as processed (ACK)
    ↓
API dashboard shows results
```

### Retry Strategy
```
Initial Send
    ↓
Failed (HTTP 429, 500, timeout)
    ↓
Publish to retry queue
    ↓
Wait (1 second + exponential backoff)
    ↓
Attempt 2
    ↓
Failed again
    ↓
Wait (2 seconds + exponential backoff)
    ↓
Attempt 3
    ↓
Failed again (give up)
    ↓
Move to dead letter queue
    ↓
Alert admin
```

### Scaling Considerations
```
Single Worker:
  - Processes ~100 messages/sec
  - Can handle broadcast to 10,000 users in ~100 seconds

Multiple Workers (Horizontal Scaling):
  - Worker 1, Worker 2, Worker 3 all consume from same queue
  - RabbitMQ distributes messages (round-robin)
  - Each worker ACKs independently
  - Total throughput: 300+ messages/sec
```

---

## Webhook Handler

### Purpose
- Receive events from LINE platform
- Validate event authenticity
- Process events asynchronously
- Maintain webhook event history

### Supported Events
1. **follow**: User follows the Official Account
2. **unfollow**: User unfollows the Official Account
3. **message**: User sends message to bot
4. **postback**: User taps rich menu button
5. **join**: Bot added to group/room
6. **leave**: Bot removed from group/room

### Request Flow
```
LINE Platform
    ↓
HTTPS POST to https://your-domain/api/v1/line/webhook
    ↓
Headers:
  X-Line-Signature: HMAC-SHA256(secret, body)
    ↓
Body:
  {
    "events": [
      {
        "type": "follow|unfollow|message|postback|join|leave",
        "timestamp": 1234567890,
        "source": { "userId": "USER123" },
        "replyToken": "nHuyWiB7yP5Zw52FIkcQT",
        ...event specific fields
      }
    ]
  }
```

### Validation Process
```
Incoming Request
    ↓
Extract X-Line-Signature header
    ↓
Get LINE_BOT_CHANNEL_SECRET from config
    ↓
HMAC-SHA256(secret, body) → computed hash
    ↓
Compare computed hash with X-Line-Signature
    ↓
Match? YES → Continue
    ↓
Match? NO → Return 401 Unauthorized, discard event
```

### Event Processing - Follow Event
```
Webhook receives "follow" event
    ↓
Extract userId from event
    ↓
Fetch user profile from LINE API
    ↓
Save to LineUser table:
  - line_user_id
  - display_name
  - picture_url
  - status: "active"
  - followed_at: now()
    ↓
Update dashboard statistics
    ↓
Return 200 OK immediately
```

### Event Processing - Message Event
```
Webhook receives "message" event
    ↓
Extract message content, userId, timestamp
    ↓
Save to Message table:
  - sender_id (lineUserId)
  - type: "text|image|sticker|video|etc"
  - content: message text
  - received_at: now()
    ↓
(Optional) Publish to webhook.process queue
    ↓
Return 200 OK immediately
```

### Event Processing - Postback Event
```
Webhook receives "postback" event
    ↓
Extract postbackData from event
Example: postbackData = "action=reply_template&templateId=5"
    ↓
Parse postbackData to get action and parameters
    ↓
Execute action:
  - action: "reply_template" → Fetch template and reply to user
  - action: "view_menu" → Send menu options
  - action: "subscribe_promo" → Add user to promo list
    ↓
Reply to user using replyToken
    ↓
Log interaction to database
    ↓
Return 200 OK
```

### Response Strategy
```
Webhook Request arrives
    ↓
Validate signature (MUST succeed)
    ↓
Save event to WebhookEvent table (for audit/debug)
    ↓
Return 200 OK immediately (critical!)
    ↓
Process event asynchronously:
  Option A: Publish to RabbitMQ queue
  Option B: Background job (scheduled task)
  Option C: Direct database update (if simple)
    ↓
Continue business logic without blocking webhook response
```

### Error Handling
```
LINE expects 200 OK within 3 seconds

If slow processing:
    ✗ Don't process synchronously
    ✗ Don't call external APIs in webhook handler
    ✓ Return 200 OK immediately
    ✓ Queue the work
    ✓ Process asynchronously

If error occurs:
    ✗ Don't return 5XX status
    ✓ Return 200 OK
    ✓ Log error for manual review
    ✓ Retry using stored event data
```

### Rate Limiting
```
LINE may send up to 300+ events/second during peak times

Solution:
  - RabbitMQ queue absorbs burst traffic
  - Multiple workers process queue
  - Database indexes on userId for fast lookups
  - Connection pooling for database
  - Cache user data if frequently accessed
```

---

## Data Flow Summary

### Sync Request (User Action)
```
Frontend (Create Broadcast)
    ↓ HTTP POST
API Server (Controller)
    ↓ Validate
Service Layer
    ↓ Create DB record
Prisma
    ↓
PostgreSQL
    ↓ Response
{
  "id": 123,
  "status": "draft",
  "message": "Broadcast created"
}
    ↓
Frontend (Display result)
```

### Async Action (Send Broadcast)
```
Frontend (Click "Send Now")
    ↓ HTTP POST
API Server (Controller)
    ↓
Service Layer
    ↓ Create broadcast_logs, publish to queue
RabbitMQ (broadcast.send)
    ↓ Return 202 Accepted (queued)
Frontend (Show "Sending...")
    ↓
Worker (consume from queue)
    ↓ For each user
LINE Push API
    ↓ Success/Failure
Database (Update broadcast_logs)
    ↓
Frontend (Poll /broadcasts/:id/logs)
    ↓ Show "Sent: 5000/5000"
```

### Webhook Async Flow
```
LINE Platform (User action)
    ↓ HTTPS POST
API Server (/webhook)
    ↓ Validate signature
Save WebhookEvent (audit)
    ↓
Publish to webhook.process queue
    ↓ Return 200 OK (FAST!)
Frontend (Poll dashboard)
    ↓ Shows latest followers/messages
    ↓
Worker (consume from queue)
    ↓ Process business logic
Update LineUser / Message tables
    ↓
Frontend refreshes automatically
```

---

# Authentication

- Login
- JWT Access Token
- Refresh Token
- Protected APIs
- Role-based Authorization

Roles

- Admin
- User

---

# Core Features

## 1. Dashboard

Purpose

Provide an overview of LINE OA activity.

Widgets

- Total Friends
- Total Broadcasts
- Messages Sent
- Failed Messages
- New Followers
- Recent Activities

Charts

- Broadcast per Day
- New Followers
- Message Statistics

---

## 2. Broadcast

Purpose

Create and send broadcast messages.

Functions

- Create Broadcast
- Update Broadcast
- Delete Broadcast
- Schedule Broadcast
- Send Immediately
- Preview Template
- View Logs

Broadcast Flow

```
Create Broadcast

↓

API

↓

RabbitMQ

↓

Worker

↓

LINE Push API

↓

Save Result

↓

Dashboard
```

Status

- Draft
- Scheduled
- Processing
- Completed
- Failed

---

## 3. Message Templates

CRUD

Fields

- Name
- Message Type
- Content
- Image URL (optional)

Types

- Text
- Image
- Flex (Future)

---

## 4. LINE Users

Purpose

Display users synced from LINE OA.

Functions

- Search
- Filter
- Pagination
- Detail View

Columns

- Display Name
- User ID
- Status
- Follow Date
- Last Activity

---

## 5. Rich Menu

Functions

- Create Rich Menu
- Upload Image
- Assign Rich Menu
- Unassign Rich Menu

(Area editor is optional)

---

## 6. LINE OA Settings

Store

- Channel Access Token
- Channel Secret

Functions

- Verify Connection
- Update Credentials
- Display Webhook URL

---

## 7. User Settings

Functions

- Update Profile
- Change Password
- Change Avatar (optional)

---

# Webhook

See "Architecture Details → Webhook Handler" for comprehensive details.

Endpoint

```
POST /api/v1/line/webhook
```

Supported Events

- follow
- unfollow
- message
- postback
- join
- leave

HTTP Headers

```
X-Line-Signature: HMAC-SHA256 signature for validation
Content-Type: application/json
```

Key Features

- ✓ Signature validation (prevents spoofed events)
- ✓ Event persistence (audit trail)
- ✓ Async processing (fast 200 OK response)
- ✓ Rate limit handling
- ✓ Dead letter queue for failures
- ✓ Comprehensive logging

---

# Background Workers

See "Architecture Details → Worker Service" for comprehensive details.

## Broadcast Worker

Responsibilities

- Consume messages from broadcast.send queue
- Send LINE Push Messages to users
- Handle rate limiting
- Retry failed requests with exponential backoff
- Save results to broadcast_logs table
- Update broadcast status
- Monitor queue depth
- Graceful shutdown handling

Queue Details

```
Queue Name: broadcast.send
Prefetch: 10 (number of messages to prefetch)
Durable: true (survives broker restart)
Dead Letter Queue: broadcast.send.dlq
TTL: None (messages stay until processed)

Message Format:
{
  "broadcastId": 123,
  "lineAccountId": 1,
  "templateId": 5,
  "targetUsers": ["U1234567890...", "U0987654321..."],
  "scheduledAt": "2024-07-16T10:00:00Z"
}
```

Processing Time

- Per user: ~500ms (LINE API call + database update)
- 1000 users: ~8-10 minutes (with 10 concurrent workers)
- 10000 users: ~80-100 minutes (horizontal scaling recommended)

---

## Webhook Event Processor

Responsibilities

- Consume webhook events from webhook.process queue
- Extract event data (userId, profile, etc)
- Update LineUser table
- Update Message table
- Sync user metadata
- Update last_activity timestamp
- Handle duplicate events
- Save unprocessed events to DLQ

Queue Details

```
Queue Name: webhook.process
Prefetch: 50 (higher throughput for webhook)
Durable: true
Dead Letter Queue: webhook.process.dlq

Message Format:
{
  "eventType": "follow|unfollow|message|postback",
  "lineUserId": "U1234567890",
  "eventData": { ...raw event from LINE }
  "receivedAt": "2024-07-16T10:00:00Z"
}
```

---

## Retry Strategy

Exponential Backoff

```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 2 seconds
Attempt 4: Wait 4 seconds
Attempt 5: Wait 8 seconds (give up)

Total: ~15 seconds max per message

If all fail: Move to DLQ for manual review
```

Failure Scenarios

```
✗ Network timeout → Retry
✗ HTTP 429 (rate limit) → Retry with backoff
✗ HTTP 500 (server error) → Retry
✗ HTTP 401 (invalid token) → No retry, log error
✗ Invalid user ID → No retry, log error
✓ HTTP 200 (success) → Mark ACK, continue
```

---

## Scaling & Deployment

Single Worker Instance

```
Max throughput: 100 msg/sec
CPU usage: ~20%
Memory: 256MB
Can handle: 5000-10000 users per broadcast
```

Multi-Worker Deployment

```
Worker 1 ┐
Worker 2 ├─> RabbitMQ (load balanced)
Worker 3 ┘

Each worker independent
RabbitMQ distributes messages
Total throughput: 300+ msg/sec
Can handle: 50000+ users per broadcast
```

Docker Compose

```yaml
worker:
  image: node:18-alpine
  environment:
    - AMQP_URL=amqp://guest:guest@rabbitmq:5672
    - DATABASE_URL=postgresql://...
  depends_on:
    - rabbitmq
    - db
```

Kubernetes (Future)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-lineoa-worker
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: worker
        image: crm-lineoa-worker:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

# API Modules

## Core Modules

### Auth Module
- Login endpoint (email/password)
- Register endpoint (new user)
- JWT token generation and validation
- Passport JWT strategy
- Protected route guard
- Token refresh mechanism

### Users Module
- Get all users (paginated)
- Get user by ID
- Create new user
- Update user profile
- Delete user
- Search/filter users

### Campaigns Module (Broadcasts)
- Create broadcast campaign
- Get all campaigns (with pagination/filtering)
- Get campaign by ID (with full details + logs)
- Update campaign (draft → scheduled status)
- Delete campaign
- Send campaign immediately
- View broadcast logs
- Filter by status (draft, scheduled, processing, completed, failed)

### Messages Module
- Store messages from webhook
- Get all messages (paginated)
- Get message by ID
- Mark message as read
- Search messages by content
- Filter by sender/date/type

### LINE Module
- Receive webhook events
- Validate webhook signature (HMAC-SHA256)
- Handle follow/unfollow/message/postback events
- Reply to user messages
- Push messages to specific users
- Get user profile
- Publish events to queues

### Templates Module
- Create message template
- Get all templates (paginated)
- Get template by ID
- Update template
- Delete template
- Preview template rendering

### Dashboard Module
- Get statistics (total users, broadcasts, messages)
- Get charts (followers per day, broadcast success rate)
- Get recent activities
- Get failed broadcasts for admin review

### Settings Module
- Get LINE OA credentials
- Update LINE OA credentials
- Verify connection to LINE
- Get webhook URL for display
- Update user profile settings

---

# Suggested API Endpoints

Authentication

```
POST   /auth/login
POST   /auth/refresh
GET    /auth/profile
```

Dashboard

```
GET    /dashboard
```

Broadcast

```
GET    /broadcasts
GET    /broadcasts/:id
POST   /broadcasts
PUT    /broadcasts/:id
DELETE /broadcasts/:id
POST   /broadcasts/:id/send
```

Templates

```
GET
POST
PUT
DELETE
```

LINE Users

```
GET
GET /:id
```

Rich Menu

```
GET
POST
DELETE
```

Settings

```
GET
PUT
```

Webhook

```
POST /webhook/line
```

---

# Database Tables

## users

```
id
email
password
role
created_at
```

---

## line_accounts

```
id
channel_secret
channel_access_token
created_at
```

---

## line_users

```
id
line_user_id
display_name
picture_url
status
followed_at
last_activity
```

---

## message_templates

```
id
name
type
content
image_url
created_at
```

---

## broadcasts

```
id
title
template_id
status
scheduled_at
created_at
```

---

## broadcast_logs

```
id
broadcast_id
line_user_id
status
error_message
sent_at
```

---

## webhook_events

```
id
event_type
payload
created_at
```

---

# Folder Structure

## Frontend

```
src

app/

components/

features/

hooks/

services/

types/

utils/
```

Feature Modules

```
dashboard/

broadcast/

templates/

line-users/

rich-menu/

settings/
```

---

## Backend

```
src

auth/

dashboard/

broadcast/

templates/

line-users/

rich-menu/

settings/

webhook/

queue/

common/

prisma/
```

---

## Worker

```
src

broadcast/

webhook/

consumers/

line/

utils/
```

---

# UI Pages

```
Login

Dashboard

Broadcast List

Create Broadcast

Message Templates

LINE Users

Rich Menu

LINE OA Settings

User Settings

404
```

---

# Non-Functional Requirements

- RESTful API
- Modular Architecture
- Repository Pattern (Optional)
- Swagger Documentation
- Docker Ready
- Environment Variables
- Error Handling
- Validation
- Logging
- Pagination
- Search
- Clean Folder Structure

---

# Future Enhancements

- Segment Broadcast
- Tags
- Auto Reply
- Chat Inbox
- Flex Message Builder
- Campaign Analytics
- Scheduler
- Multiple LINE OA
- Notification Center
- Audit Log
- File Storage (S3)
- Redis Cache
- CI/CD
- Kubernetes Deployment

---

# Portfolio Highlights

This project should demonstrate the following skills:

- Full Stack Development
- Next.js
- NestJS
- PostgreSQL
- Prisma ORM
- JWT Authentication
- REST API Design
- RabbitMQ
- Background Workers
- Webhook Integration
- LINE Messaging API
- Docker
- Clean Architecture
- Third-party API Integration
- Dashboard Development
- Production-ready Folder Structure