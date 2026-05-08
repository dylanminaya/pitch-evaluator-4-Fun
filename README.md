# Pitch Evaluator

A Next.js monorepo with Express backend, PostgreSQL, and better-auth authentication.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v9+)
- [Docker](https://www.docker.com/) (for PostgreSQL)
- [just](https://github.com/casey/just) (command runner)

## Quick Start

### 1. Install dependencies

```bash
just install
```

### 2. Set up environment variables

Copy the example env file and configure it:

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `BETTER_AUTH_SECRET` - Secret key for authentication
- `BETTER_AUTH_URL` - Backend URL (e.g., `http://localhost:3001`)
- `FRONTEND_URL` - Frontend URL (e.g., `http://localhost:3000`)
- `NEXT_PUBLIC_API_URL` - Backend URL for the frontend
- `LIBREOFFICE_BINARY` - Optional path to LibreOffice if it is not available on PATH

> Note: LibreOffice is a native system dependency, not an npm package. On Vercel, this means the backend must run on an environment where LibreOffice is already installed or you must use a separate service for conversion.

### 3. Start the database

```bash
just db-up
```

### 4. Run database migrations

```bash
just db-migrate
```

### 5. Start development servers

```bash
just dev-all
```

## Available Commands

Run `just` to see all available commands:

| Command            | Description                              |
| ------------------ | ---------------------------------------- |
| `just install`     | Install all dependencies                 |
| `just dev-quick`   | Start all dev servers (no checks)        |
| `just dev-all`     | Run checks then start all dev servers    |
| `just dev-web`     | Run checks then start web dev server     |
| `just dev-backend` | Run checks then start backend dev server |
| `just check`       | Run all checks (lint, typecheck, build)  |
| `just lint`        | Run linter                               |
| `just typecheck`   | Run type checking                        |
| `just build`       | Build the project                        |
| `just format`      | Format code                              |

### Database Commands

| Command           | Description                       |
| ----------------- | --------------------------------- |
| `just db-up`      | Start PostgreSQL and pgAdmin      |
| `just db-down`    | Stop database containers          |
| `just db-logs`    | View database logs                |
| `just db-reset`   | Reset database (removes all data) |
| `just db-migrate` | Run migrations and create app tables |
| `just db-schema`  | Create app tables only            |

### Backend Commands

| Command              | Description              |
| -------------------- | ------------------------ |
| `just backend`       | Start backend dev server |
| `just backend-build` | Build backend            |

## Project Structure

```
.
├── apps/
│   ├── web/          # Next.js frontend
│   └── backend/      # Express backend
├── packages/
│   ├── ui/           # Shared UI components (shadcn/ui)
│   ├── shared/       # Shared types, schemas, and env validation
│   ├── eslint-config/
│   └── typescript-config/
├── .env              # Environment variables
├── justfile          # Command definitions
└── docker-compose.yml
```

## Adding UI Components

To add shadcn/ui components:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

Components are placed in `packages/ui/src/components`.

## Using Shared Types

Import Zod schemas and types from the shared package:

```tsx
import { loginRequestSchema, type LoginRequest } from "@workspace/shared/api";
import { validateClientEnv } from "@workspace/shared/env/client";
```

## URLs

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **pgAdmin**: http://localhost:5050
