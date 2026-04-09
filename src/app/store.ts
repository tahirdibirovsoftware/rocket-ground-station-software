/**
 * Redux Store — Central state management for AZST Ground Station.
 *
 * Combines all entity slices and exports typed hooks for use in components.
 */
import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";

import rocketTelemetryReducer from "@entities/rocket-packet/model/rocketTelemetrySlice";
import payloadTelemetryReducer from "@entities/payload-packet/model/payloadTelemetrySlice";
import connectionReducer from "@entities/connection/model/connectionSlice";

export const store = configureStore({
  reducer: {
    rocketTelemetry: rocketTelemetryReducer,
    payloadTelemetry: payloadTelemetryReducer,
    connection: connectionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Disable serializable check for high-frequency telemetry
      // (performance optimization — avoids overhead on every 5 Hz dispatch)
      serializableCheck: false,
    }),
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/** Typed dispatch hook. */
export const useAppDispatch: () => AppDispatch = useDispatch;

/** Typed selector hook. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
