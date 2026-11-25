/**
 * =========================================================================
 * PulseCare ESP32 Hardware Bedside Telemetry Node
 * Module 7 - IoT Hospital Monitoring Firmware
 * =========================================================================
 * 
 * Hardware Peripherals:
 *  - ESP32 DevKit 30/38 pin Microcontroller
 *  - MAX30102 Optical Pulse Oximeter & Heart Rate Sensor (I2C SDA=21, SCL=22)
 *  - DS18B20 1-Wire Digital Thermal Probe (DATA=4, 4.7k pull-up to 3.3V)
 *  - SSD1306 128x64 I2C OLED Display (0x3C, SDA=21, SCL=22)
 *  - Active Piezo Buzzer (GPIO25 through transistor/resistor)
 *  - Alarm Mute Pushbutton (GPIO27 to GND)
 * 
 * Cryptographic Protocol:
 *  - One-time device pairing (/api/device/pair) stores 64-char key in NVS
 *  - All subsequent requests signed with HMAC-SHA256
 *  - Offline ring buffer in RAM with automatic batch replay upon reconnect
 */

#include <Arduino.h>
#include <esp_task_wdt.h>
#include "config.h"
#include "storage.h"
#include "display.h"
#include "sensors.h"
#include "network.h"

// Instantiate Global Singletons
DeviceStorage storage;
PulseCareDisplay display;
PulseCareSensors sensors;
PulseCareNetwork network;

// Runtime state
uint32_t packetSeq = 1;
unsigned long lastSampleTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long lastDisplayTime = 0;
unsigned long lastConfigTime = 0;

#define WDT_TIMEOUT_SECONDS 15

// Check Serial Monitor for manual pairing commands (e.g. "PAIR:849201")
void handleSerialCommands() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.startsWith("PAIR:")) {
      String code = line.substring(5);
      code.trim();
      Serial.print(F("[Serial] Attempting pairing with code: "));
      Serial.println(code);

      if (network.pairWithServer(code)) {
        Serial.println(F("[Serial] Pairing SUCCESS! Node is now cryptographically active."));
        sensors.beepTone(100);
        delay(80);
        sensors.beepTone(100);
      } else {
        Serial.println(F("[Serial] Pairing FAILED. Check code validity or expiration (15 min)."));
        sensors.beepTone(500);
      }
    } else if (line.equalsIgnoreCase("UNPAIR") || line.equalsIgnoreCase("RESET")) {
      storage.clearDeviceKey();
      storage.clearAll();
      Serial.println(F("[Serial] Device unlinked and NVS reset. Node returned to UNPAIRED mode."));
      sensors.beepTone(300);
    } else if (line.equalsIgnoreCase("STATUS")) {
      Serial.println(F("--- PulseCare Node Status ---"));
      Serial.print(F("Device ID: ")); Serial.println(DEVICE_ID);
      Serial.print(F("Paired: ")); Serial.println(storage.isPaired() ? "YES" : "NO");
      Serial.print(F("WiFi: ")); Serial.println(network.isConnected() ? "CONNECTED" : "DISCONNECTED");
      Serial.print(F("Queued Samples: ")); Serial.println(storage.offlineBuffer.count());
      Serial.print(F("Free Heap: ")); Serial.print(ESP.getFreeHeap()); Serial.println(F(" bytes"));
      Serial.println(F("-----------------------------"));
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println(F("\n=================================================="));
  Serial.println(F(" PulseCare Hospital IoT Bedside Node Firmware"));
  Serial.print(F(" Device ID: ")); Serial.println(DEVICE_ID);
  Serial.print(F(" Firmware:  v")); Serial.println(FIRMWARE_VER);
  Serial.println(F("==================================================\n"));

  // 1. Initialize NVS Storage
  if (!storage.begin()) {
    Serial.println(F("[Storage] Error initializing NVS Preferences."));
  }

  // 2. Initialize OLED Display
  display.begin();

  // 3. Initialize Sensors (MAX30102 + DS18B20)
  sensors.begin();

  // 4. Initialize Network & WiFi
  network.begin();

  // 5. Initialize Hardware Watchdog Timer (15s)
  esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  esp_task_wdt_add(NULL); // Add current task to WDT

  // Audible startup beep
  sensors.beepTone(120);

  if (!storage.isPaired()) {
    Serial.println(F("\n⚠️  [DEVICE NOT PAIRED]"));
    Serial.println(F("Please obtain a 6-digit pairing code from the Hospital Admin UI."));
    Serial.println(F("Send command in Serial monitor: PAIR:<code> (e.g. PAIR:849201)\n"));
  }
}

void loop() {
  // Feed the watchdog
  esp_task_wdt_reset();

  // Handle incoming Serial commands
  handleSerialCommands();

  // Non-blocking sensor polling
  sensors.update();

  unsigned long now = millis();

  // 1. Main Telemetry Ingestion Timer (Every 1000ms)
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;

    if (storage.isPaired()) {
      SensorReadings r = sensors.getReadings();

      VitalSample sample;
      sample.seq = packetSeq++;
      sample.ts = network.getEpochMs();
      sample.hr = r.hr;
      sample.spo2 = r.spo2;
      sample.tempC = r.tempC;
      sample.fingerDetected = r.fingerDetected;
      sample.signalQuality = r.signalQuality;

      // Stream to server via HMAC-signed POST
      network.sendTelemetry(sample);

      // If network is active and offline buffer has queued samples, flush one batch
      if (network.isConnected() && !storage.offlineBuffer.isEmpty()) {
        network.replayOfflineBuffer();
      }
    }
  }

  // 2. Heartbeat Timer (Every 10000ms)
  if (now - lastHeartbeatTime >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTime = now;

    if (storage.isPaired()) {
      network.sendHeartbeat();
    }
  }

  // 3. Remote Config Sync Timer (Every 60000ms)
  if (now - lastConfigTime >= 60000) {
    lastConfigTime = now;

    if (storage.isPaired()) {
      network.fetchRemoteConfig();
    }
  }

  // 4. Display Refresh Timer (Every 200ms)
  if (now - lastDisplayTime >= DISPLAY_REFRESH_MS) {
    lastDisplayTime = now;

    if (!storage.isPaired()) {
      display.showPairingPrompt(DEVICE_ID);
    } else {
      SensorReadings r = sensors.getReadings();
      display.showVitals(
        r.hr,
        r.spo2,
        r.tempC,
        r.fingerDetected,
        network.hasActiveSession,
        network.isConnected(),
        storage.offlineBuffer.count()
      );
    }
  }
}
