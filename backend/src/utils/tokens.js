import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import env from '../config/env.js';

/**
 * Generate a short-lived JWT Access Token (15m)
 * @param {Object} user - User document
 * @returns {string} Signed JWT
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      patientId: user.patientId || null,
      email: user.email
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.ACCESS_TOKEN_TTL || '15m'
    }
  );
}

/**
 * Verify a JWT Access Token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

/**
 * Generate a cryptographically secure random 64-byte refresh token string
 * @returns {string} Hex encoded 64-byte random string
 */
export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Compute SHA-256 hash of a raw token string for secure database storage
 * @param {string} token
 * @returns {string} Hex encoded SHA-256 hash
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Standard cookie configuration for refresh tokens
 * @param {boolean} [rememberMe=true]
 * @returns {import('express').CookieOptions}
 */
export function getRefreshCookieOptions(rememberMe = true) {
  const isProd = env.NODE_ENV === 'production';
  const secure = env.COOKIE_SECURE ?? isProd;
  
  return {
    httpOnly: true,
    secure: secure,
    sameSite: 'lax',
    path: '/api/auth',
    ...(rememberMe && { maxAge: 7 * 24 * 60 * 60 * 1000 }) // 7 days or session cookie
  };
}

export default {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  getRefreshCookieOptions
};
