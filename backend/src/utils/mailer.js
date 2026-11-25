import nodemailer from 'nodemailer';
import env from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_USER !== 'smtp_user_placeholder'
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS
            }
          : undefined
    });
  }
  return transporter;
}

/**
 * Send Password Reset Email or log to console in development
 * @param {string} toEmail
 * @param {string} resetLink
 */
export async function sendPasswordResetEmail(toEmail, resetLink) {
  console.log('\n--------------------------------------------------------------');
  console.log(`[AUTH:EMAIL] Password Reset Link for ${toEmail}:`);
  console.log(`Reset URL: ${resetLink}`);
  console.log('--------------------------------------------------------------\n');

  if (env.NODE_ENV === 'production') {
    try {
      const mailer = getTransporter();
      await mailer.sendMail({
        from: env.SMTP_FROM,
        to: toEmail,
        subject: 'PulseCare - Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0b1f3a;">PulseCare Password Reset</h2>
            <p>You recently requested to reset your password for your PulseCare clinical account.</p>
            <p>Click the button below to proceed. This link expires in 1 hour:</p>
            <div style="margin: 25px 0;">
              <a href="${resetLink}" style="background-color: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #64748b; font-size: 13px;">If you did not request this, please disregard this email.</p>
          </div>
        `
      });
    } catch (err) {
      console.error('[AUTH:EMAIL Error] Failed to dispatch reset email via SMTP:', err.message);
    }
  }
}

export default { sendPasswordResetEmail };
