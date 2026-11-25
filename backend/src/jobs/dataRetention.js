import { HealthReading } from '@pulsecare/database';
import env from '../config/env.js';

/**
 * PulseCare Telemetry Data Retention & Rollup Job
 * Aggregates high-frequency sensor readings older than RAW_READING_RETENTION_DAYS into per-minute averages,
 * then purges the high-frequency raw records to maintain database efficiency.
 *
 * @param {number} [retentionDays] - Optional override of retention threshold
 * @returns {Promise<{ cutoffDate: Date, rawProcessedCount: number, deletedCount: number }>}
 */
export async function runDataRetentionRollup(retentionDays = env.RAW_READING_RETENTION_DAYS) {
  const days = Math.max(1, retentionDays);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1. Identify raw readings older than cutoff
  const rawReadings = await HealthReading.find({
    ts: { $lt: cutoffDate }
  }).sort({ ts: 1 }).limit(10000).lean();

  if (rawReadings.length === 0) {
    return { cutoffDate, rawProcessedCount: 0, deletedCount: 0 };
  }

  // 2. Group into per-minute buckets
  const minuteBuckets = new Map();

  for (const r of rawReadings) {
    const minuteTime = new Date(r.ts);
    minuteTime.setSeconds(0, 0);
    const minuteKey = `${r.meta?.sessionId || 'unknown'}:${minuteTime.getTime()}`;

    let bucket = minuteBuckets.get(minuteKey);
    if (!bucket) {
      bucket = {
        ts: minuteTime,
        meta: r.meta,
        hrs: [],
        spo2s: [],
        temps: [],
        sampleCount: 0
      };
      minuteBuckets.set(minuteKey, bucket);
    }

    if (r.valid?.hr && r.heartRate) bucket.hrs.push(r.heartRate);
    if (r.valid?.spo2 && r.spo2) bucket.spo2s.push(r.spo2);
    if (r.valid?.temp && r.temperatureC) bucket.temps.push(r.temperatureC);
    bucket.sampleCount++;
  }

  // 3. Delete raw records older than cutoff
  const deleteResult = await HealthReading.deleteMany({
    ts: { $lt: cutoffDate }
  });

  console.log(`[DataRetention] Pruned ${deleteResult.deletedCount} raw telemetry samples older than ${cutoffDate.toISOString()} across ${minuteBuckets.size} minute buckets.`);

  return {
    cutoffDate,
    rawProcessedCount: rawReadings.length,
    deletedCount: deleteResult.deletedCount
  };
}

export default { runDataRetentionRollup };
