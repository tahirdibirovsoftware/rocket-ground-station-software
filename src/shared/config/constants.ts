/**
 * AZST Ground Station — Application Constants
 */

/** Default serial baud rate */
export const DEFAULT_BAUD_RATE = 115200;

/** Tauri IPC event names */
export const IPC_EVENTS = {
  ROCKET_TELEMETRY: "rocket-telemetry",
  PAYLOAD_TELEMETRY: "payload-telemetry",
  DRONE_TELEMETRY: "drone-telemetry",
  CONNECTION_STATUS: "connection-status",
} as const;

/** Tauri command names */
export const IPC_COMMANDS = {
  CONNECT_RFD: "connect_rfd",
  DISCONNECT_RFD: "disconnect_rfd",
  SET_DRONE_ENGINE: "set_drone_engine",
  LIST_SERIAL_PORTS: "list_serial_ports",
  START_MOCK: "start_mock",
  STOP_MOCK: "stop_mock",
  RESET_MOCK: "reset_mock",
  GET_CONNECTION_STATUS: "get_connection_status",
  LIST_CAMERAS: "list_cameras",
  START_CAMERA: "start_camera",
  STOP_CAMERA: "stop_camera",
  LIST_FLIGHT_ARTIFACTS: "list_flight_artifacts",
  OPEN_ARTIFACT_FOLDER: "open_artifact_folder",
  DELETE_ARTIFACT_FOLDER: "delete_artifact_folder",
  OPEN_ARTIFACT_FILE: "open_artifact_file",
} as const;

/** Telemetry history buffer sizes */
export const HISTORY_LIMITS = {
  /** 10 minutes of rocket data at ~1 Hz */
  ROCKET_BUFFER_SIZE: 600,
  /** 10 minutes of payload data at ~5 Hz */
  PAYLOAD_BUFFER_SIZE: 3000,
  /** 10 minutes of drone data at ~5 Hz */
  DRONE_BUFFER_SIZE: 3000,
} as const;

/** Route paths */
export const ROUTES = {
  ROOT: "/",
  TEAM_DASHBOARD: "/dashboard/team",
  REFEREE_DASHBOARD: "/dashboard/referee",
  FLIGHT_ARTIFACTS: "/artifacts",
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
  DRONE_TELEMETRY: 0xcc,
} as const;
