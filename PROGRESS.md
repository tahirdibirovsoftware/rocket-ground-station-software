# AZST Ground Station — Progress Tracker

> Tracking completed work across all phases.

---

## Phase 0 — Repository Scaffolding ✓

**Completed:** 2026-04-07
**Commit:** `6b84520`

### What was done

| Task | Status |
|------|--------|
| Initialize Git repository with `.gitignore` | Done |
| Scaffold Tauri v2 project (React + TypeScript) | Done |
| Create FSD directory structure (7 layers, 20+ directories) | Done |
| Install core dependencies (441 packages, 0 vulnerabilities) | Done |
| Configure Tailwind CSS v4 with mission-control palette | Done |
| Configure ESLint (flat config) + Prettier | Done |
| Set up Vitest with jsdom + jest-dom matchers | Done |
| Set up `cargo test` with placeholder test | Done |
| Configure FSD path aliases (`@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`) | Done |
| Define domain types (`RocketAvionicsPacket`, `PayloadScientificPacket`, `FlightState`, `ConnectionState`) | Done |
| Initialize i18n with 4 locales (en, az, tr, ru) | Done |
| Create placeholder pages (Team Dashboard, Referee Dashboard) | Done |
| Set up React Router with route constants | Done |
| Add Rust dependencies (tokio, chrono, serde, env_logger) | Done |
| Update Tauri config (window 1440x900, min 1024x768) | Done |

### Test Results

| Runner | Tests | Passed | Failed |
|--------|:-----:|:------:|:------:|
| Vitest | 6 | 6 | 0 |
| cargo test | 1 | 1 | 0 |

### Files Created

```
Root Config:
  .gitignore, .prettierrc, eslint.config.js, vite.config.ts, tsconfig.json, index.html, package.json

Frontend (src/):
  main.tsx
  app/App.tsx
  app/routes/AppRoutes.tsx
  app/styles/index.css
  pages/team-dashboard/TeamDashboardPage.tsx
  pages/referee-dashboard/RefereeDashboardPage.tsx
  shared/types/index.ts
  shared/types/index.test.ts
  shared/config/constants.ts
  shared/i18n/index.ts
  shared/i18n/locales/en.json
  shared/i18n/locales/az.json
  shared/i18n/locales/tr.json
  shared/i18n/locales/ru.json
  shared/test/setup.ts

Backend (src-tauri/):
  Cargo.toml
  src/lib.rs
  src/main.rs
  tauri.conf.json
```

### Key Decisions

- **Tailwind CSS v4** — Using the new `@theme` directive for design tokens instead of `tailwind.config.ts`
- **Tauri v2** — Latest stable with improved IPC and plugin system
- **React 19** — Latest stable with improved performance
- **Path aliases** — Both Vite `resolve.alias` and TypeScript `paths` configured for FSD layers

---

## Phase 1 — Rust Binary Parsers & Unit Tests

**Status:** Not started

---

## Phase 2 — Mock Data Generator

**Status:** Not started

---

## Phase 3 — Serial Port Reader & CSV Logger

**Status:** Not started

---

## Phase 4 — Tauri IPC Bridge

**Status:** Not started

---

## Phase 5 — Redux Store & Data Layer

**Status:** Not started

---

## Phase 6 — Shared UI Foundation

**Status:** Not started

---

## Phase 7 — Team Dashboard

**Status:** Not started

---

## Phase 8 — Referee Dashboard

**Status:** Not started

---

## Phase 9 — Offline Map & Canvas Charting

**Status:** Not started

---

## Phase 10 — i18n, Responsiveness & Final Polish

**Status:** Not started
