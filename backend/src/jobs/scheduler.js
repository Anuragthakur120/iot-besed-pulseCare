import cron from 'node-cron';
import { runAppointmentReminderCheck } from '../controllers/appointment.controller.js';
import { runDataRetentionRollup } from './dataRetention.js';
import env from '../config/env.js';

let isInitialized = false;

/**
 * Initialize background scheduled tasks
 */
export function initCronJobs() {
  if (isInitialized || env.NODE_ENV === 'test') {
    return;
  }

  isInitialized = true;
  console.log('[Scheduler] Initializing hospital background automation jobs...');

  // 1. Appointment 24-Hour Reminder Job: Runs at the top of every hour
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Scheduler] Running hourly appointment 24h reminder check...');
      const result = await runAppointmentReminderCheck();
      if (result.sentCount > 0) {
        console.log(`[Scheduler] Dispatched ${result.sentCount} appointment reminder notifications.`);
      }
    } catch (err) {
      console.error('[Scheduler:Error] Appointment reminder job failed:', err.message);
    }
  });

  // 2. Telemetry Data Retention & Rollup Job: Runs daily at 02:00 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('[Scheduler] Running daily telemetry data retention & rollup job...');
      const result = await runDataRetentionRollup();
      console.log(`[Scheduler] Data retention complete. Purged ${result.deletedCount} aged raw samples.`);
    } catch (err) {
      console.error('[Scheduler:Error] Data retention job failed:', err.message);
    }
  });

  console.log('[Scheduler] Jobs registered: Appointment Reminders (Hourly) & Data Retention Rollup (Daily @ 02:00)');
}

export default { initCronJobs };
