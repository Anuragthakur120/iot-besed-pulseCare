/**
 * PulseCare Hardware Simulator
 * Simulates a bedside IoT vital signs monitor (MAX30102 + DS18B20)
 * Sends telemetry to PulseCare API at http://localhost:5000/api/devices/ingest
 */

const API_URL = process.env.API_URL || 'http://localhost:5000/api/devices/ingest';
const DEVICE_ID = process.env.DEVICE_ID || 'PCD-0001';
const DEVICE_KEY = process.env.DEVICE_KEY || 'dev_pcd_0001_raw_secret_token_2026';
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || '1000', 10);

console.log('======================================================');
console.log(' PulseCare IoT Device Simulator');
console.log(` Target Device: ${DEVICE_ID}`);
console.log(` Ingestion URL: ${API_URL}`);
console.log(` Rate:          Every ${INTERVAL_MS}ms`);
console.log(' Press Ctrl+C to terminate simulation');
console.log('======================================================\n');

let seq = 1;
let angle = 0;
let fingerAttached = true;

// Occasional anomaly injection flag via command-line args
const injectAnomaly = process.argv.includes('--anomaly');

async function sendTelemetry() {
  angle += 0.1;

  // Natural biological oscillation
  const baseHr = 74;
  const hrSine = Math.sin(angle) * 6;
  const hrNoise = (Math.random() - 0.5) * 3;
  let heartRate = Math.round(baseHr + hrSine + hrNoise);

  let spo2 = Math.round(97 + Math.sin(angle * 0.5) * 1.5 + (Math.random() - 0.5));
  let temperatureC = Math.round((36.8 + Math.sin(angle * 0.2) * 0.3 + (Math.random() - 0.5) * 0.1) * 10) / 10;
  let signalQuality = Math.round(94 + Math.random() * 5);

  if (injectAnomaly) {
    // Inject simulated tachycardia or desaturation for alert testing
    if (seq % 15 === 0) {
      heartRate = 135; // HR_HIGH trigger
      console.log('⚠️ [Simulator] Injecting simulated HR_HIGH spike: 135 bpm');
    } else if (seq % 25 === 0) {
      spo2 = 88; // SPO2_LOW trigger
      console.log('⚠️ [Simulator] Injecting simulated SPO2_LOW drop: 88%');
    }
  }

  const payload = {
    deviceId: DEVICE_ID,
    deviceKey: DEVICE_KEY,
    heartRate: fingerAttached ? heartRate : null,
    spo2: fingerAttached ? spo2 : null,
    temperatureC,
    fingerDetected: fingerAttached,
    signalQuality: fingerAttached ? signalQuality : 10,
    seq: seq++,
    isDemo: true,
    ts: new Date().toISOString()
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': DEVICE_ID,
        'x-device-key': DEVICE_KEY
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ [HTTP ${response.status}] ${result.error || 'Failed to post reading'}`);
      return;
    }

    if (result.data?.paired === false) {
      process.stdout.write(`\r⏳ [Standby] Device ${DEVICE_ID} authenticated. Waiting for clinician to start session in UI...`);
    } else {
      const alertNotice = result.data?.alertsTriggered > 0 ? `🚨 ${result.data.alertsTriggered} ALERT!` : '';
      console.log(
        `📡 [Seq #${payload.seq}] HR: ${payload.heartRate ?? '--'} bpm | SpO2: ${payload.spo2 ?? '--'}% | Temp: ${payload.temperatureC ?? '--'}°C | Quality: ${payload.signalQuality}% ${alertNotice}`
      );
    }
  } catch (err) {
    console.error(`❌ [Connection Error] Unable to reach backend at ${API_URL}:`, err.message);
  }
}

// Start simulation loop
const timer = setInterval(sendTelemetry, INTERVAL_MS);

// Handle graceful exit
process.on('SIGINT', () => {
  clearInterval(timer);
  console.log('\n[Simulator] Hardware simulation stopped cleanly.');
  process.exit(0);
});
