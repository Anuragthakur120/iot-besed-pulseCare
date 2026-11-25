import nodemailer from 'nodemailer';
import env from '../config/env.js';

/**
 * PulseCare Alert Multi-Channel Notifier Interface
 * Handles dispatching external alerts (Email / SMS) for clinical escalations.
 */

// Nodemailer transport setup (falls back to console in test/dev)
let mailTransporter = null;
if (env.ALERT_EMAIL_ENABLED && env.SMTP_USER !== 'smtp_user_placeholder') {
  mailTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

/**
 * Dispatch notification for a triggered alert
 * @param {Object} params
 * @param {Object} params.alert - Mongoose Alert doc or plain object
 * @param {Object} params.patient - Patient user object (including emergencyContact)
 * @param {Object} [params.session] - MonitoringSession doc
 */
export async function sendAlertNotification({ alert, patient, session }) {
  const results = {
    emailSent: false,
    smsSent: false,
    errors: []
  };

  const alertTitle = `[PULSECARE ${alert.severity.toUpperCase()}] ${alert.type} Alert for Patient ${patient?.name || 'Unknown'} (${patient?.patientId || 'N/A'})`;
  const alertBody = `
PulseCare IoT Telemetry Alert
=============================
Severity: ${alert.severity.toUpperCase()}
Type: ${alert.type}
Triggered At: ${new Date(alert.triggeredAt || Date.now()).toISOString()}
Patient: ${patient?.name || 'N/A'} (ID: ${patient?.patientId || 'N/A'})
Session: ${alert.sessionId}
Device: ${alert.deviceId}
Value Detected: ${JSON.stringify(alert.value)}
Threshold Violated: ${JSON.stringify(alert.thresholdRef || 'Standard Thresholds')}

This is an automated physiological telemetry notification.
Immediate clinical verification is advised.
`;

  // 1. Optional Email Notification
  if (env.ALERT_EMAIL_ENABLED) {
    try {
      const recipientEmail = patient?.emergencyContact?.email || patient?.email;
      if (recipientEmail && mailTransporter) {
        await mailTransporter.sendMail({
          from: env.SMTP_FROM,
          to: recipientEmail,
          subject: alertTitle,
          text: alertBody
        });
        results.emailSent = true;
      } else {
        console.log(`[Notifier:SimulatedEmail] Sent to ${recipientEmail || 'clinician'}: ${alertTitle}`);
        results.emailSent = true;
      }
    } catch (err) {
      console.error('[Notifier] Failed to send email alert:', err.message);
      results.errors.push({ channel: 'email', error: err.message });
    }
  }

  // 2. Optional SMS Notification (CRITICAL severity only, to Emergency Contact)
  if (env.ALERT_SMS_ENABLED && alert.severity === 'critical') {
    const contactPhone = patient?.emergencyContact?.phone;
    if (contactPhone) {
      try {
        if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER) {
          // Send via Twilio REST API without heavy external SDK dependency
          const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
          const bodyParams = new URLSearchParams({
            To: contactPhone,
            From: env.TWILIO_PHONE_NUMBER,
            Body: `[PulseCare CRITICAL] ${alert.type} alarm triggered for ${patient.name}. Vital: ${JSON.stringify(alert.value)}. Please check immediately.`
          });

          const twilioRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: bodyParams.toString()
            }
          );

          if (twilioRes.ok) {
            results.smsSent = true;
          } else {
            const errData = await twilioRes.text();
            results.errors.push({ channel: 'sms', error: errData });
          }
        } else {
          // Dev / Test simulation logging
          console.log(`[Notifier:SimulatedSMS] Sent to ${contactPhone}: [PulseCare CRITICAL] ${alert.type} value=${JSON.stringify(alert.value)}`);
          results.smsSent = true;
        }
      } catch (err) {
        console.error('[Notifier] Failed to send SMS alert:', err.message);
        results.errors.push({ channel: 'sms', error: err.message });
      }
    }
  }

  return results;
}

export default {
  sendAlertNotification
};
