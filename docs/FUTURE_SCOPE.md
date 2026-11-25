# PulseCare Future Scope & Engineering Roadmap

This roadmap outlines planned hardware enhancements, transport protocol upgrades, and machine learning architectures targeted for subsequent revisions of PulseCare.

---

## 1. Electrocardiogram (ECG) Subsystem Integration (AD8232)

- **Hardware Component**: Analog Devices **AD8232** Single-Lead Heart Rate Monitor Front-End.
- **Circuit Integration**:
  - Connects to ESP32 ADC1 (GPIO36 / VP) via an analog low-pass filter (0.5 Hz – 40 Hz bandwidth).
  - Digital leads-off detection inputs (`LO+` on GPIO34, `LO-` on GPIO35) to instantly alert clinicians if an electrode detaches.
- **Clinical Advantage**: Provides true electrical vector P-Q-R-S-T morphology, enabling real-time detection of premature ventricular contractions (PVCs), atrial fibrillation (AFib), and ST-segment elevation.

---

## 2. 6-Axis Inertial Measurement & Fall Detection (MPU6050)

- **Hardware Component**: InvenSense **MPU6050** 3-axis accelerometer and 3-axis gyroscope over shared I2C bus (`0x68`).
- **Algorithm Architecture**:
  - FreeRTOS interrupt task running at 50 Hz.
  - Three-stage fall detection state machine:
    1. *Free-fall Stage*: Acceleration magnitude drops below $0.5g$ for $> 80\text{ ms}$.
    2. *Impact Stage*: Peak vector impact exceeds $3.0g$.
    3. *Post-fall Inactivity Stage*: Zero acceleration differential for $> 5\text{ seconds}$.
- **Emergency Escalation**: Automatically opens a CRITICAL alarm and dispatches emergency SMS to contacts.

---

## 3. Bluetooth Low Energy (BLE 5.0) Ambulation Mode

- **Rationale**: When patients leave the hospital ward bed for physical therapy or radiological scans, Wi-Fi coverage may drop.
- **BLE GATT Profile**:
  - Custom UUID service: `PulseCare Clinical Telemetry Service`.
  - Characteristics: `HeartRateMeasurement`, `OxygenSaturation`, `SkinTemperature`.
- **Hybrid Gateway**: Patient smartphones or bedside tablets act as mobile edge gateways, collecting BLE packets and relaying them over 4G/5G back to the Express cluster.

---

## 4. MQTT / Mosquitto Message Broker Transport

- **Transition**: Migrate high-density ward deployments from HTTP polling/posting to **MQTT v5.0** over TLS.
- **Benefits**:
  - Extremely compact packet overhead (2-byte header vs. 400-byte HTTP header).
  - Built-in Quality of Service (QoS 1: At least once delivery).
  - Last Will and Testament (LWT) messages trigger instant `"DISCONNECTED"` status pills if an ESP32 loses power abruptly.
- **Topic Hierarchy**: `hospital/ward-3/bed-12/telemetry`.

---

## 5. Machine Learning & Predictive Deterioration (TinyML / Server)

1. **Edge Anomaly Filtering (TinyML / TensorFlow Lite for Microcontrollers)**:
   - Quantized INT8 neural model running in ESP32 Core 0 memory.
   - Filters out motion artifact noise before packet transmission, saving battery and network bandwidth.
2. **Server-Side Predictive Early Warning Scores (NEWS2 / Autoencoder)**:
   - LSTM neural network analyzes rolling 6-hour windows of heart rate variability (HRV), pulse wave transit time, and temperature trends.
   - Detects septic shock and respiratory failure patterns **2 to 4 hours before acute clinical decompensation**.

---

## 6. Over-The-Air (OTA) Cryptographic Firmware Updates

- **Flash Partitioning**: Configured with dual OTA slots (`ota_0`, `ota_1`) and a rollback bootloader.
- **Cryptographic Verification**: Firmware binaries are signed with an Ed25519 private key. The ESP32 bootloader verifies the digital signature before flashing the new partition.
- **Zero-Touch Rollout**: The admin dashboard allows selecting active bedside devices and pushing firmware updates remotely without touching physical hardware.
