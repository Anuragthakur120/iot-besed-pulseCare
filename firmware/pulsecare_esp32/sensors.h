#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>
#include <Wire.h>
#include "MAX30105.h"
#include <OneWire.h>
#include <DallasTemperature.h>
#include "config.h"

// =========================================================================
// PulseCare Sensors: MAX30102 Pulse Oximeter, DS18B20 Temp, & Local Buzzer
// =========================================================================

struct SensorReadings {
  int hr;               // -1 if invalid/detached
  int spo2;             // -1 if invalid/detached
  float tempC;          // -999.0 if invalid/disconnected
  bool fingerDetected;
  uint8_t signalQuality;// 0 - 100%
  bool validHr;
  bool validSpo2;
  bool validTemp;
};

struct AlarmThresholds {
  int hrMin = 50;
  int hrMax = 120;
  int spo2Min = 92;
  float tempMin = 35.5f;
  float tempMax = 38.0f;
};

class PulseCareSensors {
private:
  MAX30105 particleSensor;
  OneWire oneWire;
  DallasTemperature tempSensor;

  bool max30102Ready = false;
  bool ds18b20Ready = false;

  // HR Peak detection state
  unsigned long lastBeatTime = 0;
  int beatRates[4] = {0, 0, 0, 0};
  byte rateSpot = 0;
  int currentBpm = -1;

  // SpO2 calculation sliding window
  static const int WINDOW_SIZE = 50;
  long redBuffer[WINDOW_SIZE];
  long irBuffer[WINDOW_SIZE];
  int sampleIndex = 0;
  int currentSpo2 = -1;

  // Temperature async timer
  unsigned long lastTempRequestTime = 0;
  float lastTempC = -999.0f;
  bool tempConversionPending = false;

  // Buzzer & Mute state
  bool isMuted = false;
  unsigned long muteUntilTime = 0;
  unsigned long lastBeepToggleTime = 0;
  bool buzzerPinState = false;

public:
  AlarmThresholds thresholds;

  PulseCareSensors() : oneWire(PIN_DS18B20), tempSensor(&oneWire) {}

  bool begin() {
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);

    pinMode(PIN_MUTE_BTN, INPUT_PULLUP);

    // 1. Initialize MAX30102 over I2C
    if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
      byte ledBrightness = 60; // 0=Off to 255=50mA
      byte sampleAverage = 4;  // 1, 2, 4, 8, 16, 32
      byte ledMode = 2;        // Red + IR
      byte sampleRate = 100;   // 100 samples/sec
      int pulseWidth = 411;    // 411us
      int adcRange = 4096;     // 4096

      particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
      particleSensor.setPulseAmplitudeRed(0x1F);
      particleSensor.setPulseAmplitudeGreen(0);
      max30102Ready = true;
      Serial.println(F("[Sensors] MAX30102 pulse oximeter initialized successfully."));
    } else {
      Serial.println(F("[Sensors] Warning: MAX30102 not detected. Check I2C wiring."));
      max30102Ready = false;
    }

    // 2. Initialize DS18B20 digital thermal probe
    tempSensor.begin();
    if (tempSensor.getDeviceCount() > 0) {
      tempSensor.setWaitForConversion(false); // Non-blocking async reads
      tempSensor.setResolution(11);           // 11-bit resolution (~0.125C precision)
      tempSensor.requestTemperatures();
      tempConversionPending = true;
      lastTempRequestTime = millis();
      ds18b20Ready = true;
      Serial.println(F("[Sensors] DS18B20 thermal probe detected."));
    } else {
      Serial.println(F("[Sensors] Warning: DS18B20 not detected. Verify 4.7k pull-up resistor."));
      ds18b20Ready = false;
    }

    for (int i = 0; i < WINDOW_SIZE; i++) {
      redBuffer[i] = 0;
      irBuffer[i] = 0;
    }

    return max30102Ready || ds18b20Ready;
  }

  void update() {
    // 1. Handle Alarm Mute Button (GPIO27 Active LOW)
    if (digitalRead(PIN_MUTE_BTN) == LOW) {
      isMuted = true;
      muteUntilTime = millis() + 60000; // Mute for 60 seconds
      digitalWrite(PIN_BUZZER, LOW);
    }
    if (isMuted && millis() > muteUntilTime) {
      isMuted = false;
    }

    // 2. Poll MAX30102 samples
    if (max30102Ready) {
      long irValue = particleSensor.getIR();
      long redValue = particleSensor.getRed();

      if (irValue > IR_FINGER_THRESHOLD) {
        // Record into sliding window
        redBuffer[sampleIndex] = redValue;
        irBuffer[sampleIndex] = irValue;
        sampleIndex = (sampleIndex + 1) % WINDOW_SIZE;

        // Simple Peak Detection for Heart Rate
        static long lastIr = 0;
        static bool rising = false;

        if (irValue > lastIr + 40) {
          rising = true;
        } else if (rising && irValue < lastIr - 40) {
          // Peak detected!
          rising = false;
          unsigned long now = millis();
          unsigned long delta = now - lastBeatTime;

          if (delta > 300 && delta < 2000) { // 30 - 200 BPM plausible range
            lastBeatTime = now;
            int calculatedBpm = 60000 / delta;

            // Moving average
            beatRates[rateSpot++] = calculatedBpm;
            rateSpot %= 4;

            int sum = 0;
            int count = 0;
            for (int i = 0; i < 4; i++) {
              if (beatRates[i] > 0) {
                sum += beatRates[i];
                count++;
              }
            }
            if (count > 0) {
              currentBpm = sum / count;
            }
          }
        }
        lastIr = irValue;

        // Calculate SpO2 using standard AC/DC ratio estimate
        if (sampleIndex == 0) { // Every 50 samples (~2 seconds)
          long minRed = 999999, maxRed = 0;
          long minIr = 999999, maxIr = 0;
          long sumRed = 0, sumIr = 0;

          for (int i = 0; i < WINDOW_SIZE; i++) {
            if (redBuffer[i] < minRed) minRed = redBuffer[i];
            if (redBuffer[i] > maxRed) maxRed = redBuffer[i];
            if (irBuffer[i] < minIr) minIr = irBuffer[i];
            if (irBuffer[i] > maxIr) maxIr = irBuffer[i];
            sumRed += redBuffer[i];
            sumIr += irBuffer[i];
          }

          float dcRed = sumRed / (float)WINDOW_SIZE;
          float dcIr = sumIr / (float)WINDOW_SIZE;
          float acRed = (maxRed - minRed);
          float acIr = (maxIr - minIr);

          if (dcRed > 0 && dcIr > 0 && acIr > 0) {
            float ratio = (acRed / dcRed) / (acIr / dcIr);
            // Empirical ratio-of-ratios formula
            float estimatedSpo2 = 110.0f - 25.0f * ratio;
            currentSpo2 = constrain(round(estimatedSpo2), 70, 100);
          }
        }
      } else {
        // Finger not on sensor! Clear vitals to enforce invariant: never send 0
        currentBpm = -1;
        currentSpo2 = -1;
      }
    }

    // 3. Async DS18B20 Temperature Polling (every 750ms)
    if (ds18b20Ready) {
      unsigned long now = millis();
      if (tempConversionPending && (now - lastTempRequestTime >= 750)) {
        float rawTemp = tempSensor.getTempCByIndex(0);
        tempConversionPending = false;

        // Check disconnection code -127C
        if (rawTemp > -100.0f && rawTemp < 85.0f) {
          // NOTE: DS18B20 on skin records peripheral surface temperature.
          // In clinical triage, skin temperature is typically ~1.5 - 2.0C below core oral/axillary temp.
          lastTempC = round(rawTemp * 10.0f) / 10.0f;
        } else {
          lastTempC = -999.0f; // Invalid
        }

        // Request next reading
        tempSensor.requestTemperatures();
        tempConversionPending = true;
        lastTempRequestTime = now;
      }
    }

    // 4. Local Buzzer Alarm Evaluation
    evaluateBuzzerAlarm();
  }

  SensorReadings getReadings() {
    SensorReadings r;
    long irVal = max30102Ready ? particleSensor.getIR() : 0;
    r.fingerDetected = (irVal > IR_FINGER_THRESHOLD);

    if (r.fingerDetected && currentBpm >= 30 && currentBpm <= 220) {
      r.hr = currentBpm;
      r.validHr = true;
    } else {
      r.hr = -1; // null
      r.validHr = false;
    }

    if (r.fingerDetected && currentSpo2 >= 70 && currentSpo2 <= 100) {
      r.spo2 = currentSpo2;
      r.validSpo2 = true;
    } else {
      r.spo2 = -1; // null
      r.validSpo2 = false;
    }

    if (lastTempC >= 25.0f && lastTempC <= 45.0f) {
      r.tempC = lastTempC;
      r.validTemp = true;
    } else {
      r.tempC = -999.0f; // null
      r.validTemp = false;
    }

    // Signal Quality Estimation (0 to 100)
    if (!r.fingerDetected) {
      r.signalQuality = 0;
    } else {
      int quality = 90;
      if (r.hr < 50 || r.hr > 120) quality -= 15;
      if (r.spo2 < 92) quality -= 20;
      r.signalQuality = constrain(quality, 10, 100);
    }

    return r;
  }

  void evaluateBuzzerAlarm() {
    if (isMuted) {
      digitalWrite(PIN_BUZZER, LOW);
      return;
    }

    bool isCritical = false;
    if (currentBpm > 0) {
      if (currentBpm < 40 || currentBpm > 140) isCritical = true;
    }
    if (currentSpo2 > 0) {
      if (currentSpo2 < 90) isCritical = true;
    }
    if (lastTempC > 0) {
      if (lastTempC > 39.5f || lastTempC < 34.5f) isCritical = true;
    }

    if (isCritical) {
      // Non-blocking rapid beep (200ms on, 200ms off)
      unsigned long now = millis();
      if (now - lastBeepToggleTime >= 200) {
        lastBeepToggleTime = now;
        buzzerPinState = !buzzerPinState;
        digitalWrite(PIN_BUZZER, buzzerPinState ? HIGH : LOW);
      }
    } else {
      digitalWrite(PIN_BUZZER, LOW);
      buzzerPinState = false;
    }
  }

  void beepTone(int durationMs) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(durationMs);
    digitalWrite(PIN_BUZZER, LOW);
  }
};

extern PulseCareSensors sensors;

#endif // SENSORS_H
