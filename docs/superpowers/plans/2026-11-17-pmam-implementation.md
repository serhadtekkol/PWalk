# PMAM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build PMAM, a multi-user, multi-project management web application with a detailed Kanban board, an MS Project-like Gantt/WBS/Critical Path/Workload interface, a mobile-ready REST API (`/api/v1` + OpenAPI), Web Push + `ntfy` notifications, and Docker Compose deployment backed by the existing Docker `mssql` server.

**Architecture:** A pnpm monorepo with `apps/api` (Fastify + TypeScript + Prisma ORM for MSSQL + Swagger + background reminder/push scheduler) and `apps/web` (React 19 + TypeScript + Vite + Tailwind CSS + `@dnd-kit` + PWA Service Worker). `pmam-web` (Nginx) serves the SPA and reverse-proxies `/api/*` and `/docs/*` to `pmam-api`, exposing a single port (`127.0.0.1:3600:80`) and attaching to the external Docker `web` network so `mssql`, `ntfy`, and `cloudflared` communicate directly.

**Tech Stack:** Node.js 26, pnpm 11, TypeScript, Fastify 5, Prisma 6 (SQL Server), Zod, Vitest, React 19, Vite 6, Tailwind CSS 4, `@dnd-kit/core` + `@dnd-kit/sortable`, `lucide-react`, `web-push`, Docker & Nginx.

**Spec:** [2026-11-17-pmam-design.md](file:///Users/serhadbahadir/claudeprojects/pmam/docs/superpowers/specs/2026-11-17-pmam-design.md)

## Global Constraints

- Database: Existing Docker `mssql` (`mcr.microsoft.com/mssql/server:2022-latest`, port `1433`, network `web`), dedicated database named `pmam`.
- MSSQL Prisma constraint: Self-relations (`Task.parentId`) and multi-FK relations (`TaskDependency`, `Notification`, `TaskActivity`) MUST use `onDelete: NoAction, onUpdate: NoAction` to avoid SQL Server multiple cascade path errors; cascading deletes are handled in API transactions.
- API versioning: All REST endpoints live under `/api/v1/*`; OpenAPI/Swagger UI is served at `/docs`.
- Auth: Access Token (15m JWT) + Refresh Token (30d rotated in DB). First registered user is `ADMIN`; subsequent users are `MEMBER`.
- Roles per project: `OWNER`, `EDITOR`, `VIEWER` (`ADMIN` system role can manage any project).
- Notifications: Both Web Push (VAPID) and `ntfy` (`NTFY_URL` + user `ntfyTopic`) supported; background scheduler runs every 60 seconds.
- UI language & style: Turkish UI copy, modern & minimalistic (Linear/Notion aesthetic), Light/Dark mode support.

## Review Focus

- **Circular dependencies in MS Project Gantt:** Adding `A -> B -> C -> A` (or `A -> A`) must be rejected with HTTP `400` before saving, never causing infinite recursion in CPM or WBS rendering.
- **MSSQL multiple cascade paths & task deletion:** Deleting a parent task that has subtasks, dependencies, comments, reminders, and notifications must succeed cleanly inside a transaction without SQL Server FK constraint errors.
- **Invalid/reversed task dates:** Creating or dragging a task so `dueDate < startDate` must be rejected (`400`) or clamped cleanly; CPM must handle zero-duration milestones (`isMilestone = true`, `startDate == dueDate`) without dividing by zero.
- **Unauthorized cross-project access:** A logged-in user who is not a member of Project X (and not `ADMIN`) must receive `403` on Project X tasks, columns, schedule, and workload endpoints.
- **Duplicate due-soon / overdue push notifications:** Running the 60-second scheduler multiple times must not spam users with repeated `DUE_SOON` or `OVERDUE` notifications on the same day.

---

### Task 1: Monorepo Workspace, Config & Prisma MSSQL Schema

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/lib/prisma.ts`
- Create: `apps/api/src/lib/ensure-db.ts`
- Test: `apps/api/test/schema.test.ts`

**Interfaces:**
- Produces:
  - `apps/api/src/config.ts`: `loadConfig(): AppConfig`
  - `apps/api/src/lib/prisma.ts`: `prisma: PrismaClient`
  - `apps/api/src/lib/ensure-db.ts`: `ensureDatabaseExists(databaseUrl: string): Promise<void>`

- [ ] **Step 1: Initialize root workspace files**
  Create `package.json` (`private: true`, scripts `dev:api`, `dev:web`, `build`, `test`), `pnpm-workspace.yaml` (`packages: ["apps/*"]`), `.gitignore`, and `.env.example` (with `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NTFY_URL`, `PORT=4000`, `WEB_PORT=3600`).

- [ ] **Step 2: Create `apps/api/package.json`, `tsconfig.json`, and `prisma/schema.prisma`**
  Add dependencies (`fastify`, `@fastify/cors`, `@fastify/jwt`, `@fastify/swagger`, `@fastify/swagger-ui`, `@prisma/client`, `bcryptjs`, `zod`, `web-push`, `mssql`) and devDependencies (`prisma`, `typescript`, `tsx`, `vitest`, `@types/node`, `@types/bcryptjs`, `@types/web-push`).
  Write `prisma/schema.prisma` with `provider = "sqlserver"` and all 12 models from the spec (`User`, `RefreshToken`, `Project`, `ProjectMember`, `BoardColumn`, `Task`, `TaskDependency`, `TaskComment`, `TaskActivity`, `Reminder`, `Notification`, `PushSubscription`) using `onDelete: NoAction, onUpdate: NoAction` on self-relations and multi-FK edges.

- [ ] **Step 3: Write failing test for config & Prisma schema validation**
  In `apps/api/test/schema.test.ts`: assert `loadConfig()` parses required env defaults and `prisma validate` exits 0.

- [ ] **Step 4: Run test to verify it fails**
  Run: `pnpm --filter @pmam/api test`
  Expected: FAIL (`config.ts` not found).

- [ ] **Step 5: Implement `config.ts`, `prisma.ts`, `ensure-db.ts` and install dependencies**
  `ensureDatabaseExists` connects to `master` via `mssql` package and executes `IF DB_ID('pmam') IS NULL CREATE DATABASE [pmam]`.
  Run `pnpm install` and `pnpm --filter @pmam/api prisma generate`.

- [ ] **Step 6: Run tests and `prisma validate`**
  Run: `pnpm --filter @pmam/api prisma validate && pnpm --filter @pmam/api test`
  Expected: PASS.

- [ ] **Step 7: Commit**
  `git add package.json pnpm-workspace.yaml .gitignore .env.example apps/api && git commit -m "chore: scaffold monorepo and Prisma MSSQL schema"`

---

### Task 2: Fastify Server, Auth API (JWT + Refresh) & OpenAPI/Swagger

**Files:**
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/auth.ts`
- Test: `apps/api/test/auth.test.ts`

**Interfaces:**
- Consumes: `loadConfig`, `prisma`, `ensureDatabaseExists`
- Produces:
  - `apps/api/src/app.ts`: `buildApp(opts?: { enableScheduler?: boolean }): Promise<FastifyInstance>`
  - `apps/api/src/plugins/auth.ts`: `fastify.authenticate` preHandler decorating `request.authUser: { id: string; email: string; name: string; role: 'ADMIN' | 'MEMBER' }`
  - Endpoints: `GET /api/v1/health`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `PATCH /api/v1/auth/me`, `GET /api/v1/users` (list users for member/assignee selection)

- [ ] **Step 1: Write failing auth integration tests**
  In `apps/api/test/auth.test.ts`: test register (first user becomes `ADMIN`, second becomes `MEMBER`, duplicate email returns `409`), login (returns `accessToken` + `refreshToken`), `GET /api/v1/auth/me` (returns `401` without token, `200` with Bearer token), `POST /api/v1/auth/refresh` (rotates token), `PATCH /api/v1/auth/me` (updates `name`, `dailyCapacityHours`, `ntfyTopic`).

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @pmam/api test test/auth.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `plugins/auth.ts`, `routes/health.ts`, `routes/auth.ts`, `app.ts`, `index.ts`**
  Register `@fastify/cors`, `@fastify/jwt`, `@fastify/swagger` + `@fastify/swagger-ui` at `/docs`. Hash passwords and refresh tokens with `bcryptjs` / SHA-256.

- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @pmam/api test test/auth.test.ts`
  Expected: PASS (using a dedicated test DB or mocked/local MSSQL `pmam_test` if available — verify against actual Docker `mssql`!).

- [ ] **Step 5: Commit**
  `git add apps/api/src apps/api/test && git commit -m "feat(api): add Fastify server, JWT auth, user profile, and Swagger docs"`

---

### Task 3: Projects, Members & BoardColumns API

**Files:**
- Create: `apps/api/src/lib/permissions.ts`
- Create: `apps/api/src/routes/projects.ts`
- Create: `apps/api/src/routes/columns.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/projects.test.ts`

**Interfaces:**
- Consumes: `prisma`, `fastify.authenticate`
- Produces:
  - `apps/api/src/lib/permissions.ts`: `requireProjectRole(userId: string, systemRole: string, projectId: string, allowed: ('OWNER' | 'EDITOR' | 'VIEWER')[]): Promise<ProjectMember | null>`
  - Endpoints:
    - `GET /api/v1/projects`, `POST /api/v1/projects` (auto-creates 4 default `BoardColumn`s: *Yapılacak*, *Devam Ediyor*, *İncelemede*, *Tamamlandı* and adds creator as `OWNER`), `GET /api/v1/projects/:id`, `PATCH /api/v1/projects/:id`, `DELETE /api/v1/projects/:id`
    - `GET /api/v1/projects/:id/members`, `POST /api/v1/projects/:id/members`, `PATCH /api/v1/projects/:id/members/:userId`, `DELETE /api/v1/projects/:id/members/:userId`
    - `GET /api/v1/projects/:id/columns`, `POST /api/v1/projects/:id/columns`, `PATCH /api/v1/columns/:id`, `DELETE /api/v1/columns/:id`, `POST /api/v1/projects/:id/columns/reorder`

- [ ] **Step 1: Write failing tests for projects, members, permissions, and columns**
  Include Review Focus test: non-member `MEMBER` user receives `403` when accessing another user's project. Also test creating project auto-seeds 4 columns, adding/removing member, and reordering columns.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @pmam/api test test/projects.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `permissions.ts`, `routes/projects.ts`, `routes/columns.ts` and register in `app.ts`**

- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @pmam/api test test/projects.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add apps/api/src apps/api/test && git commit -m "feat(api): add projects, members, role permissions, and Kanban columns"`

---

### Task 4: Tasks, Subtasks, Kanban Move, Comments & Activity API

**Files:**
- Create: `apps/api/src/routes/tasks.ts`
- Create: `apps/api/src/routes/comments.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/tasks.test.ts`

**Interfaces:**
- Consumes: `prisma`, `fastify.authenticate`, `requireProjectRole`
- Produces:
  - `GET /api/v1/tasks/my` (tasks assigned to current user across all projects)
  - `GET /api/v1/projects/:id/tasks` (filters: `assigneeId`, `priority`, `status`, `search`, `overdue`)
  - `POST /api/v1/projects/:id/tasks` (auto-generates `code` like `PM-1`, validates `dueDate >= startDate`, logs `TaskActivity`)
  - `GET /api/v1/tasks/:id`, `PATCH /api/v1/tasks/:id`, `DELETE /api/v1/tasks/:id` (transactional delete removing subtasks, dependencies, comments, reminders, notifications, activities)
  - `POST /api/v1/tasks/:id/move` (`{ columnId, order }` — updates `columnId`, `order`, `status` from column's `mappedStatus`, sets `progress = 100` if `DONE` and not explicitly overridden, logs `TaskActivity`)
  - `GET /api/v1/tasks/:id/comments`, `POST /api/v1/tasks/:id/comments`, `GET /api/v1/tasks/:id/activity`

- [ ] **Step 1: Write failing tests for task CRUD, Kanban move, date validation, and transactional delete**
  Include Review Focus tests:
  1. `dueDate < startDate` returns `400`.
  2. Deleting a parent task with subtasks, dependencies, comments, reminders, and notifications succeeds cleanly (`200`) without SQL Server FK cascade errors.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @pmam/api test test/tasks.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `routes/tasks.ts` and `routes/comments.ts`, register in `app.ts`**

- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @pmam/api test test/tasks.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add apps/api/src apps/api/test && git commit -m "feat(api): add tasks, subtasks, Kanban move, comments, and activity logs"`

---

### Task 5: Dependencies, CPM Critical Path & Workload Engine

**Files:**
- Create: `apps/api/src/services/scheduler-math.ts`
- Create: `apps/api/src/routes/schedule.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/schedule.test.ts`

**Interfaces:**
- Consumes: `prisma`, `fastify.authenticate`, `requireProjectRole`
- Produces:
  - `apps/api/src/services/scheduler-math.ts`:
    - `wouldCreateCycle(edges: { predecessorId: string; successorId: string }[], predecessorId: string, successorId: string): boolean`
    - `computeCriticalPath(tasks: CpmTaskInput[], dependencies: CpmDepInput[]): CpmResult`
    - `computeWorkload(tasks: WorkloadTaskInput[], members: WorkloadMemberInput[], from: Date, to: Date): WorkloadReport`
  - Endpoints:
    - `POST /api/v1/tasks/:id/dependencies`, `DELETE /api/v1/dependencies/:id`
    - `GET /api/v1/projects/:id/schedule/critical-path`
    - `GET /api/v1/projects/:id/workload`

- [ ] **Step 1: Write failing unit & integration tests for cycle detection, CPM, and workload**
  Include Review Focus tests:
  1. Self-dependency `A -> A` and cycle `A -> B -> C -> A` return `400`.
  2. Zero-duration milestone (`isMilestone: true`, `startDate === dueDate`) computes CPM and workload without division by zero.
  3. Workload flags `overloaded: true` when daily allocated hours exceed `user.dailyCapacityHours`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @pmam/api test test/schedule.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `scheduler-math.ts` and `routes/schedule.ts`, register in `app.ts`**

- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @pmam/api test test/schedule.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add apps/api/src apps/api/test && git commit -m "feat(api): add task dependencies, CPM critical path, and workload calculation"`

---

### Task 6: Push Notifications (Web Push + ntfy), Reminders & Scheduler

**Files:**
- Create: `apps/api/src/services/push.ts`
- Create: `apps/api/src/services/reminder-worker.ts`
- Create: `apps/api/src/routes/notifications.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/tasks.ts` (trigger notification on task assignment)
- Modify: `apps/api/src/routes/comments.ts` (trigger notification on comment)
- Test: `apps/api/test/notifications.test.ts`

**Interfaces:**
- Consumes: `prisma`, `loadConfig`, `fastify.authenticate`
- Produces:
  - `apps/api/src/services/push.ts`: `deliverNotification(userId: string, payload: { taskId?: string; type: string; title: string; body: string }): Promise<void>`
  - `apps/api/src/services/reminder-worker.ts`: `runReminderTick(now?: Date): Promise<{ remindersSent: number; dueSoonSent: number; overdueSent: number }>`, `startReminderScheduler(): NodeJS.Timeout`
  - Endpoints: `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`, `GET/POST/DELETE /api/v1/tasks/:id/reminders`, `GET /api/v1/push/vapid-public-key`, `POST /api/v1/push/subscribe`, `DELETE /api/v1/push/subscribe`, `POST /api/v1/push/test`

- [ ] **Step 1: Write failing tests for reminders, duplicate prevention, and notification endpoints**
  Include Review Focus test: calling `runReminderTick(now)` twice within the same day for a due-soon/overdue task creates and delivers only 1 notification per task/user/type.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @pmam/api test test/notifications.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `push.ts`, `reminder-worker.ts`, `routes/notifications.ts`, and wire assignment/comment triggers**

- [ ] **Step 4: Run tests to verify they pass**
  Run: `pnpm --filter @pmam/api test test/notifications.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add apps/api/src apps/api/test && git commit -m "feat(api): add Web Push, ntfy delivery, reminders, and scheduler worker"`

---

### Task 7: Frontend Shell, Auth Pages, Theme, My Tasks & Notification Center

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/index.css`
- Create: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/types/pmam.ts`
- Create: `apps/web/src/stores/auth.tsx`
- Create: `apps/web/src/stores/theme.tsx`
- Create: `apps/web/src/pages/LoginPage.tsx`
- Create: `apps/web/src/components/AppShell.tsx`
- Create: `apps/web/src/components/MyTasksView.tsx`
- Create: `apps/web/src/components/NotificationCenter.tsx`
- Create: `apps/web/src/components/SettingsModal.tsx`
- Create: `apps/web/src/components/CreateProjectModal.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: `/api/v1/auth/*`, `/api/v1/projects`, `/api/v1/tasks/my`, `/api/v1/notifications/*`, `/api/v1/push/*`
- Produces: Typed API client (`apiFetch`), `AuthProvider`, `AppShell` workspace layout, `LoginPage`, `MyTasksView`, `NotificationCenter`, `SettingsModal`

- [ ] **Step 1: Scaffold `apps/web` with Vite, React 19, TypeScript, Tailwind CSS 4, `lucide-react`, `@dnd-kit/core`, `@dnd-kit/sortable`**
  Run `pnpm install`.

- [ ] **Step 2: Implement typed `src/types/pmam.ts` and `src/lib/api.ts` (with automatic JWT refresh on 401)**

- [ ] **Step 3: Implement `AuthProvider`, `ThemeProvider`, `LoginPage`, `AppShell`, `MyTasksView`, `NotificationCenter`, `SettingsModal`, `CreateProjectModal`, and `App.tsx`**

- [ ] **Step 4: Verify TypeScript and Vite production build**
  Run: `pnpm --filter @pmam/web exec tsc --noEmit && pnpm --filter @pmam/web build`
  Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**
  `git add apps/web && git commit -m "feat(web): add frontend shell, login/register, theme, notifications, and settings"`

---

### Task 8: Detailed Kanban Board, Task Drawer & Project Settings

**Files:**
- Create: `apps/web/src/components/KanbanBoard.tsx`
- Create: `apps/web/src/components/KanbanColumn.tsx`
- Create: `apps/web/src/components/KanbanCard.tsx`
- Create: `apps/web/src/components/TaskDrawer.tsx`
- Create: `apps/web/src/components/ProjectSettingsView.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `Project`, `BoardColumn`, `Task`, `User` from `apps/web/src/types/pmam.ts`
- Produces:
  - `KanbanBoard` (`@dnd-kit` cross-column & intra-column drag-and-drop, WIP limit indicator, column add/rename/delete, quick task creation)
  - `TaskDrawer` (full task editing: title, description, status, priority, assignee, dates, estimatedHours, progress slider, milestone toggle, subtasks, dependencies, reminders, comments, activity log)
  - `ProjectSettingsView` (member management with roles, column management)

- [ ] **Step 1: Implement `KanbanCard`, `KanbanColumn`, and `KanbanBoard` with `@dnd-kit`**

- [ ] **Step 2: Implement `TaskDrawer` and `ProjectSettingsView`, wire into `App.tsx`**

- [ ] **Step 3: Verify TypeScript and Vite production build**
  Run: `pnpm --filter @pmam/web exec tsc --noEmit && pnpm --filter @pmam/web build`
  Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**
  `git add apps/web && git commit -m "feat(web): add detailed Kanban board, task drawer, and project settings"`

---

### Task 9: MS Project Gantt & WBS View + Workload View

**Files:**
- Create: `apps/web/src/lib/wbs.ts`
- Create: `apps/web/src/components/GanttView.tsx`
- Create: `apps/web/src/components/WorkloadView.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/lib/wbs.test.ts`

**Interfaces:**
- Consumes: `apiFetch`, `Task`, `TaskDependency`, `CriticalPathResult`, `WorkloadReport`
- Produces:
  - `apps/web/src/lib/wbs.ts`: `buildWbsTree(tasks: Task[], collapsedIds: Set<string>): WbsRow[]` (assigns `1`, `1.1`, `1.2` codes, respects collapse state)
  - `GanttView` (split WBS table + interactive Day/Week/Month timeline, drag bar to shift dates, drag edges to resize duration, SVG dependency arrows for `FS/SS/FF/SF`, milestone diamond `◆`, Critical Path toggle highlighting critical tasks & arrows)
  - `WorkloadView` (member rows vs day columns heatmap showing allocated hours vs `dailyCapacityHours`)

- [ ] **Step 1: Write failing unit test for `buildWbsTree` in `apps/web/src/lib/wbs.test.ts`**
  Assert hierarchical WBS numbering (`1`, `1.1`, `1.2`, `2`) and collapse hiding children.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm --filter @pmam/web test`
  Expected: FAIL.

- [ ] **Step 3: Implement `wbs.ts`, `GanttView.tsx`, `WorkloadView.tsx`, and wire into `App.tsx`**

- [ ] **Step 4: Run tests and verify TypeScript + Vite build**
  Run: `pnpm --filter @pmam/web test && pnpm --filter @pmam/web exec tsc --noEmit && pnpm --filter @pmam/web build`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add apps/web && git commit -m "feat(web): add MS Project Gantt/WBS/Critical Path and Workload views"`

---

### Task 10: PWA Web Push Service Worker, Docker Compose & End-to-End Verification

**Files:**
- Create: `apps/web/public/sw.js`
- Create: `apps/web/public/manifest.webmanifest`
- Create: `apps/web/nginx.conf`
- Create: `apps/web/Dockerfile`
- Create: `apps/api/Dockerfile`
- Create: `docker-compose.yml`
- Create: `README.md` (Cloudflare Tunnel + `.env` setup instructions)

**Interfaces:**
- Consumes: Built `apps/api` and `apps/web`
- Produces: Working `pmam-api` and `pmam-web` Docker containers on network `web` + `127.0.0.1:3600:80`

- [ ] **Step 1: Add `sw.js` (Web Push listener + notification click handler) and `manifest.webmanifest`**

- [ ] **Step 2: Create `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/web/nginx.conf`, `docker-compose.yml`, and `README.md`**

- [ ] **Step 3: Configure `.env` (using existing `mssql` container connection) and run `docker compose up -d --build`**

- [ ] **Step 4: Verify live Docker deployment**
  Run:
  - `docker compose ps` (both `pmam-api` and `pmam-web` healthy/up)
  - `curl -sS http://127.0.0.1:3600/api/v1/health` (returns `200 OK`)
  - `curl -sS -I http://127.0.0.1:3600/docs` (returns `200`/`302`)
  - `curl -sS -I http://127.0.0.1:3600/` (returns `200 OK`)
  - Run full API + Web test suites (`pnpm test`).

- [ ] **Step 5: Commit**
  `git add apps/web/public apps/web/Dockerfile apps/web/nginx.conf apps/api/Dockerfile docker-compose.yml README.md && git commit -m "chore(docker): add PWA service worker, Dockerfiles, Nginx proxy, and Compose setup"`
