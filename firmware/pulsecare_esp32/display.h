#ifndef DISPLAY_H
#define DISPLAY_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"

// =========================================================================
// PulseCare ESP32 OLED Display (SSD1306 128x64 I2C at 0x3C)
// =========================================================================

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C

class PulseCareDisplay {
private:
  Adafruit_SSD1306 oled;
  bool initialized = false;

public:
  PulseCareDisplay() : oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET) {}

  bool begin() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
    if (!oled.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
      Serial.println(F("[OLED] Warning: SSD1306 allocation failed. Check I2C wiring."));
      initialized = false;
      return false;
    }

    initialized = true;
    oled.clearDisplay();
    oled.setTextColor(SSD1306_WHITE);
    showSplash();
    return true;
  }

  void showSplash() {
    if (!initialized) return;
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setCursor(18, 12);
    oled.println(F("PULSECARE OS"));
    oled.setCursor(14, 26);
    oled.println(F("IoT Bedside Node"));

    // ECG wave line
    oled.drawLine(10, 48, 35, 48, SSD1306_WHITE);
    oled.drawLine(35, 48, 42, 38, SSD1306_WHITE);
    oled.drawLine(42, 38, 48, 56, SSD1306_WHITE);
    oled.drawLine(48, 56, 54, 44, SSD1306_WHITE);
    oled.drawLine(54, 44, 60, 48, SSD1306_WHITE);
    oled.drawLine(60, 48, 118, 48, SSD1306_WHITE);

    oled.display();
  }

  void showPairingPrompt(const String& deviceId) {
    if (!initialized) return;
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    oled.println(F("=== PAIRING MODE ==="));
    oled.setCursor(0, 16);
    oled.print(F("Device: "));
    oled.println(deviceId);
    oled.setCursor(0, 30);
    oled.println(F("Open Serial (115200)"));
    oled.setCursor(0, 42);
    oled.println(F("Send: PAIR:<code>"));
    oled.setCursor(0, 54);
    oled.println(F("e.g. PAIR:849201"));
    oled.display();
  }

  void showConnectingWiFi(const String& ssid, int attempt) {
    if (!initialized) return;
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    oled.println(F("PulseCare Network"));
    oled.setCursor(0, 18);
    oled.println(F("Connecting to WiFi:"));
    oled.setCursor(0, 30);
    oled.println(ssid);
    oled.setCursor(0, 46);
    oled.print(F("Attempt #"));
    oled.print(attempt);
    oled.display();
  }

  void showVitals(int hr, int spo2, float tempC, bool fingerDetected, bool isLive, bool wifiConnected, int offlineQueued) {
    if (!initialized) return;
    oled.clearDisplay();

    // Header Status Bar
    oled.setTextSize(1);
    oled.setCursor(0, 0);
    if (wifiConnected) {
      oled.print(F("WiFi:OK"));
    } else {
      oled.print(F("WiFi:DISC"));
    }

    oled.setCursor(55, 0);
    if (isLive) {
      oled.print(F("•LIVE"));
    } else {
      oled.print(F("•STANDBY"));
    }

    if (offlineQueued > 0) {
      oled.setCursor(102, 0);
      oled.print(F("Q:"));
      oled.print(offlineQueued);
    }
    oled.drawLine(0, 10, 127, 10, SSD1306_WHITE);

    if (!fingerDetected) {
      // Prompt when probe detached
      oled.setTextSize(1);
      oled.setCursor(16, 22);
      oled.println(F("PLACE FINGER ON"));
      oled.setCursor(20, 34);
      oled.println(F("PULSE OX SENSOR"));

      // Display Temperature at bottom even if finger is off
      oled.setCursor(0, 52);
      oled.print(F("Body Temp: "));
      if (tempC > -900.0f) {
        oled.print(tempC, 1);
        oled.println(F(" C"));
      } else {
        oled.println(F("-- C"));
      }
    } else {
      // Big BPM reading
      oled.setTextSize(1);
      oled.setCursor(0, 14);
      oled.print(F("HR (bpm)"));

      oled.setCursor(68, 14);
      oled.print(F("SpO2 (%)"));

      oled.setTextSize(2);
      oled.setCursor(0, 26);
      if (hr > 0) {
        oled.print(hr);
      } else {
        oled.print(F("--"));
      }

      oled.setCursor(68, 26);
      if (spo2 > 0) {
        oled.print(spo2);
        oled.setTextSize(1);
        oled.print(F("%"));
      } else {
        oled.print(F("--"));
      }

      // Temperature row
      oled.setTextSize(1);
      oled.setCursor(0, 52);
      oled.print(F("Temp: "));
      if (tempC > -900.0f) {
        oled.print(tempC, 1);
        oled.println(F(" C"));
      } else {
        oled.println(F("-- C"));
      }
    }

    oled.display();
  }
};

extern PulseCareDisplay display;

#endif // DISPLAY_H
