# PulseCare ESP32 Hardware Wiring & Flashing Guide

This document provides the complete hardware wiring schematic, pin mapping, voltage safety guidelines, Arduino IDE flashing steps, and troubleshooting instructions for the **PulseCare IoT Bedside Telemetry Node**.

---

## 1. Hardware Architecture & Component Bill of Materials (BOM)

| Component | Function | Interface / Pins | Operating Voltage |
| :--- | :--- | :--- | :--- |
| **ESP32 DevKit V1** (30 or 38 pins) | Main Dual-Core Microcontroller | Wi-Fi 802.11 b/g/n, I2C, 1-Wire, GPIO | 5V (USB) / 3.3V Logic |
| **MAX30102 / MAX30105** | Heart Rate & SpO2 Pulse Oximetry Sensor | I2C (Address `0x57`) | 3.3V |
| **DS18B20** (Waterproof Probe) | Digital Body/Skin Temperature Sensor | 1-Wire (Data: GPIO4) | 3.0V - 5.5V (Use 3.3V) |
| **SSD1306 0.96" OLED** | 128x64 Local Bedside Display | I2C (Address `0x3C`) | 3.3V |
| **Active 5V/3.3V Buzzer** | Bedside Critical Threshold Alarm | GPIO25 (via Transistor/Resistor) | 3.3V |
| **Pushbutton** (Optional) | Bedside Alarm Silence / Mute (60s) | GPIO27 to GND | 3.3V Logic |
| **Resistor 4.7 kΩ** | 1-Wire Pull-Up Resistor (DS18B20) | Between DS18B20 DATA & 3.3V | — |
| **Resistor 220 Ω / 1 kΩ** | Buzzer Current Limiter / Transistor Base | In series with GPIO25 | — |

---

## 2. ASCII Schematic & Wiring Diagram

```text
                           +------------------------+
                           |     ESP32 DevKit V1    |
                           |                        |
                           |  [3.3V]  [GND]   [EN]  |
                           +----+-------+-------+---+
                                |       |
           +--------------------+       |
           |                            |
           | (3.3V Rail)                | (GND Rail)
           |                            |
           +------------------+         +------------------+
           |                  |         |                  |
           v                  v         v                  v
     +------------+     +------------+     +------------+
     |  MAX30102  |     |  SSD1306   |     |  DS18B20   |
     | Pulse Ox   |     | OLED 128x64|     | Temp Probe |
     +------------+     +------------+     +------------+
     | VIN -> 3.3V|     | VCC -> 3.3V|     | VDD -> 3.3V|
     | GND -> GND |     | GND -> GND |     | GND -> GND |
     | SDA -> G21 |<----+---->SDA -> G21|  |            |
     | SCL -> G22 |<----+---->SCL -> G22|  | DATA-> G4  |<----+ (4.7k Pull-up
     +------------+     +------------+     +------------+     |  to 3.3V Rail)
                                                              +--[ 4.7k Resistor ]-- 3.3V

             +-------------------------------+
             |       Active Buzzer Subsystem |
             +-------------------------------+
             ESP32 GPIO25 ---> [ 220Ω Resistor ] ---> (+) Buzzer Pin
                                                     (-) Buzzer Pin ---> GND

             +-------------------------------+
             |   Alarm Mute Button Subsystem |
             +-------------------------------+
             ESP32 GPIO27 ---> [ Pushbutton Switch ] ---> GND (Uses ESP32 INPUT_PULLUP)
```

---

## 3. Detailed Pin Connection Table

| ESP32 Pin | Peripheral Pin | Peripheral Name | Function / Description |
| :--- | :--- | :--- | :--- |
| **3V3** | **VIN / VCC / VDD** | Power Rail | Regulated 3.3V power to all sensor breakouts |
| **GND** | **GND** | Ground Rail | Common ground return |
| **GPIO 21** | **SDA** | MAX30102 & SSD1306 | I2C Serial Data Bus (Shared) |
| **GPIO 22** | **SCL** | MAX30102 & SSD1306 | I2C Serial Clock Bus (Shared) |
| **GPIO 4** | **DATA** (Yellow/White) | DS18B20 Sensor | 1-Wire Bi-directional data stream with 4.7kΩ pull-up |
| **GPIO 25** | **(+) Positive** | Active Buzzer | Bedside audio alarm trigger (via 220Ω resistor) |
| **GPIO 27** | **Terminal 1** | Mute Pushbutton | Alarm silence input (Internal pull-up enabled) |

---

## 4. Critical Hardware & Voltage Warnings

> [!CAUTION]
> **1. MAX30102 Breakout Voltage Differences:**
> - Many commercial MAX30102 breakout boards (especially RCWL-0516 and generic purple/black clones) include onboard voltage regulators that drop 5V to 1.8V and 3.3V.
> - **Always power the MAX30102 from 3.3V on the ESP32**, never from 5V/VIN directly, unless your breakout specifically states it has a 5V-to-3.3V LDO.
> - Some clone boards have miswired 4.7k pull-up resistors to the 1.8V bus, causing weak I2C signals. If the I2C scanner does not detect `0x57`, solder two external 4.7k pull-up resistors from SDA and SCL to the 3.3V rail.

> [!IMPORTANT]
> **2. DS18B20 1-Wire 4.7 kΩ Pull-up Resistor:**
> - The 1-Wire protocol relies on an open-drain bus. **You MUST wire a 4.7 kΩ pull-up resistor between the DS18B20 DATA line (GPIO4) and 3.3V**.
> - Without this pull-up resistor, the DallasTemperature library will return `-127.00 °C` (device disconnected).
> - Standard cable color code: **Red = VDD (3.3V)**, **Black = GND**, **Yellow/White = DATA (GPIO4)**.

> [!NOTE]
> **3. Clinical Temperature vs. Peripheral Skin Surface:**
> - The DS18B20 probe attached to a finger or forearm measures **peripheral skin surface temperature**, which typically runs 1.5 °C – 2.0 °C cooler than core body / oral temperature.
> - PulseCare records this explicitly as surface telemetry; calibrate with your clinical reference standard before making triage decisions.

---

## 5. Required Arduino Libraries

Open **Arduino IDE** -> **Tools** -> **Manage Libraries...** and install the exact following packages:

1. **SparkFun MAX3010x Pulse and Proximity Sensor Library** by *SparkFun Electronics*
2. **Adafruit SSD1306** by *Adafruit* (accept all dependencies: *Adafruit GFX Library*, *Adafruit BusIO*)
3. **OneWire** by *Paul Stoffregen*
4. **DallasTemperature** by *Miles Burton*
5. **ArduinoJson** by *Benoit Blanchon* (Version 7.x or 6.x supported)

*Note: `WiFi.h`, `HTTPClient.h`, `WiFiClientSecure.h`, `mbedtls/md.h`, and `Preferences.h` are built directly into the ESP32 Arduino Core.*

---

## 6. Exact Steps to Flash the ESP32

1. **Configure Environment:**
   - In Arduino IDE, go to **Tools** -> **Board** -> **esp32** -> **ESP32 Dev Module**.
   - **Upload Speed:** `921600` (or `115200` if your USB-to-UART cable has signal dropouts).
   - **Flash Frequency:** `80MHz`.
   - **Partition Scheme:** `Default 4MB with spiffs` (or `Minimal SPIFFS`).
   - **Port:** Select your COM port (e.g., `COM3`, `COM5` on Windows or `/dev/ttyUSB0` on Linux/Mac).

2. **Configure Wi-Fi & Server IP:**
   - Open `firmware/pulsecare_esp32/config.h`.
   - Set `WIFI_SSID` and `WIFI_PASSWORD` to your local network.
   - Set `API_BASE_URL` to your backend machine's LAN IP (e.g., `"http://192.168.1.100:5000"`).

3. **Compile & Flash:**
   - Click **Verify** (checkmark). Verify compilation finishes cleanly.
   - Hold the **BOOT** button on the ESP32 DevKit if the terminal says `Connecting........_____.....`.
   - Release **BOOT** when upload percentage begins writing.
   - Click **Serial Monitor** and set baud rate to **`115200 baud`**.

---

## 7. Device Pairing & Telemetry Walkthrough

1. **Open Hospital Admin UI:**
   - Log in as Doctor or Admin at `http://localhost:5173`.
   - Navigate to **Hardware Devices** (`/doctor/devices`).
   - Click **Register New Device**. Enter label (e.g., `ICU Bed 1 Hub`).
   - Note the **6-digit pairing code** (e.g., `849201`). It is valid for 15 minutes.

2. **Pair the ESP32:**
   - In the Arduino IDE Serial Monitor (at 115200 baud), you will see:
     ```text
     ⚠️  [DEVICE NOT PAIRED]
     Send command in Serial monitor: PAIR:<code> (e.g. PAIR:849201)
     ```
   - Type in the Serial input box: `PAIR:849201` and press **Enter**.
   - The ESP32 will contact `/api/device/pair`, receive its 64-character cryptographic `deviceKey`, and save it permanently in ESP32 NVS (Non-Volatile Storage).
   - The device will emit two confirmation beeps and transition to **ACTIVE STANDBY**.

3. **Assign to Patient & Stream Live:**
   - In the web dashboard, click **Assign** or **Start Session** on the device row.
   - Select patient (e.g., `PC-DEMO01`) and click **Begin Telemetry Stream**.
   - Place your finger on the MAX30102 sensor.
   - The OLED will immediately show live BPM, SpO2 %, and Temperature, while the web dashboard charts display real-time waveforms!

---

## 8. Common Errors & Troubleshooting Checklist

| Symptom | Probable Cause | Fix / Resolution |
| :--- | :--- | :--- |
| **Brownout detector was triggered** | Insufficient current on USB port when Wi-Fi transmits bursts | Connect ESP32 to a dedicated 5V 2A USB wall adapter or powered USB 3.0 hub. Add a 100 µF capacitor across 3.3V and GND. |
| **`[OLED] SSD1306 allocation failed`** | I2C bus wiring loose or wrong address | Verify SDA is on GPIO21 and SCL on GPIO22. Run an I2C scanner sketch to verify if the address is `0x3C` or `0x3D`. |
| **`[Sensors] MAX30102 not detected`** | Sensor not receiving 3.3V or bad pull-ups | Check 3.3V wiring. Ensure breakout board has clean solder joints on SDA/SCL. |
| **DS18B20 returns `-127.0 °C`** | Missing 4.7 kΩ pull-up resistor or disconnected probe | Install a 4.7 kΩ resistor between DATA (GPIO4) and 3.3V. Check that cable ground is securely connected. |
| **Pairing Fails (HTTP 401/400)** | Code expired (15m window) or typo | Re-generate pairing code in the UI and enter `PAIR:<code>` within 15 minutes. |
| **HTTP 409 `no_active_session`** | Device paired but doctor has not started patient session | Start a monitoring session pairing this device ID with a patient in the web dashboard. |
| **`[NTP] Initial sync failed`** | Router blocking UDP port 123 | Verify router allows NTP UDP traffic. In `network.h`, fallback servers `time.google.com` and `time.nist.gov` are enabled. |
