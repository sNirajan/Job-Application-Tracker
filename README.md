# Job Application Tracker API

A REST API for tracking job applications from wishlist to offer. It enforces valid status changes, keeps a full history of every change, and serves cached dashboard stats. Built with production-style backend practices: layered architecture, secure cookie-based auth, Redis caching and rate limiting, automated tests, and a CI/CD pipeline that deploys to AWS ECS.

This repository contains the backend only. The [frontend](https://github.com/sNirajan/Job-Application-Tracker-Frontend) lives in a separate project.

The app is real and in use, but the reason it exists is to learn AWS deployment
end to end: from a hand-configured EC2 box to a containerized service that
deploys itself on a push. The [Deployment](#deployment) section covers how it
got there and what is still rough.

---

## Features

- **Application management**: create, view, edit, delete, search, filter, sort, and paginate job applications
- **Status workflow**: status changes follow strict rules enforced on the server (a finite state machine)
- **Audit timeline**: every status change is saved as a permanent event with an optional note
- **Authentication**: register and login with JWT access tokens and rotating refresh tokens in HttpOnly cookies
- **Dashboard stats**: counts per status, stage-to-stage conversion rates, and applications per week, cached in Redis
- **Rate limiting**: Redis-backed per-IP limits on login and registration
- **Documents**: upload a resume or cover letter (PDF, DOC, DOCX up to 5 MB) to each application, preview PDFs in the app, and see which resume was sent right on each application in the list, stored on disk in development and in Amazon S3 in production
- **Contacts**: keep recruiter and interviewer details on each application
- **Reminders and follow-ups**: set reminders per application, plus automatic suggestions for applications with no update in a week

---

## Tech Stack

| Layer          | Choice                            |
| -------------- | --------------------------------- |
| Runtime        | Node.js 24 + Express 5            |
| Database       | PostgreSQL 16 (via Knex)          |
| Cache / tokens | Redis (ioredis)                   |
| Validation     | Zod                               |
| Logging        | Pino (structured JSON logs)       |
| Auth           | JWT (HttpOnly cookies) + bcryptjs |
| Security       | Helmet, CORS allowlist, CSRF check |
| Testing        | Jest + Supertest                  |
| File uploads   | Multer + AWS SDK v3 (S3)          |

### Infrastructure

| Concern          | Provider                          |
| ---------------- | --------------------------------- |
| Container        | Docker                            |
| Image registry   | Amazon ECR                        |
| API hosting      | Amazon ECS                        |
| Database         | Amazon RDS (PostgreSQL)           |
| File storage     | Amazon S3                         |
| CI/CD            | GitHub Actions                    |

---

## Architecture

Each request flows through clear layers:

```
Route -> Middleware (auth, CSRF, validation, rate limit) -> Controller -> Service -> PostgreSQL / Redis
```

- **Routes** (`src/routes`) define the endpoints
- **Middleware** (`src/middleware`) handles auth, CSRF, input validation, rate limiting, request IDs, and errors
- **Controllers** (`src/controllers`) read the request and send the response
- **Services** (`src/services`) hold the business logic and database access
- **Validators** (`src/validators`) define Zod schemas for every input

### Status State Machine

Status changes are checked in the service layer, so invalid moves are rejected no matter which client sends them.

```
wishlist -> applied -> phone_screen -> technical -> onsite -> offer -> accepted
```

- Any active status can also move to `rejected` or `withdrawn` (except `wishlist`, which can only be `withdrawn`)
- `accepted`, `rejected`, and `withdrawn` are final and cannot change
- Each application response includes `available_transitions`, so a client can show only the valid next steps

### Audit Timeline

Every status change writes a row to the `application_events` table (`from_status`, `to_status`, `notes`, `created_at`). The status update and the event insert run inside one database transaction, so either both are saved or neither is. Creating an application also logs an initial event.

### Auth and Security

- Access token (15 minutes) and refresh token (7 days) are sent as **HttpOnly cookies**, so page scripts cannot read them
- **Refresh token rotation**: each refresh token works once and is tracked in Redis. Reusing an old one is treated as theft and logs the user out of every session
- **CSRF protection**: state-changing requests must send `X-Requested-With: XMLHttpRequest` or come from an allowed origin
- Passwords are hashed with **bcryptjs**
- Every query is scoped to the logged-in user, so users can never see each other's data

### Document Uploads

- Files are checked by their actual bytes (the "magic number" at the start of the file), not by the name or the type the browser claims, so a renamed script can't pass as a PDF
- The storage key is built only from server-generated ids (`userId/applicationId/uuid.pdf`), never from the uploaded filename
- Files are kept in memory only while being checked (5 MB limit), then handed to storage
- Storage is swappable behind one interface (`src/storage`): local disk for development and tests, S3 in production
- In production, downloads redirect to a signed S3 link that expires after 60 seconds, so file bytes never pass through the API
- PDF previews are fetched through the API with the user's login cookie and shown in the browser's built-in viewer, so they work the same wherever the file is stored. Preview responses carry a strict Content-Security-Policy and are never cached by shared caches
- The applications list includes each application's newest resume (`latest_resume`), fetched in the same query, so cards show which resume was sent without extra requests
- Deleting a document or its application also deletes the stored file

### Follow-up Suggestions

Suggestions are computed when the dashboard asks for them, not by a background job: any application in an active stage with no update for 7 days and no open reminder is suggested. This means there is no scheduler to run or keep in sync.

### Input Safety

- Link fields (job URL, LinkedIn) only accept `http` and `https`, so a `javascript:` link can't be saved and later clicked
- Malformed ids in the URL return 404 instead of a database error
- Salary values are capped so a typo can't overflow the database column

### Redis Cache-Aside

Dashboard stats are cached in Redis for 5 minutes. On a cache miss they are computed from PostgreSQL and written back. Any create, update, status change, or delete clears that user's cached stats. If Redis is unavailable, the API keeps working and reads straight from the database.

---

## Running Locally

### Prerequisites

- Node.js 24
- Docker + Docker Compose

### Setup

```bash
git clone https://github.com/sNirajan/Job-Application-Tracker.git
cd Job-Application-Tracker
cp .env.example .env
```

Start PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
```

Install dependencies, run migrations, and start the dev server:

```bash
npm install
npm run migrate
npm run dev
```

To run the full stack (API + database + Redis) in containers instead:

```bash
docker compose up --build
```

### Environment Variables

In development and test, the database connection uses the `DB_*` variables. In production it uses `DATABASE_URL`.

```
PORT=3001
NODE_ENV=development

# Development / test database (matches docker-compose)
DB_HOST=localhost
DB_PORT=5433
DB_USER=tracker
DB_PASSWORD=tracker123
DB_NAME=job_tracker

# Production database
DATABASE_URL=

REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000

# Uploaded documents
STORAGE_DRIVER=local   # "s3" in production
S3_BUCKET=
AWS_REGION=us-east-2
```

### Tests

Tests run against a separate `<DB_NAME>_test` database.

```bash
npm test
```

---

## API Overview

All routes are prefixed with `/api/v1`, except `/health`.

### Auth

| Method | Endpoint         | Description                            |
| ------ | ---------------- | -------------------------------------- |
| POST   | `/auth/register` | Register a new user (rate limited)     |
| POST   | `/auth/login`    | Log in and receive auth cookies (rate limited) |
| POST   | `/auth/refresh`  | Rotate the refresh token               |
| POST   | `/auth/logout`   | Revoke the current session             |
| GET    | `/auth/me`       | Get the logged-in user                 |

### Applications (login required)

| Method | Endpoint                     | Description                              |
| ------ | ---------------------------- | ---------------------------------------- |
| GET    | `/applications`              | List applications (filter, sort, paginate) |
| POST   | `/applications`              | Create an application                    |
| GET    | `/applications/:id`          | Get one application with its next valid statuses |
| PATCH  | `/applications/:id`          | Edit fields (not status)                 |
| PATCH  | `/applications/:id/status`   | Change status (checked by the state machine) |
| GET    | `/applications/:id/timeline` | Get the full status history              |
| DELETE | `/applications/:id`          | Delete an application and its history    |

List query options: `page`, `per_page` (max 100), `status`, `company` (partial, case-insensitive), `sort` (`created_at`, `updated_at`, `applied_at`, `company`), `order` (`asc`, `desc`).

### Contacts (login required)

| Method | Endpoint                                  | Description        |
| ------ | ----------------------------------------- | ------------------ |
| GET    | `/applications/:id/contacts`              | List contacts      |
| POST   | `/applications/:id/contacts`              | Add a contact      |
| PATCH  | `/applications/:id/contacts/:contactId`   | Edit a contact     |
| DELETE | `/applications/:id/contacts/:contactId`   | Remove a contact   |

### Documents (login required)

| Method | Endpoint                                             | Description                                   |
| ------ | ---------------------------------------------------- | --------------------------------------------- |
| GET    | `/applications/:id/documents`                        | List documents                                |
| POST   | `/applications/:id/documents`                        | Upload (multipart: `file`, optional `kind`)   |
| GET    | `/applications/:id/documents/:documentId/download`   | Download (file, or redirect to signed S3 URL) |
| GET    | `/applications/:id/documents/:documentId/view`       | PDF bytes for in-app preview (PDF only)       |
| DELETE | `/applications/:id/documents/:documentId`            | Delete a document and its file                |

`kind` is `resume` (default), `cover_letter`, or `other`.

### Reminders (login required)

| Method | Endpoint                          | Description                                                  |
| ------ | --------------------------------- | ------------------------------------------------------------ |
| GET    | `/applications/:id/reminders`     | Reminders for one application                                |
| POST   | `/applications/:id/reminders`     | Add a reminder (`remind_at` ISO date-time, optional `note`)  |
| GET    | `/reminders?status=open\|done`    | All reminders across applications, with company and role     |
| GET    | `/reminders/follow-ups?days=7`    | Active applications with no update in `days` days            |
| PATCH  | `/reminders/:reminderId`          | Mark done (`completed`), reschedule, or edit the note        |
| DELETE | `/reminders/:reminderId`          | Delete a reminder                                            |

### Stats (login required)

| Method | Endpoint          | Description                                        |
| ------ | ----------------- | -------------------------------------------------- |
| GET    | `/stats/overview` | Total, count per status, and conversion rates      |
| GET    | `/stats/weekly`   | Number of applications created per week            |

### Health

| Method | Endpoint  | Description        |
| ------ | --------- | ------------------ |
| GET    | `/health` | Service health check |

---

## Deployment

```
GitHub push to main
        |
   GitHub Actions  (migrations + tests, then OIDC into AWS)
        |
       ECR  (image tagged with the commit SHA)
        |
Internet -> Application Load Balancer -> ECS Fargate task
                                          |- API container
                                          |- Redis container
                                                |
                                          RDS PostgreSQL (private)

SSM Parameter Store -> database URL and JWT secrets
S3                  -> uploaded documents
CloudWatch          -> logs, metrics, alarms
```

How it got here, and why each step:

| Stage | What changed | Why |
| --- | --- | --- |
| Manual EC2 | Nginx, PM2, Node, Postgres and Redis on one Ubuntu box | To understand ports, processes and security groups before hiding them behind a platform |
| RDS | Database moved off the app server, TLS enabled, reachable only from the app's security group | The database should outlive any one server |
| SSM Parameter Store | Secrets read at startup through an IAM role | Nothing sensitive on disk or in the repository |
| Docker + ECR | API packaged as an image, tagged by commit | The tested artifact is the deployed artifact, and every deploy is traceable to a commit |
| ECS Fargate + ALB | Container runs as a managed task behind a load balancer with a `/health` check | Tasks can be replaced without the address changing, and there is no server to patch |
| GitHub Actions + OIDC | Push to main tests and deploys, with no stored AWS keys | Deploys are repeatable and credentials are short lived |

Security boundaries:

- The internet can reach only the load balancer; the load balancer can reach only the ECS task; only the ECS task can reach the database
- The deploy role can push an image and update the service, and nothing else
- The app's task role can read, write and delete objects in one bucket, and nothing else

Known limitations, kept deliberately for a single-user app:

- Redis runs as a sidecar in the same task, so two tasks would mean two separate caches. A shared service such as ElastiCache is the right answer when scaling out
- The load balancer serves HTTP. The frontend forwards `/api/*` to it so the browser only ever talks HTTPS to the site itself. A custom domain with TLS on the load balancer is the proper fix
- The rate limiter sees the load balancer's address rather than the visitor's, so the login limit is currently shared
- Migrations are run as a one-off ECS task rather than as part of the deploy

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`.

**Test job**

- Starts a PostgreSQL 16 service container
- Installs dependencies and runs migrations
- Runs the Jest test suite

**Deploy job** (pushes to `main` only, after tests pass)

- Authenticates to AWS with OIDC (no stored AWS keys)
- Builds the Docker image and pushes it to Amazon ECR, tagged with the commit SHA
- Updates the ECS task definition with the new image
- Deploys to the ECS service and waits until it is stable

### Running migrations against production

RDS is private, so migrations run from inside the network as a one-off task
using the same image, subnets and security group as the service:

```bash
aws ecs run-task   --cluster job-tracker-cluster   --task-definition job-tracker-task   --launch-type FARGATE   --network-configuration "awsvpcConfiguration={subnets=[SUBNET_ID],securityGroups=[SG_ID],assignPublicIp=ENABLED}"   --overrides '{"containerOverrides":[{"name":"job-tracker-api","command":["npx","knex","migrate:latest"]}]}'
```

### Enabling S3 uploads in production

1. Create a private S3 bucket (block all public access)
2. Give the ECS task role `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*`
3. Set `STORAGE_DRIVER=s3` and `S3_BUCKET=<bucket>` in the ECS task definition
4. Run `npm run migrate` against the production database for the new tables

No AWS keys are needed in the app: the SDK uses the task role automatically.

---

## License

MIT
