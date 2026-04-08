//! XOR checksum validation for binary packets.
//!
//! The checksum is computed by XOR-folding all bytes between the start byte
//! (exclusive) and the checksum byte (exclusive). That is, for a packet of
//! length N, the checksum covers `bytes[1..N-1]`.
//!
//! # Example
//! ```
//! use azst_ground_station_lib::protocol::checksum::compute_xor_checksum;
//! let data = [0xAA, 0x01, 0x02, 0x03, 0x00]; // last byte = checksum slot
//! assert_eq!(compute_xor_checksum(&data), 0x01 ^ 0x02 ^ 0x03);
//! ```

/// Compute the XOR checksum over bytes `[1..len-1]` of the given slice.
///
/// This skips byte 0 (start byte) and byte len-1 (the checksum field itself),
/// then folds the remaining bytes with XOR.
pub fn compute_xor_checksum(data: &[u8]) -> u8 {
    assert!(
        data.len() >= 3,
        "Packet too short for checksum: need at least 3 bytes, got {}",
        data.len()
    );
    data[1..data.len() - 1]
        .iter()
        .fold(0u8, |acc, &b| acc ^ b)
}

/// Validate that the last byte of `data` matches the XOR checksum of `data[1..len-1]`.
pub fn validate_checksum(data: &[u8]) -> bool {
    let expected = compute_xor_checksum(data);
    let actual = data[data.len() - 1];
    expected == actual
}

/// Compute and append the correct checksum byte for a mutable packet.
/// Overwrites the last byte with the correct XOR checksum.
pub fn stamp_checksum(data: &mut [u8]) {
    let checksum = compute_xor_checksum(data);
    let last = data.len() - 1;
    data[last] = checksum;
}
