//! Tests for the mock data generator module.
//!
//! Covers:
//! - Flight profile physics (altitude, velocity, pressure, GPS)
//! - Flight state transitions across the full timeline
//! - Packet generation and checksum validity
//! - MockGenerator tick-based emission rates
//! - MockState atomic controls
//! - Edge cases (boundaries, flight end)

use crate::protocol::checksum::validate_checksum;
use crate::protocol::rocket_packet::{
    parse_rocket_packet, FlightState, ROCKET_PACKET_SIZE, ROCKET_START_BYTE,
};
use crate::protocol::payload_packet::{
    parse_payload_packet, PAYLOAD_PACKET_SIZE, PAYLOAD_START_BYTE,
};

use super::flight_profile::*;
use super::generator::*;

// ============================================================================
// Flight State Transition Tests
// ============================================================================

#[test]
fn flight_state_timeline_progression() {
    let timings = PhaseTimings::default();

    assert_eq!(flight_state_at(0.0, &timings), FlightState::Pad);
    assert_eq!(flight_state_at(1.0, &timings), FlightState::Pad);
    assert_eq!(flight_state_at(2.9, &timings), FlightState::Pad);
    assert_eq!(flight_state_at(3.0, &timings), FlightState::Powered);
    assert_eq!(flight_state_at(10.0, &timings), FlightState::Powered);
    assert_eq!(flight_state_at(14.9, &timings), FlightState::Powered);
    assert_eq!(flight_state_at(15.0, &timings), FlightState::Unpowered);
    assert_eq!(flight_state_at(25.0, &timings), FlightState::Unpowered);
    assert_eq!(flight_state_at(30.0, &timings), FlightState::Apogee);
    assert_eq!(flight_state_at(31.0, &timings), FlightState::Apogee);
    assert_eq!(flight_state_at(32.0, &timings), FlightState::PrimaryChute);
    assert_eq!(flight_state_at(80.0, &timings), FlightState::PrimaryChute);
    assert_eq!(flight_state_at(120.0, &timings), FlightState::SecondaryChute);
    assert_eq!(flight_state_at(150.0, &timings), FlightState::SecondaryChute);
    assert_eq!(flight_state_at(180.0, &timings), FlightState::SecondaryChute);
}

#[test]
fn flight_state_covers_all_six_states() {
    let timings = PhaseTimings::default();
    let test_times = [0.0, 5.0, 20.0, 31.0, 50.0, 130.0];
    let expected = [
        FlightState::Pad,
        FlightState::Powered,
        FlightState::Unpowered,
        FlightState::Apogee,
        FlightState::PrimaryChute,
        FlightState::SecondaryChute,
    ];

    for (t, exp) in test_times.iter().zip(expected.iter()) {
        assert_eq!(flight_state_at(*t, &timings), *exp, "at t={t}s");
    }
}

// ============================================================================
// Altitude Tests
// ============================================================================

#[test]
fn altitude_zero_on_pad() {
    let timings = PhaseTimings::default();
    assert_eq!(altitude_at(0.0, &timings), 0.0);
    assert_eq!(altitude_at(2.0, &timings), 0.0);
}

#[test]
fn altitude_increases_during_powered_flight() {
    let timings = PhaseTimings::default();
    let a1 = altitude_at(5.0, &timings);
    let a2 = altitude_at(10.0, &timings);
    let a3 = altitude_at(14.0, &timings);
    assert!(a1 > 0.0, "altitude should be positive during powered flight");
    assert!(a2 > a1, "altitude should increase during powered flight");
    assert!(a3 > a2, "altitude should keep increasing");
}

#[test]
fn altitude_continues_rising_during_unpowered() {
    let timings = PhaseTimings::default();
    let at_burnout = altitude_at(15.0, &timings);
    let mid_coast = altitude_at(22.0, &timings);
    let near_apogee = altitude_at(29.0, &timings);
    assert!(mid_coast > at_burnout, "should still be rising after burnout");
    assert!(near_apogee > mid_coast, "should approach apogee");
}

#[test]
fn altitude_peaks_at_apogee() {
    let timings = PhaseTimings::default();
    let at_apogee = altitude_at(31.0, &timings);
    assert!(
        (at_apogee - 3000.0).abs() < 1.0,
        "apogee altitude should be ~3000m, got {at_apogee}"
    );
}

#[test]
fn altitude_decreases_during_descent() {
    let timings = PhaseTimings::default();
    let at_apogee = altitude_at(31.0, &timings);
    let mid_descent = altitude_at(70.0, &timings);
    let late_descent = altitude_at(150.0, &timings);
    assert!(mid_descent < at_apogee, "should descend after apogee");
    assert!(late_descent < mid_descent, "should keep descending");
}

#[test]
fn altitude_never_negative() {
    let timings = PhaseTimings::default();
    for t_tenths in 0..=1800 {
        let t = t_tenths as f32 * 0.1;
        let alt = altitude_at(t, &timings);
        assert!(alt >= 0.0, "altitude should never be negative at t={t}s, got {alt}");
    }
}

// ============================================================================
// Velocity Tests
// ============================================================================

#[test]
fn velocity_zero_on_pad() {
    let timings = PhaseTimings::default();
    assert_eq!(velocity_at(0.0, &timings), 0.0);
}

#[test]
fn velocity_increases_during_powered() {
    let timings = PhaseTimings::default();
    let v1 = velocity_at(5.0, &timings);
    let v2 = velocity_at(10.0, &timings);
    assert!(v1 > 0.0);
    assert!(v2 > v1);
}

#[test]
fn velocity_decreases_during_unpowered() {
    let timings = PhaseTimings::default();
    let v_burnout = velocity_at(15.0, &timings);
    let v_mid = velocity_at(22.0, &timings);
    assert!(v_mid < v_burnout, "should decelerate after burnout");
    assert!(v_mid > 0.0, "should still be positive before apogee");
}

#[test]
fn velocity_zero_at_apogee() {
    let timings = PhaseTimings::default();
    let v = velocity_at(31.0, &timings);
    assert_eq!(v, 0.0);
}

#[test]
fn velocity_negative_during_descent() {
    let timings = PhaseTimings::default();
    let v_primary = velocity_at(50.0, &timings);
    let v_secondary = velocity_at(130.0, &timings);
    assert!(v_primary < 0.0, "descent velocity should be negative");
    assert!(v_secondary < 0.0, "descent velocity should be negative");
    assert!(
        v_secondary > v_primary,
        "secondary chute descent should be slower (less negative)"
    );
}

// ============================================================================
// Pressure Tests
// ============================================================================

#[test]
fn pressure_sea_level() {
    let p = pressure_from_altitude(0.0);
    assert!((p - 1013.25).abs() < 0.01);
}

#[test]
fn pressure_decreases_with_altitude() {
    let p0 = pressure_from_altitude(0.0);
    let p1000 = pressure_from_altitude(1000.0);
    let p3000 = pressure_from_altitude(3000.0);
    assert!(p1000 < p0);
    assert!(p3000 < p1000);
}

#[test]
fn pressure_realistic_at_3000m() {
    // ISA model: ~701 hPa at 3000m
    let p = pressure_from_altitude(3000.0);
    assert!(
        (p - 701.0).abs() < 10.0,
        "pressure at 3000m should be ~701 hPa, got {p}"
    );
}

// ============================================================================
// GPS Tests
// ============================================================================

#[test]
fn gps_starts_at_launch_site() {
    let (lat, lon) = gps_at(0.0, DEFAULT_LAUNCH_LAT, DEFAULT_LAUNCH_LON);
    assert_eq!(lat, DEFAULT_LAUNCH_LAT);
    assert_eq!(lon, DEFAULT_LAUNCH_LON);
}

#[test]
fn gps_drifts_over_time() {
    let (lat0, lon0) = gps_at(0.0, DEFAULT_LAUNCH_LAT, DEFAULT_LAUNCH_LON);
    let (lat60, lon60) = gps_at(60.0, DEFAULT_LAUNCH_LAT, DEFAULT_LAUNCH_LON);
    assert!(lat60 > lat0, "latitude should drift");
    assert!(lon60 > lon0, "longitude should drift");
}

// ============================================================================
// Scientific Sensor Tests
// ============================================================================

#[test]
fn scientific_sensor_reasonable_range() {
    for t_tenths in 0..=1800 {
        let t = t_tenths as f32 * 0.1;
        let ts = (t * 1000.0) as u32;
        let val = scientific_sensor_at(t, ts);
        assert!(
            val > 0.0 && val < 50.0,
            "scientific sensor should be in reasonable range at t={t}s, got {val}"
        );
    }
}

// ============================================================================
// Rocket Packet Generation Tests
// ============================================================================

#[test]
fn generated_rocket_packet_is_parseable() {
    let config = FlightProfileConfig::default();
    let gen = MockGenerator::with_defaults();

    for t_secs in 0..=180 {
        let t = t_secs as f32;
        if let Some(MockPacket::Rocket(bytes)) = gen.generate_rocket_bytes(t) {
            assert_eq!(bytes.len(), ROCKET_PACKET_SIZE);
            assert_eq!(bytes[0], ROCKET_START_BYTE);
            assert!(validate_checksum(&bytes), "checksum should be valid at t={t}s");

            let parsed = parse_rocket_packet(&bytes)
                .unwrap_or_else(|e| panic!("failed to parse rocket packet at t={t}s: {e}"));

            // Verify flight state matches profile
            let expected_state = flight_state_at(t, &config.timings);
            assert_eq!(
                parsed.flight_state, expected_state,
                "flight state mismatch at t={t}s"
            );
        }
    }
}

#[test]
fn generated_rocket_packet_parachute_flags() {
    let config = FlightProfileConfig::default();

    // Before apogee — no parachutes
    let pkt = generate_rocket_packet(10.0, &config);
    assert!(!pkt.primary_parachute_deployed);
    assert!(!pkt.secondary_parachute_deployed);

    // Primary chute phase
    let pkt = generate_rocket_packet(50.0, &config);
    assert!(pkt.primary_parachute_deployed);
    assert!(!pkt.secondary_parachute_deployed);

    // Secondary chute phase
    let pkt = generate_rocket_packet(130.0, &config);
    assert!(pkt.primary_parachute_deployed);
    assert!(pkt.secondary_parachute_deployed);
}

// ============================================================================
// Payload Packet Generation Tests
// ============================================================================

#[test]
fn generated_payload_packet_is_parseable() {
    let gen = MockGenerator::with_defaults();

    for t_tenths in (0..=1800).step_by(2) {
        let t = t_tenths as f32 * 0.1;
        if let Some(MockPacket::Payload(bytes)) = gen.generate_payload_bytes(t) {
            assert_eq!(bytes.len(), PAYLOAD_PACKET_SIZE);
            assert_eq!(bytes[0], PAYLOAD_START_BYTE);
            assert!(validate_checksum(&bytes), "checksum should be valid at t={t}s");

            parse_payload_packet(&bytes)
                .unwrap_or_else(|e| panic!("failed to parse payload packet at t={t}s: {e}"));
        }
    }
}

#[test]
fn payload_coordinates_offset_from_rocket() {
    let config = FlightProfileConfig::default();
    let rocket = generate_rocket_packet(50.0, &config);
    let payload = generate_payload_packet(50.0, &config);

    // Payload should be at a slightly different position
    assert_ne!(rocket.latitude, payload.latitude);
    assert_ne!(rocket.longitude, payload.longitude);
}

// ============================================================================
// MockGenerator Tick Tests
// ============================================================================

#[test]
fn tick_0_emits_both_packets() {
    let gen = MockGenerator::with_defaults();
    let packets = gen.generate_tick(0);
    // Tick 0 is a rocket tick (0 % 5 == 0) + payload
    assert_eq!(packets.len(), 2, "tick 0 should emit payload + rocket");

    let has_payload = packets.iter().any(|p| matches!(p, MockPacket::Payload(_)));
    let has_rocket = packets.iter().any(|p| matches!(p, MockPacket::Rocket(_)));
    assert!(has_payload);
    assert!(has_rocket);
}

#[test]
fn non_rocket_tick_emits_only_payload() {
    let gen = MockGenerator::with_defaults();

    for tick in [1, 2, 3, 4] {
        let packets = gen.generate_tick(tick);
        assert_eq!(
            packets.len(),
            1,
            "tick {tick} should emit only payload"
        );
        assert!(matches!(packets[0], MockPacket::Payload(_)));
    }
}

#[test]
fn tick_5_emits_both_packets_again() {
    let gen = MockGenerator::with_defaults();
    let packets = gen.generate_tick(5);
    assert_eq!(packets.len(), 2, "tick 5 should emit payload + rocket");
}

#[test]
fn one_second_is_five_ticks() {
    let gen = MockGenerator::with_defaults();
    let mut total_rocket = 0;
    let mut total_payload = 0;

    // 5 ticks = 1 second
    for tick in 0..5 {
        for pkt in gen.generate_tick(tick) {
            match pkt {
                MockPacket::Rocket(_) => total_rocket += 1,
                MockPacket::Payload(_) => total_payload += 1,
            }
        }
    }

    assert_eq!(total_rocket, 1, "should get 1 rocket packet per second");
    assert_eq!(total_payload, 5, "should get 5 payload packets per second");
}

#[test]
fn ten_seconds_packet_counts() {
    let gen = MockGenerator::with_defaults();
    let mut total_rocket = 0;
    let mut total_payload = 0;

    // 50 ticks = 10 seconds
    for tick in 0..50 {
        for pkt in gen.generate_tick(tick) {
            match pkt {
                MockPacket::Rocket(_) => total_rocket += 1,
                MockPacket::Payload(_) => total_payload += 1,
            }
        }
    }

    assert_eq!(total_rocket, 10, "10 rocket packets in 10 seconds");
    assert_eq!(total_payload, 50, "50 payload packets in 10 seconds");
}

#[test]
fn ticks_after_flight_end_return_empty() {
    let gen = MockGenerator::with_defaults();
    // flight_end = 180s => tick 900 = 180s, tick 905 = 181s
    let packets = gen.generate_tick(905);
    assert!(
        packets.is_empty(),
        "should return no packets after flight ends"
    );
}

// ============================================================================
// MockState Tests
// ============================================================================

#[test]
fn mock_state_initial_values() {
    let state = MockState::new();
    assert!(!state.is_running());
    assert_eq!(state.get_elapsed_ms(), 0);
}

#[test]
fn mock_state_start_stop() {
    let state = MockState::new();
    state.start();
    assert!(state.is_running());
    state.stop();
    assert!(!state.is_running());
}

#[test]
fn mock_state_reset() {
    let state = MockState::new();
    state.start();
    state.set_elapsed_ms(50000);
    assert!(state.is_running());
    assert_eq!(state.get_elapsed_ms(), 50000);

    state.reset();
    assert!(!state.is_running());
    assert_eq!(state.get_elapsed_ms(), 0);
}

#[test]
fn mock_state_elapsed_tracking() {
    let state = MockState::new();
    state.set_elapsed_ms(12345);
    assert_eq!(state.get_elapsed_ms(), 12345);
    state.set_elapsed_ms(99999);
    assert_eq!(state.get_elapsed_ms(), 99999);
}

#[test]
fn create_mock_state_returns_arc() {
    let state = create_mock_state();
    let state2 = state.clone();
    state.start();
    assert!(state2.is_running());
}

// ============================================================================
// End-to-End: Full Flight Simulation
// ============================================================================

#[test]
fn full_flight_simulation_all_packets_valid() {
    let gen = MockGenerator::with_defaults();

    // Simulate full 180-second flight at 5 Hz = 900 ticks
    let mut rocket_count = 0;
    let mut payload_count = 0;
    let mut last_rocket_state = FlightState::Pad;

    for tick in 0..900 {
        for pkt in gen.generate_tick(tick) {
            match pkt {
                MockPacket::Rocket(bytes) => {
                    assert!(validate_checksum(&bytes));
                    let parsed = parse_rocket_packet(&bytes).unwrap();
                    last_rocket_state = parsed.flight_state;
                    rocket_count += 1;
                }
                MockPacket::Payload(bytes) => {
                    assert!(validate_checksum(&bytes));
                    parse_payload_packet(&bytes).unwrap();
                    payload_count += 1;
                }
            }
        }
    }

    assert_eq!(rocket_count, 180, "should generate 180 rocket packets (1 Hz * 180s)");
    assert_eq!(payload_count, 900, "should generate 900 payload packets (5 Hz * 180s)");

    // Verify we reached the final flight state
    assert_eq!(last_rocket_state, FlightState::SecondaryChute);
}
