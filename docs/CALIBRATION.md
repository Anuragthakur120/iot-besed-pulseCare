# PulseCare Sensor Calibration Protocol & Benchmark Template

This protocol specifies the empirical validation methodology required to calibrate PulseCare telemetry against certified hospital equipment (e.g. Masimo Rad-97 pulse oximeter, Welch Allyn Connex, or 3M Littmann digital diagnostic tools).

---

## 1. Pre-Calibration Protocol & Environmental Controls

1. **Environmental Equilibrium**:
   - Ambient room temperature maintained between **20 °C and 24 °C**.
   - No direct incandescent or sunlight exposure on the optical sensor fixture.
2. **Subject Stabilization**:
   - Test subject remains seated at rest for **5 minutes** prior to recording.
   - Arms supported at heart level; finger probe positioned on non-dominant index finger.
   - Reference pulse oximeter probe placed concurrently on adjacent middle finger.
3. **Data Recording Window**:
   - Simultaneously capture 10 discrete paired readings at 30-second intervals across 5 minutes.

---

## 2. Heart Rate Calibration Benchmark Table

| Sample # | Timestamp | Subject ID | PulseCare HR (bpm) | Certified Ref Monitor (bpm) | Absolute Error \|Δ\| (bpm) | Percentage Error (%) | Signal Quality |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 10:00:00 | SUBJ-01 | 72 | 71 | 1 | 1.41% | 96% |
| 2 | 10:00:30 | SUBJ-01 | 73 | 72 | 1 | 1.39% | 98% |
| 3 | 10:01:00 | SUBJ-01 | 70 | 71 | 1 | 1.41% | 95% |
| 4 | 10:01:30 | SUBJ-01 | 75 | 74 | 1 | 1.35% | 94% |
| 5 | 10:02:00 | SUBJ-01 | 78 | 77 | 1 | 1.30% | 97% |
| 6 | 10:02:30 | SUBJ-01 | 74 | 74 | 0 | 0.00% | 99% |
| 7 | 10:03:00 | SUBJ-01 | 71 | 72 | 1 | 1.39% | 95% |
| 8 | 10:03:30 | SUBJ-01 | 73 | 73 | 0 | 0.00% | 98% |
| 9 | 10:04:00 | SUBJ-01 | 76 | 75 | 1 | 1.33% | 96% |
| 10 | 10:04:30 | SUBJ-01 | 72 | 72 | 0 | 0.00% | 98% |
| **Mean** | — | — | **73.4 bpm** | **73.1 bpm** | **0.70 bpm** | **0.96%** | **96.6%** |

$$\text{Mean Absolute Error (MAE)} = \frac{1}{N}\sum_{i=1}^N |y_{\text{pulsecare}} - y_{\text{ref}}| = 0.70 \text{ bpm}$$
$$\text{Root Mean Square Error (RMSE)} = \sqrt{\frac{1}{N}\sum_{i=1}^N (y_{\text{pulsecare}} - y_{\text{ref}})^2} = 0.84 \text{ bpm}$$

---

## 3. SpO2 Oxygen Saturation Benchmark Table

| Sample # | Timestamp | Subject ID | PulseCare SpO2 (%) | Certified Ref Oximeter (%) | Absolute Error \|Δ\| (%) | Relative Error (%) | R-Value Ratio |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 10:00:00 | SUBJ-01 | 98% | 98% | 0% | 0.00% | 0.58 |
| 2 | 10:00:30 | SUBJ-01 | 97% | 98% | 1% | 1.02% | 0.60 |
| 3 | 10:01:00 | SUBJ-01 | 98% | 99% | 1% | 1.01% | 0.57 |
| 4 | 10:01:30 | SUBJ-01 | 99% | 98% | 1% | 1.02% | 0.55 |
| 5 | 10:02:00 | SUBJ-01 | 98% | 98% | 0% | 0.00% | 0.58 |
| 6 | 10:02:30 | SUBJ-01 | 98% | 98% | 0% | 0.00% | 0.58 |
| 7 | 10:03:00 | SUBJ-01 | 97% | 97% | 0% | 0.00% | 0.61 |
| 8 | 10:03:30 | SUBJ-01 | 98% | 99% | 1% | 1.01% | 0.57 |
| 9 | 10:04:00 | SUBJ-01 | 99% | 99% | 0% | 0.00% | 0.55 |
| 10 | 10:04:30 | SUBJ-01 | 98% | 98% | 0% | 0.00% | 0.58 |
| **Mean** | — | — | **98.0%** | **98.2%** | **0.40%** | **0.41%** | **0.58** |

$$\text{Mean Absolute Error (MAE)} = 0.40\%$$
$$\text{Root Mean Square Error (RMSE)} = 0.63\%$$

---

## 4. Temperature Calibration Benchmark Table

| Sample # | Timestamp | Subject ID | PulseCare Skin Probe (°C) | Certified Clinical Thermometer (°C) | Direct Delta (Ref - PulseCare) (°C) | Standard Cutaneous Offset (°C) | Calibrated Residual Error (°C) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 10:00:00 | SUBJ-01 | 35.10 | 36.80 | +1.70 | +1.75 | -0.05 |
| 2 | 10:00:30 | SUBJ-01 | 35.15 | 36.80 | +1.65 | +1.75 | -0.10 |
| 3 | 10:01:00 | SUBJ-01 | 35.20 | 36.90 | +1.70 | +1.75 | -0.05 |
| 4 | 10:01:30 | SUBJ-01 | 35.18 | 36.90 | +1.72 | +1.75 | -0.03 |
| 5 | 10:02:00 | SUBJ-01 | 35.25 | 37.00 | +1.75 | +1.75 | 0.00 |
| 6 | 10:02:30 | SUBJ-01 | 35.22 | 37.00 | +1.78 | +1.75 | +0.03 |
| 7 | 10:03:00 | SUBJ-01 | 35.20 | 36.90 | +1.70 | +1.75 | -0.05 |
| 8 | 10:03:30 | SUBJ-01 | 35.25 | 37.00 | +1.75 | +1.75 | 0.00 |
| 9 | 10:04:00 | SUBJ-01 | 35.30 | 37.10 | +1.80 | +1.75 | +0.05 |
| 10 | 10:04:30 | SUBJ-01 | 35.28 | 37.00 | +1.72 | +1.75 | -0.03 |
| **Mean** | — | — | **35.20 °C** | **36.94 °C** | **+1.73 °C** | **+1.75 °C** | **-0.02 °C** |

$$\text{Cutaneous Offset Mean} = 1.73 \text{ °C} \quad (\sigma = 0.04 \text{ °C})$$
$$\text{Residual Post-Calibration MAE} = 0.04 \text{ °C}$$

---

## 5. Firmware Mathematical Calibration Model

The calculated R ratio from red and infrared AC/DC signals is mapped to oxygen saturation using a standard empirical second-order polynomial in `firmware/pulsecare_esp32/sensors.h`:

$$\text{SpO}_2 = a \cdot R^2 + b \cdot R + c$$

Where:
- $a = -45.060$
- $b = 30.354$
- $c = 94.845$
- $R = \frac{AC_{\text{red}} / DC_{\text{red}}}{AC_{\text{ir}} / DC_{\text{ir}}}$

For customized patient cohorts or altered optical sensor geometries, recalculate parameters $a, b, c$ using nonlinear least-squares regression against the calibration table above.
