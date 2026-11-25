#ifndef NETWORK_H
#define NETWORK_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>
#include "mbedtls/md.h"
#include <ArduinoJson.h>
#include "config.h"
#include "storage.h"
#include "sensors.h"

// =========================================================================
// PulseCare Network: WiFi, NTP UTC Sync, HMAC-SHA256 Security, & Telemetry
// =========================================================================

class PulseCareNetwork {
private:
  int wifiRetryCount = 0;
  bool isNtpSynced = false;
  unsigned long lastNtpCheck = 0;

  // Compute SHA-256 hex hash
  String sha256(const String& payload) {
    byte shaResult[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 0);
    mbedtls_md_starts(&ctx);
    mbedtls_md_update(&ctx, (const unsigned char*)payload.c_str(), payload.length());
    mbedtls_md_finish(&ctx, shaResult);
    mbedtls_md_free(&ctx);

    char hexBuffer[65];
    for (int i = 0; i < 32; i++) {
      sprintf(&hexBuffer[i * 2], "%02x", shaResult[i]);
    }
    hexBuffer[64] = 0;
    return String(hexBuffer);
  }

  // Compute HMAC-SHA256 hex signature
  String hmacSha256(const String& key, const String& message) {
    byte hmacResult[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
    mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key.c_str(), key.length());
    mbedtls_md_hmac_update(&ctx, (const unsigned char*)message.c_str(), message.length());
    mbedtls_md_hmac_finish(&ctx, hmacResult);
    mbedtls_md_free(&ctx);

    char hexBuffer[65];
    for (int i = 0; i < 32; i++) {
      sprintf(&hexBuffer[i * 2], "%02x", hmacResult[i]);
    }
    hexBuffer[64] = 0;
    return String(hexBuffer);
  }

  // Generate random 16-character alphanumeric nonce
  String generateNonce() {
    String nonce = "";
    const char chars[] = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (int i = 0; i < 16; i++) {
      nonce += chars[random(0, sizeof(chars) - 1)];
    }
    return nonce;
  }

public:
  bool hasActiveSession = false;

  void begin() {
    WiFi.mode(WIFI_STA);
    connectWiFi();
  }

  bool connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return true;

    Serial.print(F("[WiFi] Connecting to "));
    Serial.println(WIFI_SSID);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long start = millis();

    while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
      delay(300);
      Serial.print(F("."));
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println(F("[WiFi] Connected successfully."));
      Serial.print(F("[WiFi] IP Address: "));
      Serial.println(WiFi.localIP());
      syncNTP();
      return true;
    } else {
      Serial.println(F("[WiFi] Connection timeout."));
      return false;
    }
  }

  bool isConnected() {
    return WiFi.status() == WL_CONNECTED;
  }

  void syncNTP() {
    Serial.println(F("[NTP] Initializing UTC time sync with pool.ntp.org..."));
    configTime(0, 0, "pool.ntp.org", "time.google.com");

    struct tm timeinfo;
    if (getLocalTime(&timeinfo, 5000)) {
      isNtpSynced = true;
      Serial.print(F("[NTP] UTC Time synced: "));
      Serial.println(asctime(&timeinfo));
    } else {
      isNtpSynced = false;
      Serial.println(F("[NTP] Warning: Initial NTP sync failed. Will retry later."));
    }
  }

  uint32_t getEpochSeconds() {
    time_t now;
    time(&now);
    return (uint32_t)now;
  }

  uint64_t getEpochMs() {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return ((uint64_t)tv.tv_sec * 1000ULL) + ((uint64_t)tv.tv_usec / 1000ULL);
  }

  // =========================================================================
  // 1. One-time Pairing Call: POST /api/device/pair
  // =========================================================================
  bool pairWithServer(const String& pairingCode) {
    if (!isConnected()) {
      if (!connectWiFi()) return false;
    }

    WiFiClient client;
    HTTPClient http;

    String url = String(API_BASE_URL) + "/api/device/pair";
    http.begin(client, url);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["pairingCode"] = pairingCode;

    String requestBody;
    serializeJson(doc, requestBody);

    Serial.print(F("[Security] Posting pairing request to "));
    Serial.println(url);

    int httpCode = http.POST(requestBody);
    if (httpCode == 200) {
      String response = http.getString();
      JsonDocument resDoc;
      deserializeJson(resDoc, response);

      const char* key = resDoc["data"]["deviceKey"];
      if (key && strlen(key) >= 32) {
        storage.setDeviceKey(String(key));
        Serial.println(F("[Security] Device successfully paired! Stored key in NVS."));
        http.end();
        return true;
      }
    } else {
      Serial.print(F("[Security] Pairing failed. HTTP Code: "));
      Serial.println(httpCode);
      Serial.println(http.getString());
    }

    http.end();
    return false;
  }

  // =========================================================================
  // 2. Hardware Heartbeat: POST /api/device/heartbeat (HMAC Signed)
  // =========================================================================
  bool sendHeartbeat() {
    if (!isConnected() || !storage.isPaired()) return false;

    WiFiClient client;
    HTTPClient http;

    String path = "/api/device/heartbeat";
    String url = String(API_BASE_URL) + path;
    http.begin(client, url);

    JsonDocument doc;
    doc["firmwareVersion"] = FIRMWARE_VER;
    doc["rssi"] = WiFi.RSSI();
    doc["uptime"] = millis() / 1000;
    doc["freeHeap"] = ESP.getFreeHeap();

    String body;
    serializeJson(doc, body);

    // Cryptographic HMAC Signature
    String timestamp = String(getEpochSeconds());
    String nonce = generateNonce();
    String bodyHash = sha256(body);
    String message = "POST" + path + timestamp + nonce + bodyHash;
    String signature = hmacSha256(storage.getDeviceKey(), message);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Id", DEVICE_ID);
    http.addHeader("X-Timestamp", timestamp);
    http.addHeader("X-Nonce", nonce);
    http.addHeader("X-Signature", signature);

    int httpCode = http.POST(body);
    if (httpCode == 200) {
      String response = http.getString();
      JsonDocument resDoc;
      deserializeJson(resDoc, response);
      hasActiveSession = resDoc["data"]["hasActiveSession"] | false;
      http.end();
      return true;
    } else {
      Serial.print(F("[Network] Heartbeat failed. Code: "));
      Serial.println(httpCode);
    }

    http.end();
    return false;
  }

  // =========================================================================
  // 3. Telemetry Ingestion: POST /api/device/readings (HMAC Signed)
  // =========================================================================
  bool sendTelemetry(const VitalSample& sample) {
    if (!isConnected()) {
      storage.offlineBuffer.push(sample);
      return false;
    }

    WiFiClient client;
    HTTPClient http;

    String path = "/api/device/readings";
    String url = String(API_BASE_URL) + path;
    http.begin(client, url);

    JsonDocument doc;
    doc["seq"] = sample.seq;
    if (sample.ts > 0) doc["ts"] = sample.ts;
    if (sample.hr >= 0) doc["hr"] = sample.hr;
    else doc["hr"] = nullptr;

    if (sample.spo2 >= 0) doc["spo2"] = sample.spo2;
    else doc["spo2"] = nullptr;

    if (sample.tempC > -900.0f) doc["tempC"] = sample.tempC;
    else doc["tempC"] = nullptr;

    doc["fingerDetected"] = sample.fingerDetected;
    doc["signalQuality"] = sample.signalQuality;

    String body;
    serializeJson(doc, body);

    String timestamp = String(getEpochSeconds());
    String nonce = generateNonce();
    String bodyHash = sha256(body);
    String message = "POST" + path + timestamp + nonce + bodyHash;
    String signature = hmacSha256(storage.getDeviceKey(), message);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Id", DEVICE_ID);
    http.addHeader("X-Timestamp", timestamp);
    http.addHeader("X-Nonce", nonce);
    http.addHeader("X-Signature", signature);

    int httpCode = http.POST(body);
    if (httpCode == 201) {
      hasActiveSession = true;
      http.end();
      return true;
    } else if (httpCode == 409) {
      // 409 no_active_session: device online but no active patient session
      hasActiveSession = false;
      http.end();
      return true;
    } else {
      // Network drop or server failure -> queue in offline buffer
      Serial.print(F("[Network] Telemetry upload failed (Code "));
      Serial.print(httpCode);
      Serial.println(F("). Queuing in offline buffer."));
      storage.offlineBuffer.push(sample);
      http.end();
      return false;
    }
  }

  // =========================================================================
  // 4. Offline Buffer Replay Batch: POST /api/device/readings (Batch Array)
  // =========================================================================
  bool replayOfflineBuffer() {
    if (!isConnected() || storage.offlineBuffer.isEmpty()) return false;

    int batchCount = min(storage.offlineBuffer.count(), 20);
    String batchBody = storage.offlineBuffer.toBatchJson(batchCount);

    WiFiClient client;
    HTTPClient http;

    String path = "/api/device/readings";
    String url = String(API_BASE_URL) + path;
    http.begin(client, url);

    String timestamp = String(getEpochSeconds());
    String nonce = generateNonce();
    String bodyHash = sha256(batchBody);
    String message = "POST" + path + timestamp + nonce + bodyHash;
    String signature = hmacSha256(storage.getDeviceKey(), message);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Id", DEVICE_ID);
    http.addHeader("X-Timestamp", timestamp);
    http.addHeader("X-Nonce", nonce);
    http.addHeader("X-Signature", signature);

    int httpCode = http.POST(batchBody);
    if (httpCode == 201) {
      Serial.print(F("[Offline Replay] Successfully flushed "));
      Serial.print(batchCount);
      Serial.println(F(" queued samples to server."));
      storage.offlineBuffer.discardBatch(batchCount);
      http.end();
      return true;
    }

    http.end();
    return false;
  }

  // =========================================================================
  // 5. Remote Configuration Fetch: GET /api/device/config (HMAC Signed)
  // =========================================================================
  bool fetchRemoteConfig() {
    if (!isConnected() || !storage.isPaired()) return false;

    WiFiClient client;
    HTTPClient http;

    String path = "/api/device/config";
    String url = String(API_BASE_URL) + path;
    http.begin(client, url);

    String timestamp = String(getEpochSeconds());
    String nonce = generateNonce();
    String bodyHash = sha256(""); // Empty body for GET
    String message = "GET" + path + timestamp + nonce + bodyHash;
    String signature = hmacSha256(storage.getDeviceKey(), message);

    http.addHeader("X-Device-Id", DEVICE_ID);
    http.addHeader("X-Timestamp", timestamp);
    http.addHeader("X-Nonce", nonce);
    http.addHeader("X-Signature", signature);

    int httpCode = http.GET();
    if (httpCode == 200) {
      String response = http.getString();
      JsonDocument doc;
      deserializeJson(doc, response);

      JsonObject t = doc["data"]["thresholds"];
      if (!t.isNull()) {
        sensors.thresholds.hrMin = t["hrMin"] | 50;
        sensors.thresholds.hrMax = t["hrMax"] | 120;
        sensors.thresholds.spo2Min = t["spo2Min"] | 92;
        sensors.thresholds.tempMin = t["tempMin"] | 35.5f;
        sensors.thresholds.tempMax = t["tempMax"] | 38.0f;
        Serial.println(F("[Config] Synced remote alarm thresholds successfully."));
      }
      http.end();
      return true;
    }

    http.end();
    return false;
  }
};

extern PulseCareNetwork network;

#endif // NETWORK_H
