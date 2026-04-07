/**
 * Commitlint Configuration
 *
 * Enforces Conventional Commits: https://www.conventionalcommits.org/
 *
 * Format:  <type>(scope): <subject>
 * Example: feat(protocol): add rocket avionics packet parser
 *
 * Allowed types:
 *   feat     — New feature
 *   fix      — Bug fix
 *   docs     — Documentation only
 *   style    — Formatting, no code change
 *   refactor — Code refactor, no feature/fix
 *   perf     — Performance improvement
 *   test     — Adding/updating tests
 *   build    — Build system or deps
 *   ci       — CI/CD configuration
 *   chore    — Maintenance tasks
 *   revert   — Revert a previous commit
 *
 * Allowed scopes (matching project modules):
 *   protocol, mock, serial, logger, ipc       — Rust backend
 *   store, ui, i18n, map, charts              — Frontend shared
 *   team-dashboard, referee-dashboard         — Pages
 *   connection, telemetry                     — Features
 *   config, deps, release                     — Project-level
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Type must be one of the allowed values
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    // Type is required and must be lowercase
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],

    // Scope is optional but must be lowercase if present
    "scope-case": [2, "always", "lower-case"],
    "scope-enum": [
      1, // warning (not error) — allows new scopes as project grows
      "always",
      [
        // Rust backend modules
        "protocol",
        "mock",
        "serial",
        "logger",
        "ipc",
        // Frontend layers
        "store",
        "ui",
        "i18n",
        "map",
        "charts",
        // Pages
        "team-dashboard",
        "referee-dashboard",
        // Features
        "connection",
        "telemetry",
        // Project-level
        "config",
        "deps",
        "release",
      ],
    ],

    // Subject rules
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "subject-empty": [2, "never"],
    "subject-max-length": [2, "always", 100],

    // Header (type + scope + subject combined)
    "header-max-length": [2, "always", 120],

    // Body rules
    "body-leading-blank": [2, "always"],
    "body-max-line-length": [2, "always", 200],

    // Footer rules
    "footer-leading-blank": [2, "always"],
    "footer-max-line-length": [2, "always", 200],
  },
};
