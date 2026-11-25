#ifndef CONFIG_H
#define CONFIG_H

// =========================================================================
// PulseCare ESP32 Hardware Bedside Node Configuration
// Copy this file to 'config.h' and fill in your WiFi and API details.
// 'config.h' is gitignored to protect your private credentials.
// =========================================================================

// --- 1. WiFi Settings ---
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
#define WIFI_TIMEOUT_MS 15000

// --- 2. Backend Server & Device Identity ---
// Use your local machine IP (e.g., "http://192.168.1.50:5000" or HTTPS URL)
#define API_BASE_URL    "http://192.168.1.50:5000"
#define DEVICE_ID       "PCD-0001"
#define FIRMWARE_VER    "1.3.0"

// --- 3. Cryptographic Security ---
// In development with self-signed or HTTP, enable DEV_INSECURE.
// In clinical production, comment out DEV_INSECURE and supply your Root CA PEM.
#define DEV_INSECURE 1

#ifndef DEV_INSECURE
// Pinned Root CA Certificate for HTTPS validation
const char* const SERVER_ROOT_CA_CERT =
"-----BEGIN CERTIFICATE-----\n"
"MIIDSjCCAjKgAwIBAgIQRK+wgNajJ7qJMDmGLvhAazANBgkqhkiG9w0BAQsFADA/\n"
"... [INSERT PRODUCTION ROOT CA CERTIFICATE HERE] ...\n"
"-----END CERTIFICATE-----\n";
#endif

// --- 4. Hardware Pinout (ESP32 DevKit 38-pin or 30-pin) ---
// I2C Bus shared between MAX30102 and SSD1306 OLED (0x3C)
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22

// OneWire Data bus for DS18B20 digital thermal probe
#define PIN_DS18B20     4

// Active Buzzer for local bedside alarm
#define PIN_BUZZER      25

// Optional Alarm Mute / Silence Pushbutton
#define PIN_MUTE_BTN    27

// --- 5. Timing Intervals ---
#define SAMPLE_INTERVAL_MS    1000   // Send vital reading every 1s
#define HEARTBEAT_INTERVAL_MS 10000  // Send heartbeat every 10s
#define DISPLAY_REFRESH_MS    200    // Refresh OLED 5 times/sec

// --- 6. Sensor Thresholds ---
#define IR_FINGER_THRESHOLD   50000  // IR raw reading required for skin contact

#endif // CONFIG_H
