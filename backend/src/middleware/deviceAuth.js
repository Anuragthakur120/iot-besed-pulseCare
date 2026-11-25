import crypto from 'node:crypto';
import { Device } from '@pulsecare/database';
import { decryptSecret, calculateDeviceHmac, hashSecret } from '../utils/crypto.js';
import bcrypt from 'bcryptjs';

// In-memory Nonce Cache with TTL for replay prevention
const nonceCache = new Map(); // key: `${deviceId}:${nonce}`, value: expiresAt (ms)

// Prune expired nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, expiresAt] of nonceCache.entries()) {
    if (expiresAt < now) {
      nonceCache.delete(key);
    }
  }
}, 60000);

// In-memory per-device rate limiter (max 120 requests per minute)
const rateLimitMap = new Map(); // key: deviceId, value: { count, resetAt }

function checkDeviceRateLimit(deviceId) {
  const now = Date.now();
  const record = rateLimitMap.get(deviceId);

  if (!record || record.resetAt < now) {
    rateLimitMap.set(deviceId, { count: 1, resetAt: now + 60000 });
    return true;
  }

  if (record.count >= 120) {
    return false;
  }

  record.count += 1;
  return true;
}

/**
 * Middleware: Verify Device HMAC-SHA256 Signature, Nonce, and Timestamp
 */
export async function authenticateDevice(req, res, next) {
  try {
    const rawDeviceId = req.headers['x-device-id'] || req.body?.deviceId;
    const rawTimestamp = req.headers['x-timestamp'];
    const rawNonce = req.headers['x-nonce'];
    const rawSignature = req.headers['x-signature'];

    if (!rawDeviceId) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Missing required header: X-Device-Id'
      });
    }

    const deviceId = String(rawDeviceId).trim().toUpperCase();

    // 1. Per-Device Rate Limiting
    if (!checkDeviceRateLimit(deviceId)) {
      return res.status(429).json({
        success: false,
        data: null,
        error: `Rate limit exceeded for device ${deviceId}. Maximum 120 requests/minute.`
      });
    }

    // 2. Fetch Device Record
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Device ${deviceId} is not registered`
      });
    }

    // 3. Status Gate (Reject revoked devices immediately)
    if (device.status === 'revoked') {
      return res.status(403).json({
        success: false,
        data: null,
        error: `Device ${deviceId} authorization has been revoked`
      });
    }

    if (device.status !== 'active') {
      return res.status(403).json({
        success: false,
        data: null,
        error: `Device ${deviceId} is pending activation or pairing`
      });
    }

    // Backward compatibility fallback for simple tests/simulators passing x-device-key
    const legacyDeviceKey = req.headers['x-device-key'] || req.body?.deviceKey;
    if (legacyDeviceKey && !rawSignature) {
      let isLegacyMatch = false;
      if (device.encryptedKey) {
        const secret = decryptSecret(device.encryptedKey);
        isLegacyMatch = secret === legacyDeviceKey;
      }
      if (!isLegacyMatch && device.credentialHash) {
        if (device.credentialHash.startsWith('$2')) {
          isLegacyMatch = await bcrypt.compare(legacyDeviceKey, device.credentialHash);
        } else {
          isLegacyMatch = hashSecret(legacyDeviceKey) === device.credentialHash;
        }
      }

      if (!isLegacyMatch) {
        return res.status(401).json({
          success: false,
          data: null,
          error: 'Invalid legacy device credentials'
        });
      }

      req.device = device;
      return next();
    }

    // 4. Verify HMAC Security Headers Presence
    if (!rawTimestamp || !rawNonce || !rawSignature) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Missing required device security headers (X-Timestamp, X-Nonce, X-Signature)'
      });
    }

    // 5. Check Timestamp Clock Drift (within 60 seconds)
    const reqTimestamp = parseInt(rawTimestamp, 10);
    const currentSeconds = Math.floor(Date.now() / 1000);

    if (isNaN(reqTimestamp) || Math.abs(currentSeconds - reqTimestamp) > 60) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Timestamp expired or clock drift exceeds 60 seconds'
      });
    }

    // 6. Replay Protection: Check Nonce Uniqueness
    const nonceKey = `${deviceId}:${rawNonce}`;
    if (nonceCache.has(nonceKey)) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Replay attack detected: Nonce has already been consumed'
      });
    }
    // Record nonce with 120s TTL
    nonceCache.set(nonceKey, Date.now() + 120000);

    // 7. Decrypt or Retrieve Device Key
    let deviceKey = null;
    if (device.encryptedKey) {
      deviceKey = decryptSecret(device.encryptedKey);
    }

    if (!deviceKey) {
      return res.status(500).json({
        success: false,
        data: null,
        error: 'Device cryptographic key is unrecoverable. Please re-pair the device.'
      });
    }

    // 8. Verify HMAC-SHA256 Signature
    // Signature = HMAC-SHA256(deviceKey, method + path + timestamp + nonce + sha256(body))
    const expectedSignature = calculateDeviceHmac(
      deviceKey,
      req.method,
      req.originalUrl || req.url,
      rawTimestamp,
      rawNonce,
      req.body
    );

    const sigBufferA = Buffer.from(String(rawSignature).toLowerCase(), 'hex');
    const sigBufferB = Buffer.from(expectedSignature.toLowerCase(), 'hex');

    if (sigBufferA.length !== sigBufferB.length || !crypto.timingSafeEqual(sigBufferA, sigBufferB)) {
      return res.status(401).json({
        success: false,
        data: null,
        error: 'Invalid cryptographic signature (HMAC-SHA256 mismatch)'
      });
    }

    // Security checks passed! Attach device
    req.device = device;
    next();
  } catch (error) {
    next(error);
  }
}

export default { authenticateDevice };
