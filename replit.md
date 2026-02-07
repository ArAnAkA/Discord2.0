# Overview

Aurora is a real-time chat application inspired by Discord's UX structure but with a custom "Aurora" color theme (deep teal/jade base with cyan/indigo accents). It features a three-column layout: server rail, channel list, and chat area with a members panel. The app supports user authentication via JWT, server/channel management, real-time messaging via Socket.IO, and file uploads.

The project is a full-stack TypeScript monorepo with an Express backend, React frontend (via Vite), PostgreSQL database (via Drizzle ORM), and real-time communication through Socket.IO.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Monorepo Structure
- **`client/`** — React SPA (Vite + TypeScript + Tailwind CSS)
- **`server/`** — Express.js API server with Socket.IO
- **`shared/`** — Shared schema definitions (Drizzle ORM) and API route contracts used by both client and server
- **`migrations/`** — Drizzle-generated database migrations
- **`script/`** — Build tooling (esbuild for server, Vite for client)

## Frontend Architecture
- **Framework**: React with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight router, not React Router)
- **State Management**: Zustand for auth state (`useAuthStore`), TanStack React Query for server state/data fetching
- **UI Components**: shadcn/ui (new-york style) with Radix UI primitives, styled via Tailwind CSS with CSS variables
- **Styling**: Tailwind CSS with a custom "Aurora" dark theme using CSS custom properties defined in `client/src/index.css`
- **Fonts**: Outfit (display), Inter (body)
- **Forms**: React Hook Form with Zod resolvers
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Key Frontend Components
- `ServerRail` — Left sidebar with server icons (Discord-like)
- `ChannelList` — Channel navigation within a server
- `ChatArea` — Message display and input with file upload
- `MemberList` — Right panel showing online/offline members
- `Auth` — Login/register page

## Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript, executed via `tsx` in dev, compiled via esbuild for production
- **API Style**: RESTful JSON API under `/api/` prefix
- **Real-time**: Socket.IO for live messaging, typing indicators, and channel joining
- **Authentication**: JWT-based (Bearer token in Authorization header), with `bcryptjs` for password hashing
- **File Uploads**: Multer middleware
- **Session**: No session-based auth; JWT tokens stored in localStorage on client

### Server Entry Flow
1. `server/index.ts` — Creates Express app and HTTP server
2. `server/routes.ts` — Registers all API routes and Socket.IO handlers
3. `server/vite.ts` — Sets up Vite dev middleware in development
4. `server/static.ts` — Serves built client files in production

## Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Connection**: `DATABASE_URL` environment variable (required)
- **Schema location**: `shared/schema.ts`
- **Tables**:
  - `users` — id, username, password, displayName, avatarUrl, online, lastSeen
  - `servers` — id, name, iconUrl, ownerId, createdAt
  - `server_members` — id, serverId, userId, role, joinedAt
  - `channels` — id, serverId (nullable for DMs), name, type (text/voice)
  - `messages` — id, channelId, userId, content, file fields, timestamps
- **Schema push**: `npm run db:push` (uses drizzle-kit push)
- **Storage layer**: `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class using Drizzle queries

## Shared Contract Layer
- `shared/schema.ts` — Drizzle table definitions and Zod insert schemas (via `drizzle-zod`)
- `shared/routes.ts` — API route definitions with paths, methods, and Zod validation schemas. Used by both client hooks and server routes for type safety.

## Build System
- **Dev**: `tsx server/index.ts` with Vite dev middleware (HMR)
- **Production build**: `script/build.ts` runs Vite build for client, esbuild for server → outputs to `dist/`
- **Production start**: `node dist/index.cjs`

# External Dependencies

## Required Services
- **PostgreSQL** — Primary database, connected via `DATABASE_URL` environment variable. Must be provisioned before the app starts.

## Environment Variables
- `DATABASE_URL` (required) — PostgreSQL connection string
- `JWT_SECRET` (optional, defaults to `"replit-aurora-secret"`) — Secret for signing JWT tokens

## Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **socket.io** + **socket.io-client** — Real-time bidirectional communication
- **jsonwebtoken** — JWT token creation and verification
- **bcryptjs** — Password hashing
- **multer** — File upload handling
- **@tanstack/react-query** — Server state management
- **zustand** — Client-side state management
- **wouter** — Client-side routing
- **zod** + **drizzle-zod** — Schema validation
- **react-hook-form** + **@hookform/resolvers** — Form management
- **shadcn/ui components** (Radix UI primitives) — UI component library
- **date-fns** — Date formatting in chat messages
- **tailwindcss** — Utility-first CSS framework