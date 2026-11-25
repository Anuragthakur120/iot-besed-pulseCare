# PulseCare ESP32 Hardware Firmware

This directory will contain the ESP32 C++ firmware (using ESP-IDF or Arduino FreeRTOS) for bedside and wearable multi-sensor telemetry nodes.

## Planned Sensors:
- MAX30102 / MAX30100 (Pulse Oximetry & Heart Rate)
- DS18B20 / MLX90614 (Body Temperature)
- AD8232 (Single-lead ECG monitoring)
- MPU6050 (Patient Fall Detection & Motion)
- Emergency Nurse Call Button
- Buzzer & RGB Status Indicator

## Planned Telemetry Protocols:
- MQTT / WebSockets to PulseCare Backend
- TLS encryption with HMAC device authentication
- Offline ring-buffer flash storage for network outages
