#include <Arduino.h>

/*
 * AZST Ground Station - ROCKET Avionics Hardware Simulator
 * 
 * Conforms EXACTLY to the Little-Endian binary protocol for Stream 1 (36 Bytes).
 * Upload this sketch to Arduino A and connect to /dev/ttyUSB0 (or the first COM port).
 */

#pragma pack(push, 1)

// Rocket Avionics Packet (36 Bytes Total)
struct RocketPacket {
    uint8_t startByte;      // 0: 0xAA
    uint8_t packetId;       // 1: 0x01
    uint32_t timestamp;     // 2-5
    float altitude;         // 6-9
    float latitude;         // 10-13
    float longitude;        // 14-17
    float pressure1;        // 18-21
    float pressure2;        // 22-25
    float velocity;         // 26-29
    uint8_t flightState;    // 30
    uint8_t primaryChute;   // 31
    uint8_t secondaryChute; // 32
    uint8_t reserved[2];    // 33-34
    uint8_t checksum;       // 35 (XOR of bytes 1-34)
};

#pragma pack(pop)

unsigned long lastRocketTime = 0;
float simAltitude = 0.0;
float simVelocity = 150.0;
uint8_t simGameState = 0;

const int ROCKET_HZ = 10;

void setup() {
    Serial.begin(115200);
    while (!Serial) { }
}

void loop() {
    unsigned long currentTime = millis();
    if (currentTime - lastRocketTime >= (1000 / ROCKET_HZ)) {
        lastRocketTime = currentTime;
        sendRocketTelemetry(currentTime);
    }
}

uint8_t calculateChecksum(const uint8_t* payload, size_t length) {
    uint8_t checksum = 0;
    for (size_t i = 1; i < length + 1; i++) {
        checksum ^= payload[i];
    }
    return checksum;
}

void sendRocketTelemetry(unsigned long timestamp) {
    RocketPacket pkt;
    
    // Mock simulation state machine for Rocket Parabola
    if (timestamp > 5000 && simGameState == 0) simGameState = 1; 
    if (simGameState == 1) {
        simAltitude += simVelocity * ((1000.0 / ROCKET_HZ) / 1000.0);
        simVelocity -= 9.8 * ((1000.0 / ROCKET_HZ) / 1000.0);
        if (simVelocity <= 0) simGameState = 3; 
    } else if (simGameState == 3) {
        simGameState = 4;
    } else if (simGameState == 4) {
        simAltitude -= 15.0 * ((1000.0 / ROCKET_HZ) / 1000.0);
        if (simAltitude < 1000.0) simGameState = 5;
    } else if (simGameState == 5) {
        simAltitude -= 5.0 * ((1000.0 / ROCKET_HZ) / 1000.0);
        if (simAltitude <= 0.0) {
            simAltitude = 0.0;
            simGameState = 0; 
        }
    }

    pkt.startByte = 0xAA;
    pkt.packetId = 0x01;
    pkt.timestamp = (uint32_t)timestamp;
    pkt.altitude = simAltitude;
    
    pkt.latitude = 40.1234f + (timestamp * 0.0000001f);
    pkt.longitude = 49.5678f + (timestamp * 0.0000001f);
    
    pkt.pressure1 = 1013.25f - (simAltitude * 0.12f);
    pkt.pressure2 = pkt.pressure1 + random(-10, 10)/100.0f;
    pkt.velocity = simVelocity;
    pkt.flightState = simGameState;
    
    pkt.primaryChute = (simGameState >= 4) ? 1 : 0;
    pkt.secondaryChute = (simGameState == 5) ? 1 : 0;
    
    pkt.reserved[0] = 0;
    pkt.reserved[1] = 0;
    
    pkt.checksum = calculateChecksum((const uint8_t*)&pkt, 34);

    Serial.write((const uint8_t*)&pkt, sizeof(RocketPacket));
}
