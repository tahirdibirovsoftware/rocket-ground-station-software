/**
 * Tests for Phase 6 — Shared UI Foundation
 *
 * Covers:
 * - StatusIndicator: rendering, variants, pulse behavior
 * - PanelContainer: title, icon, glow, header right, children
 * - TelemetryValue: label, value, unit, sizes
 * - FlightStateBadge: all 6 states render with correct labels
 * - DataRow: label, value, mono class
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@shared/i18n";
import { FlightState } from "@shared/types";

import {
  StatusIndicator,
  PanelContainer,
  TelemetryValue,
  FlightStateBadge,
  DataRow,
} from "@shared/ui";

// Wrapper with i18n provider
function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

// ============================================================================
// StatusIndicator
// ============================================================================

describe("StatusIndicator", () => {
  it("renders without crashing", () => {
    const { container } = render(<StatusIndicator variant="nominal" />);
    expect(container.querySelector(".status-indicator")).toBeTruthy();
  });

  it("renders label when provided", () => {
    render(<StatusIndicator variant="nominal" label="ONLINE" />);
    expect(screen.getByText("ONLINE")).toBeTruthy();
  });

  it("applies pulse animation for critical variant", () => {
    const { container } = render(<StatusIndicator variant="critical" />);
    const dot = container.querySelector(".animate-pulse-critical");
    expect(dot).toBeTruthy();
  });

  it("applies pulse animation for nominal variant", () => {
    const { container } = render(<StatusIndicator variant="nominal" />);
    const dot = container.querySelector(".animate-pulse-nominal");
    expect(dot).toBeTruthy();
  });

  it("does not pulse when explicitly disabled", () => {
    const { container } = render(
      <StatusIndicator variant="nominal" pulse={false} />,
    );
    const dot = container.querySelector(".animate-pulse-nominal");
    expect(dot).toBeNull();
  });
});

// ============================================================================
// PanelContainer
// ============================================================================

describe("PanelContainer", () => {
  it("renders children", () => {
    render(
      <PanelContainer>
        <span>test content</span>
      </PanelContainer>,
    );
    expect(screen.getByText("test content")).toBeTruthy();
  });

  it("renders title in header", () => {
    render(
      <PanelContainer title="TELEMETRY">
        <span>data</span>
      </PanelContainer>,
    );
    expect(screen.getByText("TELEMETRY")).toBeTruthy();
  });

  it("renders headerRight content", () => {
    render(
      <PanelContainer title="TEST" headerRight={<span>controls</span>}>
        <span>body</span>
      </PanelContainer>,
    );
    expect(screen.getByText("controls")).toBeTruthy();
  });

  it("applies green glow class", () => {
    const { container } = render(
      <PanelContainer glow="green">
        <span>data</span>
      </PanelContainer>,
    );
    expect(container.querySelector(".panel-glow-green")).toBeTruthy();
  });

  it("applies red glow class", () => {
    const { container } = render(
      <PanelContainer glow="red">
        <span>data</span>
      </PanelContainer>,
    );
    expect(container.querySelector(".panel-glow-red")).toBeTruthy();
  });

  it("accepts id prop", () => {
    const { container } = render(
      <PanelContainer id="test-panel">
        <span>data</span>
      </PanelContainer>,
    );
    expect(container.querySelector("#test-panel")).toBeTruthy();
  });
});

// ============================================================================
// TelemetryValue
// ============================================================================

describe("TelemetryValue", () => {
  it("renders label and value", () => {
    render(<TelemetryValue label="Altitude" value="1500.00" />);
    expect(screen.getByText("Altitude")).toBeTruthy();
    expect(screen.getByText("1500.00")).toBeTruthy();
  });

  it("renders unit suffix", () => {
    render(<TelemetryValue label="Velocity" value="-15.2" unit="m/s" />);
    expect(screen.getByText("m/s")).toBeTruthy();
  });

  it("renders numeric value", () => {
    render(<TelemetryValue label="Pressure" value={1013.25} unit="hPa" />);
    expect(screen.getByText("1013.25")).toBeTruthy();
  });

  it("applies mono font class to value", () => {
    const { container } = render(
      <TelemetryValue label="Alt" value="500" id="tv-test" />,
    );
    const mono = container.querySelector(".font-telemetry");
    expect(mono).toBeTruthy();
  });
});

// ============================================================================
// FlightStateBadge
// ============================================================================

describe("FlightStateBadge", () => {
  const states = [
    { state: FlightState.Pad, key: "Pad" },
    { state: FlightState.Powered, key: "Powered Flight" },
    { state: FlightState.Unpowered, key: "Unpowered Flight" },
    { state: FlightState.Apogee, key: "Apogee" },
    { state: FlightState.PrimaryChute, key: "Primary Chute" },
    { state: FlightState.SecondaryChute, key: "Secondary Chute" },
  ];

  states.forEach(({ state, key }) => {
    it(`renders FlightState ${FlightState[state]} with label "${key}"`, () => {
      renderWithI18n(<FlightStateBadge state={state} />);
      expect(screen.getByText(key)).toBeTruthy();
    });
  });

  it("applies id prop", () => {
    const { container } = renderWithI18n(
      <FlightStateBadge state={FlightState.Apogee} id="fsb-test" />,
    );
    expect(container.querySelector("#fsb-test")).toBeTruthy();
  });
});

// ============================================================================
// DataRow
// ============================================================================

describe("DataRow", () => {
  it("renders label and value", () => {
    render(<DataRow label="Packets" value="42" />);
    expect(screen.getByText("Packets")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("applies mono class by default", () => {
    const { container } = render(<DataRow label="Test" value="123" />);
    const mono = container.querySelector(".font-telemetry");
    expect(mono).toBeTruthy();
  });

  it("does not apply mono class when disabled", () => {
    const { container } = render(
      <DataRow label="Test" value="abc" mono={false} />,
    );
    const row = container.querySelector(".data-row");
    const mono = row?.querySelector(".font-telemetry");
    expect(mono).toBeNull();
  });

  it("renders React node as value", () => {
    render(
      <DataRow label="Status" value={<span data-testid="custom">OK</span>} />,
    );
    expect(screen.getByTestId("custom")).toBeTruthy();
  });
});
