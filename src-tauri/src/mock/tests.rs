//! Tests for the mock data generator module.

use crate::protocol::telemetry_packet::TelemetryPacket;
use crate::protocol::rocket_packet::FlightState;
use crate::serial::reader::{FrameParser, ParsedPacket};

use super::flight_profile::*;
use super::generator::*;

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
    let p = pressure_from_altitude(3000.0);
    assert!(
        (p - 701.0).abs() < 10.0,
        "pressure at 3000m should be ~701 hPa, got {p}"
    );
}

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

#[test]
fn generated_rocket_packet_is_parseable() {
    let config = FlightProfileConfig::default();
    let gen = MockGenerator::with_defaults();
    let mut parser = FrameParser::new();

    for t_secs in 0..=180 {
        let t = t_secs as f32;
        if let Some(MockPacket::Rocket(bytes)) = gen.generate_rocket_bytes(t) {
            let parsed_packets = parser.feed(&bytes);
            assert_eq!(parsed_packets.len(), 1);

            let parsed = match &parsed_packets[0] {
                ParsedPacket::Rocket(p) => p.clone(),
                _ => panic!("expected rocket packet"),
            };

            // Verify flight state matches profile (allowing some state-transition lag/lead)
            let expected_state = flight_state_at(t, &config.timings);
            let diff = (expected_state as i8) - (parsed.flight_state as i8);
            assert!(
                diff >= -1 && diff <= 2,
                "flight state mismatch at t={}s: expected {:?}, got {:?}",
                t, expected_state, parsed.flight_state
            );
        }
    }
}

#[test]
fn generated_payload_packet_is_parseable() {
    let gen = MockGenerator::with_defaults();

    for t_tenths in (0..=1800).step_by(2) {
        let t = t_tenths as f32 * 0.1;
        if let Some(MockPacket::Payload(bytes)) = gen.generate_payload_bytes(t) {
            let csv_str = std::str::from_utf8(&bytes).unwrap();
            TelemetryPacket::parse(csv_str)
                .unwrap_or_else(|| panic!("failed to parse payload packet at t={t}s"));
        }
    }
}

#[test]
fn payload_coordinates_offset_from_rocket() {
    let config = FlightProfileConfig::default();
    let rocket = generate_rocket_packet(50.0, &config);
    let payload = generate_payload_packet(50.0, &config);

    assert_ne!(rocket.latitude, payload.latitude);
    assert_ne!(rocket.longitude, payload.longitude);
}

#[test]
fn tick_0_emits_packets() {
    let gen = MockGenerator::with_defaults();
    let packets = gen.generate_tick(0);
    assert_eq!(packets.len(), 3, "tick 0 should emit rocket + payload + drone");
}

#[test]
fn one_second_is_five_ticks() {
    let gen = MockGenerator::with_defaults();
    let mut total_rocket = 0;
    let mut total_payload = 0;
    let mut total_drone = 0;

    for tick in 0..5 {
        for pkt in gen.generate_tick(tick) {
            match pkt {
                MockPacket::Rocket(_) => total_rocket += 1,
                MockPacket::Payload(_) => total_payload += 1,
                MockPacket::Drone(_) => total_drone += 1,
            }
        }
    }

    assert_eq!(total_rocket, 1, "should get 1 rocket packet per second");
    assert_eq!(total_payload, 5, "should get 5 payload packets per second");
    assert_eq!(total_drone, 5, "should get 5 drone packets per second");
}

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
fn mock_state_drone_arm_command() {
    let state = MockState::new();
    assert_eq!(state.drone_arm_command(), None);

    state.set_drone_arm(true);
    assert_eq!(state.drone_arm_command(), Some(true));

    state.set_drone_arm(false);
    assert_eq!(state.drone_arm_command(), Some(false));

    state.reset();
    assert_eq!(state.drone_arm_command(), None);
}

#[test]
fn drone_arm_override_applied_to_generated_packets() {
    use crate::protocol::telemetry_packet::TelemetryPacket;
    use crate::serial::reader::{FrameParser, ParsedPacket};

    let gen = MockGenerator::with_defaults();

    // t=30s: without override the mock auto-arms (elapsed >= 5s)
    let auto = gen.generate_tick_with_arm(150, None);
    let auto_drone = auto
        .iter()
        .find_map(|p| match p {
            MockPacket::Drone(b) => Some(b),
            _ => None,
        })
        .expect("tick should contain drone packet");
    let mut parser = FrameParser::new();
    let parsed = parser.feed(auto_drone);
    let auto_armed = match &parsed[0] {
        ParsedPacket::Drone(p) => p.armed,
        _ => panic!("expected drone packet"),
    };
    assert!(auto_armed, "mock should auto-arm after 5 s");

    // Ground-commanded DISARM overrides the auto-arm
    let disarmed = gen.generate_tick_with_arm(150, Some(false));
    let disarmed_drone = disarmed
        .iter()
        .find_map(|p| match p {
            MockPacket::Drone(b) => Some(b),
            _ => None,
        })
        .expect("tick should contain drone packet");
    let csv_str = std::str::from_utf8(disarmed_drone).unwrap();
    let pkt = TelemetryPacket::parse(csv_str).expect("drone packet should parse");
    assert!(!pkt.armed, "ground DISARM command should override auto-arm");
    assert_eq!(pkt.state_code, 0);
    assert_eq!(pkt.throttle_us, 1000);

    // Ground-commanded ARM before the auto-arm window
    let armed = gen.generate_tick_with_arm(5, Some(true));
    let armed_drone = armed
        .iter()
        .find_map(|p| match p {
            MockPacket::Drone(b) => Some(b),
            _ => None,
        })
        .expect("tick should contain drone packet");
    let csv_str = std::str::from_utf8(armed_drone).unwrap();
    let pkt = TelemetryPacket::parse(csv_str).expect("drone packet should parse");
    assert!(pkt.armed, "ground ARM command should override auto-disarm");
}

#[test]
fn full_flight_simulation_all_packets_valid() {
    let gen = MockGenerator::with_defaults();
    let mut parser = FrameParser::new();

    let mut rocket_count = 0;
    let mut payload_count = 0;
    let mut drone_count = 0;
    let mut last_rocket_state = FlightState::Pad;

    for tick in 0..900 {
        for pkt in gen.generate_tick(tick) {
            let bytes = match pkt {
                MockPacket::Rocket(b) => b,
                MockPacket::Payload(b) => b,
                MockPacket::Drone(b) => b,
            };
            for parsed_pkt in parser.feed(&bytes) {
                match parsed_pkt {
                    ParsedPacket::Rocket(p) => {
                        last_rocket_state = p.flight_state;
                        rocket_count += 1;
                    }
                    ParsedPacket::Payload(_) => {
                        payload_count += 1;
                    }
                    ParsedPacket::Drone(_) => {
                        drone_count += 1;
                    }
                }
            }
        }
    }

    assert_eq!(rocket_count, 180, "should generate 180 rocket packets (1 Hz * 180s)");
    assert_eq!(payload_count, 900, "should generate 900 payload packets (5 Hz * 180s)");
    assert_eq!(drone_count, 900, "should generate 900 drone packets (5 Hz * 180s)");
    assert_eq!(last_rocket_state, FlightState::SecondaryChute);
}
