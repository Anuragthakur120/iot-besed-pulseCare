#ifndef STORAGE_H
#define STORAGE_H

#include <Arduino.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// =========================================================================
// PulseCare ESP32 Storage: NVS Preferences & Offline RAM Ring Buffer
// =========================================================================

struct VitalSample {
  uint32_t seq;
  uint64_t ts;
  int16_t hr;           // -1 when invalid/null
  int16_t spo2;         // -1 when invalid/null
  float tempC;          // -999.0 when invalid/null
  bool fingerDetected;
  uint8_t signalQuality;
};

#define OFFLINE_BUFFER_CAPACITY 60

class OfflineBuffer {
private:
  VitalSample buffer[OFFLINE_BUFFER_CAPACITY];
  int head = 0;
  int tail = 0;
  int currentCount = 0;

public:
  OfflineBuffer() : head(0), tail(0), currentCount(0) {}

  bool push(const VitalSample& sample) {
    buffer[head] = sample;
    head = (head + 1) % OFFLINE_BUFFER_CAPACITY;

    if (currentCount < OFFLINE_BUFFER_CAPACITY) {
      currentCount++;
      return true;
    } else {
      // Overwrite oldest entry
      tail = (tail + 1) % OFFLINE_BUFFER_CAPACITY;
      return false;
    }
  }

  bool pop(VitalSample& outSample) {
    if (currentCount == 0) return false;
    outSample = buffer[tail];
    tail = (tail + 1) % OFFLINE_BUFFER_CAPACITY;
    currentCount--;
    return true;
  }

  int count() const {
    return currentCount;
  }

  bool isEmpty() const {
    return currentCount == 0;
  }

  bool isFull() const {
    return currentCount >= OFFLINE_BUFFER_CAPACITY;
  }

  void clear() {
    head = 0;
    tail = 0;
    currentCount = 0;
  }

  // Exports up to batchLimit items into a JSON array string for replay
  String toBatchJson(int batchLimit = 20) {
    int exportCount = min(currentCount, batchLimit);
    if (exportCount == 0) return "[]";

    JsonDocument doc;
    JsonArray arr = doc.to<JsonArray>();

    int idx = tail;
    for (int i = 0; i < exportCount; i++) {
      JsonObject obj = arr.add<JsonObject>();
      obj["seq"] = buffer[idx].seq;
      if (buffer[idx].ts > 0) {
        obj["ts"] = buffer[idx].ts;
      }
      if (buffer[idx].hr >= 0) obj["hr"] = buffer[idx].hr;
      else obj["hr"] = nullptr;

      if (buffer[idx].spo2 >= 0) obj["spo2"] = buffer[idx].spo2;
      else obj["spo2"] = nullptr;

      if (buffer[idx].tempC > -900.0f) obj["tempC"] = buffer[idx].tempC;
      else obj["tempC"] = nullptr;

      obj["fingerDetected"] = buffer[idx].fingerDetected;
      obj["signalQuality"] = buffer[idx].signalQuality;

      idx = (idx + 1) % OFFLINE_BUFFER_CAPACITY;
    }

    String output;
    serializeJson(doc, output);
    return output;
  }

  void discardBatch(int discardedCount) {
    int toRemove = min(currentCount, discardedCount);
    tail = (tail + toRemove) % OFFLINE_BUFFER_CAPACITY;
    currentCount -= toRemove;
  }
};

class DeviceStorage {
private:
  Preferences prefs;
  const char* NAMESPACE = "pulsecare";

public:
  OfflineBuffer offlineBuffer;

  bool begin() {
    return prefs.begin(NAMESPACE, false);
  }

  String getDeviceKey() {
    return prefs.getString("deviceKey", "");
  }

  bool setDeviceKey(const String& key) {
    if (key.length() == 0) return false;
    return prefs.putString("deviceKey", key) > 0;
  }

  bool clearDeviceKey() {
    return prefs.remove("deviceKey");
  }

  bool isPaired() {
    String key = getDeviceKey();
    return key.length() >= 32;
  }

  void clearAll() {
    prefs.clear();
  }
};

extern DeviceStorage storage;

#endif // STORAGE_H
