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

## Phase 3 — Serial Port Reader & CSV Logger ✓

**Completed:** 2026-04-08
**Commit:** `73816b1`

### What was done

| Task | Status |
|------|--------|
| `FrameParser` state machine (scan → accumulate → validate → emit) | Done |
| Byte-level framing: scan for `0xAA`/`0xBB`, accumulate N bytes, checksum validate | Done |
| Handles partial reads, stream corruption, garbage bytes, re-synchronization | Done |
| `ReaderStats` tracking (packets, checksum failures, framing errors, bytes) | Done |
| `SerialPortConfig` with builder pattern (path, baud rate, timeout) | Done |
| Port enumeration via `serialport::available_ports()` with USB metadata | Done |
| `open_serial_port()` function for real hardware connections | Done |
| `CsvLogger` with lazy file creation and auto-generated headers | Done |
| Session-timestamped filenames (`rocket_avionics_YYYYMMDD_HHMMSS.csv`) | Done |
| Flush-after-every-write for crash safety | Done |
| 30 new tests (110 total across all modules) | Done |

### Test Results

| Runner | Tests | Passed | Failed |
|--------|:-----:|:------:|:------:|
| cargo test (unit) | 110 | 110 | 0 |
| cargo test (doc) | 1 | 1 | 0 |

### Test Coverage

| Category | Tests |
|----------|:-----:|
| FrameParser: single/multi/interleaved packets | 4 |
| FrameParser: partial reads (split, byte-by-byte) | 2 |
| FrameParser: garbage/corruption handling | 5 |
| FrameParser: reset behavior | 2 |
| SerialPortConfig: defaults, builder, serialization | 3 |
| Port enumeration safety | 1 |
| PortInfo serialization | 1 |
| Integration: mock → FrameParser round-trip | 1 |
| CsvLogger: single/multi writes (100 packets each) | 4 |
| CsvLogger: header verification (rocket + payload) | 2 |
| CsvLogger: file naming, directory creation | 2 |
| CsvLogger: data integrity read-back | 1 |
| Integration: mock → parser → CSV pipeline | 1 |
| Previous tests (protocol + mock) | 81 |

### Files Created

```
Backend (src-tauri/src/serial/):
  mod.rs    — Module declarations
  config.rs — SerialPortConfig + PortInfo + list_available_ports()
  reader.rs — FrameParser state machine + ParsedPacket + ReaderStats
  tests.rs  — 17 serial tests + 1 integration test

Backend (src-tauri/src/logger/):
  mod.rs        — Module declarations
  csv_writer.rs — CsvLogger with lazy init, headers, flush-per-write
  tests.rs      — 11 logger tests + 1 pipeline integration test

Modified:
  src-tauri/Cargo.toml — Added serialport, csv dependencies
  src-tauri/src/lib.rs — Added `pub mod serial; pub mod logger;`
```

### Key Decisions

- **State machine `FrameParser`** over stream-level parsing — fully testable without real serial ports
- **Separate `FrameParser` from async I/O** — the parser works on any `&[u8]`, async wrapping happens in Phase 4
- **Lazy CSV writers** — files are only created on first packet write, not at logger construction
- **Flush-after-every-write** — trades throughput for crash safety (mission-critical data)
- **`serialport` crate directly** — better Linux support and port enumeration than tokio-serial wrapper

---

## Phase 4 — Tauri IPC Bridge ✓

**Completed:** 2026-04-08
**Commit:** `7951783`

### What was done

| Task | Status |
|------|--------|
| `AppState` managed state (mock, parser, logger, connection status, cancel token) | Done |
| `ConnectionStatus` + `ConnectionMode` with Serde JSON serialization | Done |
| 7 Tauri commands: `list_serial_ports`, `connect_serial`, `disconnect_serial`, `start_mock`, `stop_mock`, `reset_mock`, `get_connection_status` | Done |
| 3 Tauri events: `rocket-telemetry`, `payload-telemetry`, `connection-status` | Done |
| `start_mock` spawns async 5 Hz tick loop with event emission | Done |
| Commands wired into `lib.rs` via `generate_handler![]` | Done |
| Frontend hooks: `useTauriEvent<T>`, `useRocketTelemetry`, `usePayloadTelemetry`, `useConnectionStatus` | Done |
| Event names match frontend `IPC_EVENTS` constants (verified by test) | Done |
| 10 new Rust tests (120 total) + 6 Vitest tests | Done |

### Test Results

| Runner | Tests | Passed | Failed |
|--------|:-----:|:------:|:------:|
| cargo test (unit) | 120 | 120 | 0 |
| cargo test (doc) | 1 | 1 | 0 |
| Vitest | 6 | 6 | 0 |
| Compiler warnings | 0 | - | 0 |

### Test Coverage

| Category | Tests |
|----------|:-----:|
| ConnectionMode serialization/deserialization | 2 |
| ConnectionStatus defaults, serialization, null handling | 3 |
| AppState initialization, stats sync, mock controls | 3 |
| Event name constants (match frontend) | 1 |
| Cancel token cross-thread | 1 |
| Previous tests (protocol + mock + serial + logger) | 111 |

### Files Created

```
Backend (src-tauri/src/ipc/):
  mod.rs      — Module declarations
  state.rs    — AppState, ConnectionStatus, ConnectionMode
  events.rs   — emit_rocket_telemetry, emit_payload_telemetry, emit_connection_status
  commands.rs — 7 Tauri command handlers
  tests.rs    — 10 IPC tests

Frontend (src/shared/hooks/):
  index.ts                — Barrel export
  useTauriEvent.ts        — Generic Tauri event listener hook
  useRocketTelemetry.ts   — Typed rocket telemetry hook
  usePayloadTelemetry.ts  — Typed payload telemetry hook
  useConnectionStatus.ts  — Typed connection status hook

Modified:
  src-tauri/src/lib.rs — Added `pub mod ipc;`, wired all commands + AppState
```

### Key Decisions

- **`useRef` for handlers** — avoids stale closures in event listeners without re-subscribing
- **`AppState` with `Mutex`** — Tauri's state system requires `Send + Sync`, Mutex provides interior mutability
- **Async mock loop via `tauri::async_runtime::spawn`** — uses tokio under the hood, clean cancellation via AtomicBool
- **Event names as constants** — defined in both Rust (`events.rs`) and TypeScript (`constants.ts`), verified by test
- **`ConnectionMode` enum** — `disconnected | serial | mock` — serialized as snake_case strings matching frontend expectations

---

## Phase 5 — Redux Store & Data Layer ✓

**Completed:** 2026-04-09
**Commit:** `0d30061`

### What was done

| Task | Status |
|------|--------|
| `CircularBuffer<T>` — O(1) ring buffer with push, toArray, latest, clear | Done |
| `mapRocketPacket` / `mapPayloadPacket` — Rust snake_case → TS camelCase mappers | Done |
| `rocketTelemetrySlice` — latest + history (600 cap) + packetCount | Done |
| `payloadTelemetrySlice` — latest + history (3000 cap) + packetCount | Done |
| `connectionSlice` — mode, ports, stats, loading, error | Done |
| Memoized selectors (`createSelector`) per widget: GPS, altitude, velocity, pressure, scientific | Done |
| `store.ts` with `configureStore` + typed hooks (`useAppDispatch`, `useAppSelector`) | Done |
| Redux Provider wired into `App.tsx` | Done |
| 26 new Vitest tests (32 total frontend) | Done |

### Test Results

| Runner | Tests | Passed | Failed |
|--------|:-----:|:------:|:------:|
| Vitest | 32 | 32 | 0 |
| cargo test | 121 | 121 | 0 |

### Files Created

```
Shared (src/shared/lib/):
  CircularBuffer.ts  — Generic ring buffer
  mappers.ts         — Rust → TS packet mappers
  index.ts           — Barrel export
  store.test.ts      — 26 tests

Entities (src/entities/):
  rocket-packet/index.ts
  rocket-packet/model/rocketTelemetrySlice.ts
  rocket-packet/model/selectors.ts
  payload-packet/index.ts
  payload-packet/model/payloadTelemetrySlice.ts
  payload-packet/model/selectors.ts
  connection/index.ts
  connection/model/connectionSlice.ts
  connection/model/selectors.ts

App (src/app/):
  store.ts — configureStore + typed hooks

Modified:
  src/app/App.tsx — Added Redux Provider
```

### Key Decisions

- **Array-based history** in Redux (not CircularBuffer) — Immer needs plain arrays for immutable updates; CircularBuffer is available for non-Redux use
- **`serializableCheck: false`** — disabled for 5 Hz dispatch performance (avoids middleware overhead)
- **Mappers separate from slices** — keep deserialization logic in shared/lib, slices receive clean data
- **`createSelector` per widget** — each widget (chart, GPS, summary) gets exactly the data it needs, preventing unnecessary re-renders

---

## Phase 6 — Shared UI Foundation ✓

**Completed:** 2026-04-13
**Commit:** `5f7dd70`

### What was done

| Task | Status |
|------|--------|
| `StatusIndicator` — pulsing dot with 5 variants, auto-pulse, configurable size | Done |
| `PanelContainer` — dark bordered panel with header, icon, glow, headerRight | Done |
| `TelemetryValue` — labelled mono-spaced readout with 4 size variants | Done |
| `FlightStateBadge` — color-coded pill badge for all 6 flight states (i18n) | Done |
| `DataRow` — compact key-value row with mono font, bottom border | Done |
| `DashboardLayout` — app shell: top status bar + collapsible sidebar + Outlet | Done |
| Layout wired into AppRoutes via React Router nested routes | Done |
| Page stubs updated to use PanelContainer within layout | Done |
| 26 new Vitest tests (58 total frontend) | Done |

### Test Results

| Runner | Tests | Passed | Failed |
|--------|:-----:|:------:|:------:|
| Vitest | 58 | 58 | 0 |
| cargo test | 121 | 121 | 0 |

### Files Created

```
Shared UI (src/shared/ui/):
  index.ts            — Barrel export
  StatusIndicator.tsx  — Pulsing status dot
  PanelContainer.tsx   — Dark bordered panel
  TelemetryValue.tsx   — Labelled data readout
  FlightStateBadge.tsx — Flight phase pill badge
  DataRow.tsx          — Key-value table row
  DashboardLayout.tsx  — App shell (top bar + sidebar + Outlet)
  ui.test.tsx          — 26 component tests

Modified:
  src/app/routes/AppRoutes.tsx             — Layout route wrapping
  src/pages/team-dashboard/TeamDashboardPage.tsx     — Uses PanelContainer
  src/pages/referee-dashboard/RefereeDashboardPage.tsx — Uses PanelContainer
```

### Key Decisions

- **React.memo on all components** — prevents re-renders from parent telemetry updates
- **Inline styles (not Tailwind classes)** — components use CSS variables from the design system for consistent theming
- **Lucide icons only** — no text emojis anywhere (Radio, Activity, Gauge, ChevronLeft/Right)
- **NavLink active state** — highlights current route with nominal green border
- **Collapsible sidebar** — saves screen real estate for telemetry widgets
- **Clock in top bar** — mission elapsed time reference, updates every second

---

## Phase 7 — Team Dashboard ✓

**Completed:** 2026-04-13
**Commit:** `93be99a`

### What was done

| Task | Status |
|------|--------|
| `ConnectionPanel` — serial port inputs, baud rate, connect/disconnect, mock controls | Done |
| `AvionicsSummary` — flight state badge, altitude/velocity/pressure grid, GPS, parachutes | Done |
| `PayloadSummary` — payload altitude, scientific data, GPS coordinates | Done |
| `SystemHealth` — connection mode, packet counts, checksum failures, uptime | Done |
| `FlightTimeline` — horizontal 6-phase progression bar with glow on current | Done |
| `TelemetryBridge` — invisible component bridging Tauri events to Redux | Done |
| `DashboardLayout` — reads connection mode from Redux, embeds TelemetryBridge | Done |
| `TeamDashboardPage` — full 3-column layout with all widgets | Done |

### Files Created

```
Widgets (src/widgets/):
  connection-panel/    — ConnectionPanel.tsx + index.ts
  avionics-summary/    — AvionicsSummary.tsx + index.ts
  payload-summary/     — PayloadSummary.tsx + index.ts
  system-health/       — SystemHealth.tsx + index.ts
  flight-timeline/     — FlightTimeline.tsx + index.ts

Features (src/features/):
  telemetry-bridge/    — TelemetryBridge.tsx + index.ts

Modified:
  src/shared/ui/DashboardLayout.tsx — Reads Redux, embeds TelemetryBridge
  src/pages/team-dashboard/TeamDashboardPage.tsx — Full widget composition
```

### Key Decisions

- **TelemetryBridge pattern** — single invisible component at layout level handles all Tauri-to-Redux dispatching
- **ConnectionPanel invokes IPC** — buttons directly call `invoke()` with typed command names
- **AvionicsSummary green glow** — panel glows green when chute deployed (visual alert)
- **FlightTimeline transitions** — 300ms CSS transitions for smooth state changes
- **3-column grid** — Avionics | Payload | Connection+Health for optimal screen density

---

## Phase 8 — Referee Dashboard ✓

**Completed:** 2026-04-13
**Commit:** `db219ca`

### What was done

| Task | Status |
|------|--------|
| `FlightStateHero` — 2.5rem flight state with text glow, XL altitude/velocity, chute alert | Done |
| `DualGpsPanel` — side-by-side rocket (red) vs payload (blue) GPS with divider | Done |
| `ScientificDataPanel` — XL sensor value + canvas sparkline (last 100 points) | Done |
| `RefereeDashboardPage` — 2x2 quadrant grid, no debug info, max 6 fields visible | Done |
| Map placeholder for Phase 9 | Done |

### Files Created

```
Widgets (src/widgets/):
  flight-state-hero/      — FlightStateHero.tsx + index.ts
  dual-gps-panel/         — DualGpsPanel.tsx + index.ts
  scientific-data-panel/  — ScientificDataPanel.tsx + index.ts

Modified:
  src/pages/referee-dashboard/RefereeDashboardPage.tsx — Full 2x2 grid
```

### Key Decisions

- **2.5rem + textShadow** — flight state label visible from 3+ meters
- **Pulsing deployment alert** — green bordered banner with pulse animation on chute deploy
- **Canvas sparkline** — 100-point gradient-filled chart renders at 5 Hz without DOM mutations
- **Rocket=red, Payload=blue** — consistent color coding across all panels
- **No debug info** — zero packet counts, timestamps, or hex on the referee view

---

## Phase 9 — Offline Map & Canvas Charting ✓

**Completed:** 2026-04-13
**Commit:** `1abe3a4`

### What was done

| Task | Status |
|------|--------|
| `TelemetryMap` — Leaflet map with offline tile support + OSM fallback | Done |
| Rocket marker (red DivIcon) + dashed descent trail polyline | Done |
| Payload marker (blue DivIcon) + dashed descent trail polyline | Done |
| Auto-center on rocket GPS (first center, then smooth pan) | Done |
| `TelemetryChart` — Canvas-based time-series with 60s rolling window | Done |
| Auto-scaling Y axis, gradient fill, grid lines, axis labels | Done |
| DPR-aware canvas rendering, resize handler | Done |
| Team Dashboard: 3 charts (altitude/velocity/pressure) + map | Done |
| Referee Dashboard: map placeholder replaced with TelemetryMap | Done |

### Files Created

```
Widgets (src/widgets/):
  map/TelemetryMap.tsx      — Leaflet map with markers + trails
  map/index.ts
  charts/TelemetryChart.tsx — Canvas time-series chart
  charts/index.ts

Modified:
  src/pages/team-dashboard/TeamDashboardPage.tsx     — Added 3 charts + map
  src/pages/referee-dashboard/RefereeDashboardPage.tsx — Replaced placeholder with map
```

### Key Decisions

- **Offline-first tiles** — `url="/tiles/{z}/{x}/{y}.png"` with `errorTileUrl` fallback to OSM for dev
- **DivIcon markers** — custom colored dots (red=rocket, blue=payload) with CSS box-shadow glow
- **Last 200 trail points** — polyline trimmed for performance at high packet rates
- **Canvas chart, not DOM** — 60s rolling window rendered entirely on canvas (no SVG/DOM mutations)
- **DPR scaling** — canvas size doubled on Retina displays for crisp rendering

---

## Phase 10 — i18n, Responsiveness & Final Polish

**Status:** Not started
