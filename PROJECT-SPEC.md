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

Webhook Flow

```
LINE Platform
      |
      |
Webhook Event
      |
POST /webhook
      |
NestJS API
      |
Save Event
      |
Publish Queue
      |
Worker
      |
Business Logic
      |
Database
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

Endpoint

```
POST /webhook/line
```

Supported Events

- follow
- unfollow
- message
- postback

Follow Event

```
Receive Event

↓

Save User

↓

Update Dashboard
```

Message Event

```
Receive Event

↓

Save Message

↓

Update Last Activity
```

---

# Background Workers

## Broadcast Worker

Responsibilities

- Receive Queue
- Send LINE Push Messages
- Retry Failed Requests
- Save Broadcast Logs

---

## Webhook Worker

Responsibilities

- Process Webhook Events
- Update User Information
- Update Analytics

---

# API Modules

```
Auth

Dashboard

Broadcast

Templates

LINE Users

Rich Menu

Settings

Webhook

Queue
```

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