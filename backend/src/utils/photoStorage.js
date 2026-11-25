import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';
import env from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/profiles');

// Ensure local upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Verify buffer against magic bytes for JPEG, PNG, and WebP
 * @param {Buffer} buffer
 * @returns {'image/jpeg'|'image/png'|'image/webp'|null}
 */
export function verifyImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  // WebP: RIFF ... WEBP
  const isRiff = buffer.toString('utf8', 0, 4) === 'RIFF';
  const isWebp = buffer.toString('utf8', 8, 12) === 'WEBP';
  if (isRiff && isWebp) {
    return 'image/webp';
  }

  return null;
}

/**
 * Sanitize, resize to 512px, strip EXIF metadata, and save image securely
 * @param {Buffer} rawBuffer
 * @returns {Promise<{ storageKey: string, mimeType: string, size: number, filePath: string }>}
 */
export async function processAndStoreProfilePhoto(rawBuffer) {
  const detectedMime = verifyImageMagicBytes(rawBuffer);
  if (!detectedMime) {
    throw new Error('File signature verification failed: Only authentic JPEG, PNG, or WebP images are permitted.');
  }

  // Re-encode with sharp: strips EXIF metadata, resizes to 512x512, converts to WebP
  const processedBuffer = await sharp(rawBuffer)
    .resize(512, 512, { fit: 'cover', position: 'center' })
    .rotate() // auto-orient based on EXIF before stripping
    .webp({ quality: 85 })
    .toBuffer();

  const storageKey = `photo_${crypto.randomUUID()}.webp`;
  const filePath = path.join(UPLOAD_DIR, storageKey);

  await fs.promises.writeFile(filePath, processedBuffer);

  return {
    storageKey,
    mimeType: 'image/webp',
    size: processedBuffer.length,
    filePath
  };
}

/**
 * Remove stored photo by storageKey
 * @param {string} storageKey
 */
export async function deleteProfilePhoto(storageKey) {
  if (!storageKey) return;
  const filePath = path.join(UPLOAD_DIR, storageKey);
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (err) {
    console.error(`[Photo Storage] Failed to delete file ${storageKey}:`, err.message);
  }
}

/**
 * Generate 5-minute signed URL for authenticated photo retrieval
 * @param {string} patientId
 * @param {string} storageKey
 * @returns {string} Signed URL
 */
export function generateSignedPhotoUrl(patientId, storageKey) {
  if (!storageKey) return null;
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  const signature = crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${patientId}:${storageKey}:${expiresAt}`)
    .digest('hex');

  return `/api/patients/${patientId}/photo?key=${storageKey}&exp=${expiresAt}&sig=${signature}`;
}

/**
 * Validate signed URL parameters
 * @param {string} patientId
 * @param {string} storageKey
 * @param {string|number} expiresAt
 * @param {string} signature
 * @returns {boolean}
 */
export function verifySignedPhotoUrl(patientId, storageKey, expiresAt, signature) {
  if (!storageKey || !expiresAt || !signature) return false;
  const expNum = parseInt(expiresAt, 10);
  if (isNaN(expNum) || expNum < Date.now()) return false;

  const expectedSig = crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(`${patientId}:${storageKey}:${expNum}`)
    .digest('hex');

  return expectedSig === signature;
}

export function getPhotoFilePath(storageKey) {
  return path.join(UPLOAD_DIR, storageKey);
}

export default {
  verifyImageMagicBytes,
  processAndStoreProfilePhoto,
  deleteProfilePhoto,
  generateSignedPhotoUrl,
  verifySignedPhotoUrl,
  getPhotoFilePath
};
