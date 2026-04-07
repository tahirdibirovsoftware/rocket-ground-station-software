/**
 * AZST Ground Station — Application Constants
 */

/** Default serial baud rate */
export const DEFAULT_BAUD_RATE = 115200;

/** Tauri IPC event names */
export const IPC_EVENTS = {
  ROCKET_TELEMETRY: "rocket-telemetry",
  PAYLOAD_TELEMETRY: "payload-telemetry",
  CONNECTION_STATUS: "connection-status",
} as const;

/** Tauri command names */
export const IPC_COMMANDS = {
  CONNECT_SERIAL: "connect_serial",
  DISCONNECT_SERIAL: "disconnect_serial",
  LIST_SERIAL_PORTS: "list_serial_ports",
  START_MOCK: "start_mock",
  STOP_MOCK: "stop_mock",
  RESET_MOCK: "reset_mock",
  GET_CONNECTION_STATUS: "get_connection_status",
} as const;

/** Telemetry history buffer sizes */
export const HISTORY_LIMITS = {
  /** 10 minutes of rocket data at ~1 Hz */
  ROCKET_BUFFER_SIZE: 600,
  /** 10 minutes of payload data at ~5 Hz */
  PAYLOAD_BUFFER_SIZE: 3000,
} as const;

/** Route paths */
export const ROUTES = {
  ROOT: "/",
  TEAM_DASHBOARD: "/dashboard/team",
  REFEREE_DASHBOARD: "/dashboard/referee",
} as const;

/** Supported locales */
export const SUPPORTED_LOCALES = ["en", "az", "tr", "ru"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Default locale */
export const DEFAULT_LOCALE: SupportedLocale = "en";

/** Start bytes for packet identification */
export const PACKET_START_BYTES = {
  ROCKET_AVIONICS: 0xaa,
  PAYLOAD_SCIENTIFIC: 0xbb,
} as const;
