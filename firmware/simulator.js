/**
 * PulseCare ESP32 Hardware Bedside Simulator
 * Simulates real-time clinical vital sign streaming with HMAC-SHA256 signatures,
 * timestamps, nonces, and realistic physiological waveforms (HR, SpO2, Temperature).
 */
import crypto from 'node:crypto';

export class DeviceSimulator {
  constructor({
    apiUrl = 'http://localhost:5000',
    deviceId = 'PCD-0001',
    deviceKey = 'mock-device-secret-key-123456789012345678',
    sessionId = null,
    intervalMs = 1000,
    vitalProfile = 'normal' // 'normal' | 'tachycardia' | 'hypoxia' | 'fever'
  } = {}) {
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.deviceId = deviceId.toUpperCase();
    this.deviceKey = deviceKey;
    this.sessionId = sessionId;
    this.intervalMs = intervalMs;
    this.vitalProfile = vitalProfile;
    this.seq = 1;
    this.timer = null;
    this.isRunning = false;
  }

  generateReading() {
    let hrBase = 72;
    let spo2Base = 98;
    let tempBase = 36.8;

    if (this.vitalProfile === 'tachycardia') {
      hrBase = 125;
    } else if (this.vitalProfile === 'hypoxia') {
      spo2Base = 88;
    } else if (this.vitalProfile === 'fever') {
      tempBase = 39.2;
    }

    // Add natural clinical jitter
    const hr = Math.round(hrBase + (Math.sin(this.seq / 5) * 4) + (Math.random() * 2 - 1));
    const spo2 = Math.min(100, Math.round(spo2Base + (Math.sin(this.seq / 8) * 1) + (Math.random() * 0.8 - 0.4)));
    const tempC = parseFloat((tempBase + (Math.sin(this.seq / 10) * 0.15) + (Math.random() * 0.05)).toFixed(2));

    return {
      seq: this.seq++,
      ts: Date.now(),
      heartRate: hr,
      spo2: spo2,
      temperatureC: tempC,
      fingerDetected: true,
      signalQuality: 95,
      sessionId: this.sessionId
    };
  }

  signRequest(method, path, bodyString) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
    const canonicalString = `${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${bodyHash}`;
    const signature = crypto.createHmac('sha256', this.deviceKey).update(canonicalString).digest('hex');

    return {
      'Content-Type': 'application/json',
      'X-Device-Id': this.deviceId,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Signature': signature,
      'X-Device-Key': this.deviceKey
    };
  }

  async sendReading(reading) {
    const payload = reading || this.generateReading();
    const bodyString = JSON.stringify(payload);
    const headers = this.signRequest('POST', '/api/device/readings', bodyString);

    try {
      const response = await fetch(`${this.apiUrl}/api/device/readings`, {
        method: 'POST',
        headers,
        body: bodyString
      });
      const data = await response.json();
      return { success: response.ok, status: response.status, data, reading: payload };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  start(onReadingSent) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(async () => {
      const res = await this.sendReading();
      if (onReadingSent) onReadingSent(res);
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
}

// Standalone CLI execution
if (process.argv[1]?.endsWith('simulator.js')) {
  const args = process.argv.slice(2);
  const getArg = (flag, def) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
  };

  const deviceId = getArg('--deviceId', 'PCD-0001');
  const deviceKey = getArg('--deviceKey', 'mock-device-secret-key-123456789012345678');
  const apiUrl = getArg('--url', 'http://localhost:5000');
  const sessionId = getArg('--sessionId', null);

  const sim = new DeviceSimulator({ deviceId, deviceKey, apiUrl, sessionId });
  console.log(`[PulseCare Simulator] Streaming vitest telemetry for ${deviceId} to ${apiUrl}...`);

  sim.start((result) => {
    if (result.success) {
      console.log(`[Simulator Seq #${result.reading.seq}] HR: ${result.reading.heartRate} bpm | SpO2: ${result.reading.spo2}% | Temp: ${result.reading.temperatureC}°C -> Sent OK`);
    } else {
      console.warn(`[Simulator] Transmit failed:`, result.error || result.data);
    }
  });

  process.on('SIGINT', () => {
    sim.stop();
    console.log('[Simulator] Stopped.');
    process.exit(0);
  });
}
