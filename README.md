# Job Application Tracker

A full-stack web application for tracking job applications through their lifecycle, from initial submission to offer or rejection. Built as a portfolio project with production-grade backend architecture and a custom-designed frontend.

**Live:** [Frontend on Vercel](#) · [API on Render](#)

---

## Features

- **Application Management** Create, view, filter, and paginate job applications
- **Status Transitions** Enforced via a finite state machine (e.g. `applied → interviewing → offered`)
- **Audit Timeline** Every status change is recorded via event sourcing; full history visible on each application
- **Authentication** Secure login/register with JWT access tokens and refresh token rotation
- **Dashboard Stats** Cached summary metrics (total, by status, response rate)
- **Rate Limiting** —Redis-backed per-IP rate limiting on auth endpoints

---

## Tech Stack

### Backend

| Layer            | Choice                            |
| ---------------- | --------------------------------- |
| Runtime          | Node.js + Express                 |
| Database         | PostgreSQL (via Knex)             |
| Cache / Sessions | Redis (Upstash)                   |
| Validation       | Zod                               |
| Logging          | Pino                              |
| Auth             | JWT (HttpOnly cookies) + bcryptjs |

### Frontend

| Layer     | Choice                             |
| --------- | ---------------------------------- |
| Framework | Next.js 16 (App Router)            |
| Language  | TypeScript                         |
| Styling   | Tailwind v4 + custom design system |
| Fonts     | Manrope + Inter                    |

### Infrastructure

| Concern     | Provider          |
| ----------- | ----------------- |
| API hosting | Render            |
| Database    | Neon (PostgreSQL) |
| Cache       | Upstash (Redis)   |
| Frontend    | Vercel            |
| CI          | GitHub Actions    |

---

## Architecture Highlights

### Auth & Security

- JWT access tokens delivered via **HttpOnly cookies** (XSS-safe)
- **Refresh token rotation** — tokens are single-use and Redis-backed for invalidation
- **CSRF protection** via SameSite cookies + custom request header check
- **bcryptjs** password hashing
- Redis rate limiting on `/auth` routes

### Application Status FSM

Status transitions are controlled by a finite state machine, invalid transitions (e.g. jumping from `applied` directly to `rejected` without interviewing) are rejected at the service layer, not just the UI.

Valid transitions:

```
applied → interviewing → offered → accepted
                      ↘ rejected
applied → rejected
interviewing → rejected
```

### Event Sourcing / Audit Log

Every status change writes an immutable event to an `application_events` table (timestamp, from_status, to_status, note). The frontend renders this as a timeline on the application detail page.

### Redis Cache-Aside

Dashboard stats are cached in Redis with a short TTL. On a cache miss, stats are computed from PostgreSQL and written back. Cache is invalidated on any application write.

---

## Running Locally

### Prerequisites

- Node.js 18+
- Docker + Docker Compose

### Setup

```bash
git clone https://github.com/your-username/job-tracker.git
cd job-tracker
```

**Backend:**

```bash
cd backend
cp .env.example .env       # fill in your values
docker-compose up -d       # starts Postgres + Redis
npm install
npm run migrate
npm run dev
```

**Frontend:**

```bash
cd frontend
cp .env.example .env.local # set NEXT_PUBLIC_API_URL
npm install
npm run dev
```

### Environment Variables

**Backend `.env`:**

```
DATABASE_URL=
REDIS_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
NODE_ENV=development
```

**Frontend `.env.local`:**

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## API Overview

| Method | Endpoint                   | Description                          |
| ------ | -------------------------- | ------------------------------------ |
| POST   | `/auth/register`           | Register a new user                  |
| POST   | `/auth/login`              | Login, receive tokens                |
| POST   | `/auth/refresh`            | Rotate refresh token                 |
| POST   | `/auth/logout`             | Invalidate session                   |
| GET    | `/applications`            | List applications (filter, paginate) |
| POST   | `/applications`            | Create application                   |
| GET    | `/applications/:id`        | Get application + event history      |
| PATCH  | `/applications/:id/status` | Transition status                    |
| DELETE | `/applications/:id`        | Delete application                   |
| GET    | `/stats`                   | Dashboard summary (cached)           |

---

## CI/CD

GitHub Actions runs on every push to `main`:

- Installs dependencies
- Runs linter
- Runs test suite

Render auto-deploys the backend on passing CI. Vercel auto-deploys the frontend.

---

## License

MIT
