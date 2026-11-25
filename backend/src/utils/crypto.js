import crypto from 'node:crypto';
import env from '../config/env.js';

const MASTER_KEY = crypto
  .createHash('sha256')
  .update(env.JWT_ACCESS_SECRET)
  .digest();

/**
 * Encrypt a device key using AES-256-GCM
 * @param {string} plainText
 * @returns {string} iv:authTag:encrypted
 */
export function encryptSecret(plainText) {
  if (!plainText) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a device key using AES-256-GCM
 * @param {string} encryptedBlob
 * @returns {string}
 */
export function decryptSecret(encryptedBlob) {
  if (!encryptedBlob) return null;
  const [ivHex, authTagHex, encrypted] = encryptedBlob.split(':');
  if (!ivHex || !authTagHex || !encrypted) return null;

  const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * SHA-256 hash helper
 * @param {string} text
 * @returns {string} hex digest
 */
export function hashSecret(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Calculate HMAC-SHA256 signature for device requests
 * Signature = HMAC-SHA256(deviceKey, method + path + timestamp + nonce + sha256(body))
 */
export function calculateDeviceHmac(deviceKey, method, path, timestamp, nonce, body) {
  const normalizedMethod = (method || 'GET').toUpperCase();
  const normalizedPath = (path || '').split('?')[0]; // exclude query string
  let bodyString = '';
  if (normalizedMethod !== 'GET' && body) {
    if (typeof body === 'object' && Object.keys(body).length > 0) {
      bodyString = JSON.stringify(body);
    } else if (typeof body === 'string') {
      bodyString = body;
    }
  }
  const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');

  const message = `${normalizedMethod}${normalizedPath}${timestamp}${nonce}${bodyHash}`;
  return crypto.createHmac('sha256', deviceKey).update(message).digest('hex');
}

export default {
  encryptSecret,
  decryptSecret,
  hashSecret,
  calculateDeviceHmac
};
