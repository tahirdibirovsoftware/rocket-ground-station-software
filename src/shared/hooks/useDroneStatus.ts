/**
 * useDroneStatus — Hook for receiving drone status events.
 *
 * Listens to the "drone-status" Tauri event (binary RF_PKT_STATUS) and
 * provides the drone flight-controller state, throttle, and arm state.
 */
import { IPC_EVENTS } from "@shared/config/constants";
import { useTauriEvent } from "./useTauriEvent";

export interface DroneStatus {
  /** 0 = DISARMED, 1 = ARMED_WAIT, 2 = MOTORS_ON, 3 = MOTORS_HOLD, 4 = TOUCHDOWN. */
  state_code: number;
  /** ESC throttle pulse width (µs). */
  throttle_us: number;
  /** RF arm state. */
  armed: boolean;
  /** Firmware flight phase (0 = PRE_LAUNCH, 1 = IN_AIR, 2 = ON_GROUND). */
  flight_phase?: number;
  /** Firmware actuator state (true = active / ESC/Buzzer firing, false = cutoff on motion). */
  outputs_active?: boolean;
}

export function useDroneStatus(
  onStatus: (status: DroneStatus) => void,
) {
  useTauriEvent<DroneStatus>(IPC_EVENTS.DRONE_STATUS, onStatus);
}
