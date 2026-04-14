#include <Arduino.h>

/*
 * AZST Ground Station - PAYLOAD Scientific Hardware Simulator
 * 
 * Conforms EXACTLY to the Little-Endian binary protocol for Stream 2 (24 Bytes).
 * Upload this sketch to Arduino B and connect to /dev/ttyUSB1 (or the second COM port).
 */

#pragma pack(push, 1)

// Payload Scientific Packet (24 Bytes Total)
struct PayloadPacket {
    uint8_t startByte;      // 0: 0xBB
    uint8_t packetId;       // 1: 0x02
    uint32_t timestamp;     // 2-5
    float latitude;         // 6-9
    float longitude;        // 10-13
    float altitude;         // 14-17
    float scientificData;   // 18-21
    uint8_t reserved;       // 22
    uint8_t checksum;       // 23 (XOR of bytes 1-22)
};

#pragma pack(pop)

unsigned long lastPayloadTime = 0;
const int PAYLOAD_HZ = 5;

void setup() {
    Serial.begin(115200);
    while (!Serial) { }
}

void loop() {
    unsigned long currentTime = millis();
    if (currentTime - lastPayloadTime >= (1000 / PAYLOAD_HZ)) {
        lastPayloadTime = currentTime;
        sendPayloadTelemetry(currentTime);
    }
}

uint8_t calculateChecksum(const uint8_t* payload, size_t length) {
    uint8_t checksum = 0;
    for (size_t i = 1; i < length + 1; i++) {
        checksum ^= payload[i];
    }
    return checksum;
}

void sendPayloadTelemetry(unsigned long timestamp) {
    PayloadPacket pkt;
    
    pkt.startByte = 0xBB;
    pkt.packetId = 0x02;
    pkt.timestamp = (uint32_t)timestamp;
    
    // Payload drifting simulation
    pkt.latitude = 40.1234f + (timestamp * 0.0000005f);
    pkt.longitude = 49.5678f - (timestamp * 0.0000002f);
    
    // Just a placeholder mock altitude
    pkt.altitude = 1500.0f - (timestamp * 0.005f); 
    if (pkt.altitude < 0) pkt.altitude = 0.0f;

    // Simulated Scientific Data (Sine wave with noise)
    pkt.scientificData = 25.0f + (sin(timestamp / 1000.0f) * 5.0f) + random(-10, 10)/100.0f;
    
    pkt.reserved = 0;
    pkt.checksum = calculateChecksum((const uint8_t*)&pkt, 22);

    Serial.write((const uint8_t*)&pkt, sizeof(PayloadPacket));
}
