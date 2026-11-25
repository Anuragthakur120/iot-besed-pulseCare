# PulseCare System Limitations & Clinical Disclaimer

> [!WARNING]
> **REGULATORY STATUS & NON-MEDICAL DEVICE DISCLAIMER**
> PulseCare is an academic engineering demonstration and research prototype. It is **NOT** a certified Class IIa/IIb medical device under the US FDA, EU Medical Device Regulation (MDR 2017/745), or equivalent national health authorities. It is **NOT** designed, manufactured, or intended for primary clinical diagnosis, automated therapeutic intervention, or life-support monitoring. Professional medical judgments must always be verified using certified hospital equipment.

---

## 1. Photoplethysmography (SpO2 & Heart Rate) Accuracy Boundaries

PulseCare utilizes the Maxim Integrated **MAX30102** reflective optical sensor. The sensor projects red (660 nm) and infrared (880 nm) light through capillary beds and measures variations in reflected absorbance.

### Factors Limiting Measurement Accuracy:
1. **Motion Artifacts**:
   - Patient movement, hand tremors, or ambulation induce substantial baseline drift in optical photodiode signals.
   - While the firmware implements a peak-detection derivative filter, vigorous motion can lead to false bradycardia or tachycardia readings.
2. **Ambient Light Interference**:
   - Unshielded sensors exposed to sunlight, fluorescent tubes, or surgical lamps can saturate the photodiode amplifier, degrading the signal-to-noise ratio (SNR).
   - *Mitigation*: The optical probe must be fitted with an opaque finger cuff or 3D-printed enclosure.
3. **Peripheral Hypoperfusion**:
   - In patients presenting with vasoconstriction, hypothermia, severe hypotension, or shock, peripheral arterial pulsation is severely attenuated.
   - The MAX30102 algorithm will flag low signal quality (`signalQuality < 50`) and print `"Not available"` rather than guessing inaccurate values.
4. **Pigmentation & Nail Polish**:
   - Dark nail polish (especially blue, green, and black pigments) absorbs 660 nm red light, artificially depressing calculated SpO2.
   - Significant epidermal melanin concentration alters optical scattering coefficients; empirical calibration adjustments are necessary.

---

## 2. Digital Temperature Sensing Limits (DS18B20)

The Dallas/Maxim **DS18B20** digital temperature sensor operates via 1-Wire protocol with 12-bit analog-to-digital resolution (0.0625 °C increments).

### Accuracy Boundaries:
1. **Manufacturer Tolerance**:
   - Certified factory accuracy is **±0.5 °C** across the clinical range of 0 °C to +70 °C.
   - Highly sensitive clinical fever detection requiring ±0.1 °C precision necessitates high-grade thermistor probes rather than general 1-Wire sensors.
2. **Core vs. Peripheral Skin Surface Offset**:
   - The waterproof DS18B20 probe attached to the patient's forearm, wrist, or finger measures **peripheral cutaneous skin temperature**.
   - Peripheral skin temperature naturally fluctuates based on ambient room temperature, peripheral perfusion, and perspiration, running **1.5 °C to 2.5 °C lower** than sublingual oral or core tympanic temperature.
   - PulseCare reports skin temperature directly without applying unverified heuristic multipliers.
3. **Thermal Mass & Response Time**:
   - The stainless steel probe enclosure requires approximately **45 to 60 seconds** to reach thermal equilibrium with skin tissue upon placement. Rapid temperature spikes will exhibit a delayed response curve.

---

## 3. Sensor Placement & Ergonomics

| Sensor | Optimal Placement | Common Placement Fault | Consequence |
| :--- | :--- | :--- | :--- |
| **MAX30102** | Index or middle fingertip (palmar side) | Excessive probe clip tightness | Venous pulsation occlusion; falsely depressed SpO2 |
| **MAX30102** | Fingertip | Loose fit with ambient light gap | Optical saturation; false pulse rates |
| **DS18B20** | Medial aspect of inner forearm or axillary | Exposed to air currents | Under-reporting temperature by 2 °C – 3 °C |

---

## 4. Telemetry Latency & Connectivity Bounds

1. **Wi-Fi Transport**:
   - Network transmission depends on hospital 2.4 GHz Wi-Fi signal strength (RSSI > -75 dBm recommended).
   - In dead zones, the ESP32 buffers up to 300 telemetry points in memory. When reconnecting, burst transmission can cause a brief visual delay in real-time graphs.
2. **Server-Side Downsampling**:
   - For historical ranges exceeding 1000 data points, the server downsamples telemetry using min-max time bucket decimation. This preserves peak alert anomalies while limiting client memory consumption.
