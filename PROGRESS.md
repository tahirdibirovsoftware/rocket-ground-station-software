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

## Phase 1 — Rust Binary Parsers & Unit Tests ✓

**Completed:** 2026-04-08
**Commit:** `dc571ff`

### What was done

| Task | Status |
|------|--------|
| `RocketAvionicsPacket` struct (36 bytes) with `parse` + `build` | Done |
| `PayloadScientificPacket` struct (24 bytes) with `parse` + `build` | Done |
| `FlightState` enum (Pad/Powered/Unpowered/Apogee/PrimaryChute/SecondaryChute) | Done |
| XOR checksum: `compute`, `validate`, `stamp` functions | Done |
| Typed error enums (`RocketParseError`, `PayloadParseError`) with `Display` | Done |
| Serde JSON serialization with `snake_case` flight state names | Done |
| Little-endian field extraction (`u32`, `f32`, `u8`) | Done |
| Exhaustive test suite (45 unit tests + 1 doc test) | Done |

### Test Results

| Runner | Tests | Passed | Failed |
|--------|:-----:|:------:|:------:|
| cargo test (unit) | 45 | 45 | 0 |
| cargo test (doc) | 1 | 1 | 0 |

### Test Coverage

| Category | Tests |
|----------|:-----:|
| Checksum computation & validation | 8 |
| Rocket round-trip (all flight states, parachutes, boundaries) | 8 |
| Rocket error cases (length, start byte, packet ID, checksum, flight state) | 7 |
| Rocket serialization (JSON round-trip, flight state strings) | 2 |
| Payload round-trip (boundaries, negatives, extremes) | 5 |
| Payload error cases (length, start byte, packet ID, checksum) | 6 |
| Payload serialization | 1 |
| Cross-protocol (distinct start bytes, mutual rejection) | 4 |
| FlightState from_u8 (valid + invalid) | 2 |
| Error Display formatting | 2 |

### Files Created

```
Backend (src-tauri/src/protocol/):
  mod.rs              — Module declarations
  checksum.rs         — XOR checksum compute/validate/stamp
  rocket_packet.rs    — RocketPacket + FlightState + parser + builder
  payload_packet.rs   — PayloadPacket + parser + builder
  tests.rs            — 45 exhaustive tests

Modified:
  src-tauri/src/lib.rs — Added `pub mod protocol;`
```

### Key Decisions

- **Manual deserialization** over `#[repr(C, packed)]` — safer, more explicit, no alignment issues
- **`build_*` functions** — enables round-trip testing and will be reused by the mock data generator (Phase 2)
- **Typed error enums** — each validation step returns a specific error variant, aiding debugging in the field
- **`FlightState::from_u8`** returns `Option` — invalid values produce `None`, parsed as `InvalidFlightState` error
- **`serde(rename_all = "snake_case")`** — JSON output uses `"primary_chute"` not `"PrimaryChute"`, matching frontend TypeScript conventions

---

## Phase 2 — Mock Data Generator ✓

**Completed:** 2026-04-08
**Commit:** `6094fa7`

### What was done

| Task | Status |
|------|--------|
| Flight profile physics (altitude, velocity, pressure, GPS, sensors) | Done |
| ~180-second simulation: Pad → Powered → Unpowered → Apogee → PrimaryChute → SecondaryChute | Done |
| GPS coordinate drift from configurable launch site (default: Aksaray) | Done |
| Barometric pressure via ISA formula (inverse altitude correlation) | Done |
| Scientific sensor: sinusoidal + deterministic noise | Done |
| `MockGenerator` with tick-based emission (5 Hz payload, 1 Hz rocket) | Done |
| `MockState` with atomic start/stop/reset/elapsed controls | Done |
| `MockPacket` enum (Rocket / Payload) wrapping raw `Vec<u8>` | Done |
| All generated packets have valid checksums and are fully parseable | Done |
| 35 new unit tests (80 total across protocol + mock) | Done |

### Test Results

| Runner | Tests | Passed | Failed |
|--------|:-----:|:------:|:------:|
| cargo test (unit) | 80 | 80 | 0 |
| cargo test (doc) | 1 | 1 | 0 |

### Test Coverage

| Category | Tests |
|----------|:-----:|
| Flight state timeline progression | 2 |
| Altitude physics (pad, powered, unpowered, apogee, descent, non-negative) | 6 |
| Velocity profiles (pad, powered, unpowered, apogee, descent) | 5 |
| Barometric pressure (sea level, altitude correlation, realistic) | 3 |
| GPS (launch site, drift) | 2 |
| Scientific sensor range | 1 |
| Rocket packet generation + checksum + parachute flags | 2 |
| Payload packet generation + coordinate offset | 2 |
| Tick-based emission rates (1 Hz / 5 Hz) | 5 |
| MockState atomics | 5 |
| Full 180s flight simulation end-to-end | 1 |
| Previous Phase 1 tests (protocol) | 46 |

### Files Created

```
Backend (src-tauri/src/mock/):
  mod.rs              — Module declarations
  flight_profile.rs   — Physics simulation (altitude, velocity, pressure, GPS, sensors)
  generator.rs        — MockGenerator + MockState + MockPacket
  tests.rs            — 35 mock-specific tests

Modified:
  src-tauri/src/lib.rs — Added `pub mod mock;`
```

### Key Decisions

- **Tick-based generation** — 5 Hz base tick (200ms), payload every tick, rocket every 5th tick
- **Deterministic noise** — scientific sensor uses timestamp bits instead of RNG for reproducible tests
- **ISA barometric formula** — real atmospheric model ensuring pressure/altitude correlation is realistic
- **Default launch site: Aksaray, Turkey** (38.3687°N, 34.0370°E) — typical TEKNOFEST launch area
- **`MockPacket` enum** — unified type for both packet kinds, ready for async channel emission in Phase 4
- **Atomic `MockState`** — thread-safe controls that will be wrapped as Tauri managed state

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
