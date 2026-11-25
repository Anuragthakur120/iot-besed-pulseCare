import PDFDocument from 'pdfkit';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  MonitoringSession,
  HealthReading,
  Alert,
  User,
  DoctorNote
} from '@pulsecare/database';
import { logAudit } from '../middleware/audit.js';
import env from '../config/env.js';

/**
 * Formula injection escaping for CSV values
 * @param {any} val
 * @returns {string}
 */
export function escapeCsvFormula(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  if (/^[=+\-@]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
}

/**
 * Calculate statistical metrics for an array of numerical values
 */
function calculateStats(numbers) {
  if (!numbers || numbers.length === 0) {
    return { min: 'Not available', max: 'Not available', avg: 'Not available', median: 'Not available' };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = Math.round((sum / sorted.length) * 10) / 10;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;

  return { min, max, avg, median };
}

/**
 * Draw a clean vector sparkline / trend chart in PDFKit
 */
function drawVectorChart(doc, { title, unit, data, color, minY, maxY, startX, startY, width, height }) {
  // Chart container box
  doc.rect(startX, startY, width, height)
    .fillAndStroke('#F8FAFC', '#E2E8F0');

  // Title and legend
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
    .text(title, startX + 8, startY + 6);
  doc.fillColor('#64748B').fontSize(8).font('Helvetica')
    .text(`(${unit})`, startX + doc.widthOfString(title) + 12, startY + 7);

  const plotX = startX + 35;
  const plotY = startY + 22;
  const plotW = width - 45;
  const plotH = height - 32;

  // Horizontal grid lines & Y labels
  const steps = 3;
  for (let i = 0; i <= steps; i++) {
    const yVal = Math.round(minY + ((maxY - minY) / steps) * (steps - i));
    const currentY = plotY + (plotH / steps) * i;

    // Grid line
    doc.strokeColor('#E2E8F0').lineWidth(0.5)
      .moveTo(plotX, currentY)
      .lineTo(plotX + plotW, currentY)
      .stroke();

    // Y Axis label
    doc.fillColor('#94A3B8').fontSize(7).font('Helvetica')
      .text(String(yVal), startX + 6, currentY - 3, { width: 25, align: 'right' });
  }

  if (!data || data.length === 0) {
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica-Oblique')
      .text('No telemetry recorded for this vital in this session', plotX + 20, plotY + plotH / 2 - 5);
    return;
  }

  // Draw trend line
  const points = data.map((val, idx) => {
    const x = plotX + (idx / Math.max(1, data.length - 1)) * plotW;
    const norm = Math.max(0, Math.min(1, (val - minY) / Math.max(1, maxY - minY)));
    const y = plotY + plotH - (norm * plotH);
    return { x, y, val };
  });

  doc.strokeColor(color).lineWidth(1.5);
  doc.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    doc.lineTo(points[i].x, points[i].y);
  }
  doc.stroke();

  // Draw end-point dot
  const lastPoint = points[points.length - 1];
  doc.circle(lastPoint.x, lastPoint.y, 2.5).fillColor(color).fill();
}

/**
 * GET /api/sessions/:sessionId/report.pdf
 * Clinical PDF Report generation using stored data only
 */
export async function getSessionPdfReport(req, res, next) {
  try {
    const { sessionId } = req.params;

    // 1. Fetch Session
    const session = await MonitoringSession.findOne({ sessionId })
      .populate('patientId', 'patientId name email dob phone emergencyContact')
      .populate('startedBy', 'name role')
      .lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Monitoring session ${sessionId} not found`
      });
    }

    // 2. Patient Isolation Access Check
    const patientDoc = session.patientId;
    if (req.user.role === 'patient') {
      const isOwner = patientDoc && (
        patientDoc._id?.toString() === req.user._id.toString() ||
        patientDoc.patientId === req.user.patientId
      );
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          data: null,
          error: 'Access denied: You can only download reports for your own monitoring sessions.'
        });
      }
    }

    // 3. Log Audit Event
    await logAudit(req, {
      action: 'REPORT_DOWNLOAD',
      targetType: 'MonitoringSession',
      targetId: session.sessionId,
      meta: {
        format: 'pdf',
        patientId: patientDoc?.patientId,
        deviceId: session.deviceId
      }
    });

    // 4. Fetch Stored Telemetry & Alerts & Doctor Notes
    const [readings, alerts, doctorNotes] = await Promise.all([
      HealthReading.find({ 'meta.sessionId': sessionId }).sort({ ts: 1 }).lean(),
      Alert.find({ sessionId }).sort({ triggeredAt: 1 }).lean(),
      DoctorNote.find({
        patientId: patientDoc?._id,
        ...(req.user.role === 'patient' ? { visibleToPatient: true } : {})
      }).sort({ createdAt: -1 }).limit(5).lean()
    ]);

    // 5. Compute Statistics from Stored Telemetry Only (Never fabricated)
    const validHrReadings = readings.filter((r) => r.valid?.hr && r.heartRate !== null && r.heartRate > 0).map((r) => r.heartRate);
    const validSpo2Readings = readings.filter((r) => r.valid?.spo2 && r.spo2 !== null && r.spo2 > 0).map((r) => r.spo2);
    const validTempReadings = readings.filter((r) => r.valid?.temp && r.temperatureC !== null && r.temperatureC > 0).map((r) => r.temperatureC);

    const hrStats = calculateStats(validHrReadings);
    const spo2Stats = calculateStats(validSpo2Readings);
    const tempStats = calculateStats(validTempReadings);

    const totalReadingsCount = readings.length;
    const hrValidPct = totalReadingsCount > 0 ? Math.round((validHrReadings.length / totalReadingsCount) * 100) : 0;
    const spo2ValidPct = totalReadingsCount > 0 ? Math.round((validSpo2Readings.length / totalReadingsCount) * 100) : 0;
    const tempValidPct = totalReadingsCount > 0 ? Math.round((validTempReadings.length / totalReadingsCount) * 100) : 0;

    // Detect data gaps (> 30s)
    let gapsCount = 0;
    let fingerDetachedCount = 0;
    for (let i = 1; i < readings.length; i++) {
      const prevTime = new Date(readings[i - 1].ts).getTime();
      const currTime = new Date(readings[i].ts).getTime();
      if ((currTime - prevTime) > 30000) {
        gapsCount++;
      }
      if (readings[i].fingerDetected === false) {
        fingerDetachedCount++;
      }
    }

    // Downsample readings for report summary table (25 rows)
    const downsampledReadings = [];
    const targetRows = 25;
    if (readings.length <= targetRows) {
      downsampledReadings.push(...readings);
    } else {
      const step = (readings.length - 1) / (targetRows - 1);
      for (let i = 0; i < targetRows; i++) {
        const idx = Math.min(readings.length - 1, Math.round(i * step));
        downsampledReadings.push(readings[idx]);
      }
    }

    // Timestamps
    const genDate = new Date();
    const genUtc = genDate.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const genIst = genDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

    const sessionStartUtc = session.startedAt ? new Date(session.startedAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : 'Not available';
    const sessionEndUtc = session.endedAt ? new Date(session.endedAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : (session.status === 'active' ? 'Active / In Progress' : 'Not available');

    let durationStr = 'Not available';
    if (session.startedAt) {
      const endMs = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
      const durSec = Math.round((endMs - new Date(session.startedAt).getTime()) / 1000);
      const hrs = Math.floor(durSec / 3600);
      const mins = Math.floor((durSec % 3600) / 60);
      const secs = durSec % 60;
      durationStr = `${hrs}h ${mins}m ${secs}s`;
    }

    // 6. Build PDF Document
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PulseCare-Report-${session.sessionId}.pdf"`);

    doc.pipe(res);

    // Header & Branding
    doc.rect(40, 40, 515, 60).fill('#0B1F3A');
    doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
      .text('PulseCare Hospital Telemetry', 55, 52);
    doc.fillColor('#14B8A6').fontSize(10).font('Helvetica')
      .text('Continuous Physiological Monitoring & Telemetry Clinical Report', 55, 75);

    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
      .text(`Generated: ${genIst} | ${genUtc}`, 300, 55, { align: 'right', width: 240 })
      .text(`Session: ${session.sessionId}`, 300, 70, { align: 'right', width: 240 });

    doc.moveDown(2);
    let curY = 115;

    // Patient & Session Info Grid
    doc.rect(40, curY, 515, 65).fillAndStroke('#F1F5F9', '#CBD5E1');

    doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('PATIENT IDENTIFICATION', 52, curY + 8);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica')
      .text(`Name: ${patientDoc?.name || 'Not available'}`, 52, curY + 22)
      .text(`Patient ID: ${patientDoc?.patientId || 'Not available'}`, 52, curY + 35)
      .text(`DOB: ${patientDoc?.dob ? new Date(patientDoc.dob).toLocaleDateString() : 'Not available'}`, 52, curY + 48);

    doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('MONITORING SESSION DETAILS', 300, curY + 8);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica')
      .text(`Device ID: ${session.deviceId}`, 300, curY + 22)
      .text(`Duration: ${durationStr} (${session.status.toUpperCase()})`, 300, curY + 35)
      .text(`Started: ${sessionStartUtc}`, 300, curY + 48);

    curY += 75;

    // Summary Metrics Table
    doc.fillColor('#0B1F3A').fontSize(11).font('Helvetica-Bold').text('Physiological Metrics Summary', 40, curY);
    curY += 15;

    // Table Header
    doc.rect(40, curY, 515, 18).fill('#1E293B');
    doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
      .text('Vital Parameter', 50, curY + 5)
      .text('Min', 170, curY + 5)
      .text('Max', 230, curY + 5)
      .text('Average', 290, curY + 5)
      .text('Median', 360, curY + 5)
      .text('Valid Data %', 440, curY + 5);

    curY += 18;

    const summaryRows = [
      { name: 'Heart Rate (BPM)', ...hrStats, valid: `${hrValidPct}%` },
      { name: 'SpO2 Oxygen Sat (%)', ...spo2Stats, valid: `${spo2ValidPct}%` },
      { name: 'Temperature (°C)', ...tempStats, valid: `${tempValidPct}%` }
    ];

    summaryRows.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      doc.rect(40, curY, 515, 18).fillAndStroke(bg, '#E2E8F0');
      doc.fillColor('#0F172A').fontSize(8).font('Helvetica')
        .text(row.name, 50, curY + 5)
        .text(String(row.min), 170, curY + 5)
        .text(String(row.max), 230, curY + 5)
        .text(String(row.avg), 290, curY + 5)
        .text(String(row.median), 360, curY + 5)
        .text(String(row.valid), 440, curY + 5);
      curY += 18;
    });

    curY += 15;

    // Three Trend Charts
    doc.fillColor('#0B1F3A').fontSize(11).font('Helvetica-Bold').text('Continuous Vital Trajectory Trends', 40, curY);
    curY += 15;

    // Chart 1: Heart Rate
    drawVectorChart(doc, {
      title: 'Heart Rate Trend',
      unit: 'bpm',
      data: validHrReadings.length > 0 ? validHrReadings : null,
      color: '#DC2626',
      minY: 40,
      maxY: 160,
      startX: 40,
      startY: curY,
      width: 515,
      height: 70
    });
    curY += 76;

    // Chart 2: SpO2
    drawVectorChart(doc, {
      title: 'Pulse Oximetry (SpO2)',
      unit: '%',
      data: validSpo2Readings.length > 0 ? validSpo2Readings : null,
      color: '#2563EB',
      minY: 80,
      maxY: 100,
      startX: 40,
      startY: curY,
      width: 515,
      height: 70
    });
    curY += 76;

    // Chart 3: Temperature
    drawVectorChart(doc, {
      title: 'Core Temperature',
      unit: '°C',
      data: validTempReadings.length > 0 ? validTempReadings : null,
      color: '#0D9488',
      minY: 34,
      maxY: 41,
      startX: 40,
      startY: curY,
      width: 515,
      height: 70
    });
    curY += 80;

    // Data Quality Notes
    doc.rect(40, curY, 515, 38).fillAndStroke('#FEF3C7', '#FDE68A');
    doc.fillColor('#92400E').fontSize(8).font('Helvetica-Bold').text('DATA QUALITY & CONTINUITY AUDIT', 48, curY + 6);
    doc.fillColor('#78350F').fontSize(7.5).font('Helvetica')
      .text(`Total Samples Recorded: ${totalReadingsCount}  |  Telemetry Gaps (>30s): ${gapsCount}  |  Sensor Detachments (Finger Off): ${fingerDetachedCount}  |  Invalid Samples: ${totalReadingsCount - validHrReadings.length}`, 48, curY + 18)
      .text('Note: In periods of movement or sensor displacement, invalid readings are rejected by hardware filter and marked unavailable.', 48, curY + 28);

    // ==========================================
    // PAGE 2: Readings Table, Alerts, Doctor Notes, Disclaimer
    // ==========================================
    doc.addPage();
    let p2Y = 40;

    // Readings Sample Table
    doc.fillColor('#0B1F3A').fontSize(11).font('Helvetica-Bold').text('Telemetry Readings Sample (Downsampled)', 40, p2Y);
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica')
      .text('* Representative intervals selected across session duration for documentation clarity. Complete unreduced log is exportable via CSV.', 40, p2Y + 14);
    p2Y += 28;

    // Readings Header
    doc.rect(40, p2Y, 515, 16).fill('#334155');
    doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
      .text('Timestamp (IST)', 46, p2Y + 4)
      .text('HR (bpm)', 150, p2Y + 4)
      .text('SpO2 (%)', 215, p2Y + 4)
      .text('Temp (°C)', 275, p2Y + 4)
      .text('Finger', 335, p2Y + 4)
      .text('Signal Q.', 385, p2Y + 4)
      .text('Valid Flags', 445, p2Y + 4);
    p2Y += 16;

    if (downsampledReadings.length === 0) {
      doc.rect(40, p2Y, 515, 18).fill('#F8FAFC');
      doc.fillColor('#94A3B8').fontSize(8).font('Helvetica-Oblique').text('No readings recorded in session.', 50, p2Y + 5);
      p2Y += 18;
    } else {
      downsampledReadings.forEach((r, idx) => {
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, p2Y, 515, 14).fillAndStroke(bg, '#E2E8F0');

        const timeStr = r.ts ? new Date(r.ts).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : 'Not available';
        const hrStr = r.valid?.hr && r.heartRate !== null ? String(r.heartRate) : 'Not available';
        const spo2Str = r.valid?.spo2 && r.spo2 !== null ? `${r.spo2}%` : 'Not available';
        const tempStr = r.valid?.temp && r.temperatureC !== null ? `${r.temperatureC}` : 'Not available';
        const fingerStr = r.fingerDetected ? 'Yes' : 'No';
        const sigStr = r.signalQuality !== undefined ? `${r.signalQuality}%` : 'Not available';
        const flagsStr = `H:${r.valid?.hr ? 1 : 0} S:${r.valid?.spo2 ? 1 : 0} T:${r.valid?.temp ? 1 : 0}`;

        doc.fillColor('#0F172A').fontSize(7).font('Helvetica')
          .text(timeStr, 46, p2Y + 3)
          .text(hrStr, 150, p2Y + 3)
          .text(spo2Str, 215, p2Y + 3)
          .text(tempStr, 275, p2Y + 3)
          .text(fingerStr, 335, p2Y + 3)
          .text(sigStr, 385, p2Y + 3)
          .text(flagsStr, 445, p2Y + 3);

        p2Y += 14;
      });
    }

    p2Y += 15;

    // Alerts Table
    doc.fillColor('#0B1F3A').fontSize(11).font('Helvetica-Bold').text(`Clinical & System Alarms (${alerts.length})`, 40, p2Y);
    p2Y += 15;

    doc.rect(40, p2Y, 515, 16).fill('#334155');
    doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
      .text('Alert Type', 46, p2Y + 4)
      .text('Severity', 160, p2Y + 4)
      .text('Breach Value', 225, p2Y + 4)
      .text('Triggered At (IST)', 295, p2Y + 4)
      .text('Resolved At (IST)', 395, p2Y + 4)
      .text('Status', 480, p2Y + 4);
    p2Y += 16;

    if (alerts.length === 0) {
      doc.rect(40, p2Y, 515, 16).fill('#F0FDF4');
      doc.fillColor('#166534').fontSize(7.5).font('Helvetica').text('No physiological alerts or hardware anomalies recorded during this session.', 50, p2Y + 4);
      p2Y += 18;
    } else {
      alerts.slice(0, 10).forEach((a, idx) => {
        const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(40, p2Y, 515, 14).fillAndStroke(bg, '#E2E8F0');

        const triggerStr = a.triggeredAt ? new Date(a.triggeredAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not available';
        const resolveStr = a.resolvedAt ? new Date(a.resolvedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Ongoing';
        const valStr = a.value !== null && a.value !== undefined ? (typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value)) : 'Not available';
        const statusStr = a.acknowledgedAt ? 'Ack' : (a.resolvedAt ? 'Resolved' : 'Active');

        doc.fillColor('#0F172A').fontSize(7).font('Helvetica')
          .text(a.type, 46, p2Y + 3)
          .text(a.severity.toUpperCase(), 160, p2Y + 3)
          .text(valStr, 225, p2Y + 3)
          .text(triggerStr, 295, p2Y + 3)
          .text(resolveStr, 395, p2Y + 3)
          .text(statusStr, 480, p2Y + 3);

        p2Y += 14;
      });
    }

    p2Y += 15;

    // Doctor Notes
    if (doctorNotes.length > 0) {
      doc.fillColor('#0B1F3A').fontSize(11).font('Helvetica-Bold').text('Clinician Observations', 40, p2Y);
      p2Y += 15;

      doctorNotes.slice(0, 2).forEach((n) => {
        doc.rect(40, p2Y, 515, 26).fillAndStroke('#F8FAFC', '#E2E8F0');
        const dateStr = n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '';
        doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold').text(`Note (${dateStr}):`, 46, p2Y + 5);
        doc.fillColor('#0F172A').fontSize(7.5).font('Helvetica').text(n.content || n.note || 'No text', 46, p2Y + 14);
        p2Y += 30;
      });
    }

    p2Y += 10;

    // MANDATORY CLINICAL DISCLAIMER
    doc.rect(40, p2Y, 515, 45).fillAndStroke('#F1F5F9', '#CBD5E1');
    doc.fillColor('#DC2626').fontSize(8).font('Helvetica-Bold').text('CLINICAL & REGULATORY DISCLAIMER', 48, p2Y + 6);
    doc.fillColor('#475569').fontSize(7).font('Helvetica')
      .text('PulseCare IoT Hospital System is an educational and technological monitoring prototype. This document is compiled directly from device telemetry logs and does NOT constitute a certified clinical diagnosis or medical device evaluation under FDA, CE, or national medical regulatory bodies. All health readings and trends must be verified with certified hospital diagnostics prior to taking medical decisions.', 48, p2Y + 18, { width: 495, lineGap: 2 });

    doc.end();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/sessions/:sessionId/readings.csv
 * Export unreduced telemetry readings as CSV with formula injection escaping
 */
export async function getSessionReadingsCsv(req, res, next) {
  try {
    const { sessionId } = req.params;

    const session = await MonitoringSession.findOne({ sessionId })
      .populate('patientId', 'patientId name email')
      .lean();

    if (!session) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Session ${sessionId} not found`
      });
    }

    // Patient isolation check
    if (req.user.role === 'patient') {
      const isOwner = session.patientId && (
        session.patientId._id?.toString() === req.user._id.toString() ||
        session.patientId.patientId === req.user.patientId
      );
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          data: null,
          error: 'Access denied: You can only export telemetry for your own monitoring sessions.'
        });
      }
    }

    // Log audit event
    await logAudit(req, {
      action: 'REPORT_DOWNLOAD',
      targetType: 'MonitoringSession',
      targetId: session.sessionId,
      meta: {
        format: 'csv',
        patientId: session.patientId?.patientId,
        deviceId: session.deviceId
      }
    });

    const readings = await HealthReading.find({ 'meta.sessionId': sessionId })
      .sort({ ts: 1 })
      .lean();

    const headers = [
      'timestamp_utc',
      'timestamp_ist',
      'session_id',
      'hr_bpm',
      'spo2_est_percent',
      'temp_c',
      'finger_detected',
      'signal_quality',
      'valid_hr',
      'valid_spo2',
      'valid_temp'
    ];

    const rows = readings.map((r) => {
      const utcStr = r.ts ? new Date(r.ts).toISOString() : '';
      const istStr = r.ts ? new Date(r.ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';

      return [
        escapeCsvFormula(utcStr),
        escapeCsvFormula(istStr),
        escapeCsvFormula(session.sessionId),
        escapeCsvFormula(r.valid?.hr && r.heartRate !== null ? r.heartRate : ''),
        escapeCsvFormula(r.valid?.spo2 && r.spo2 !== null ? r.spo2 : ''),
        escapeCsvFormula(r.valid?.temp && r.temperatureC !== null ? r.temperatureC : ''),
        escapeCsvFormula(r.fingerDetected ? '1' : '0'),
        escapeCsvFormula(r.signalQuality !== undefined ? r.signalQuality : ''),
        escapeCsvFormula(r.valid?.hr ? '1' : '0'),
        escapeCsvFormula(r.valid?.spo2 ? '1' : '0'),
        escapeCsvFormula(r.valid?.temp ? '1' : '0')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="PulseCare-Readings-${session.sessionId}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reports/generate
 * Generate and return short-lived signed URL (5 min)
 */
export async function generateSignedReportUrl(req, res, next) {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'sessionId is required'
      });
    }

    const session = await MonitoringSession.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({
        success: false,
        data: null,
        error: `Session ${sessionId} not found`
      });
    }

    // Generate signed download token valid for 5 minutes
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const signPayload = `${sessionId}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', env.JWT_ACCESS_SECRET || 'pulsecare_token_secret')
      .update(signPayload)
      .digest('hex');

    const downloadToken = `${expiresAt}.${signature}`;
    const signedPdfUrl = `/api/sessions/${sessionId}/report.pdf?token=${downloadToken}`;
    const signedCsvUrl = `/api/sessions/${sessionId}/readings.csv?token=${downloadToken}`;

    return res.status(200).json({
      success: true,
      data: {
        sessionId,
        expiresInSeconds: 300,
        expiresAt: new Date(expiresAt).toISOString(),
        pdfUrl: signedPdfUrl,
        csvUrl: signedCsvUrl
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reports/research-export.csv
 * Anonymized research dataset export (Admin only)
 * Removes patient names, emails, phones; replaces patientId with a salted hash
 */
export async function getResearchCsvExport(req, res, next) {
  try {
    // Audit log
    await logAudit(req, {
      action: 'RESEARCH_EXPORT',
      targetType: 'ResearchTelemetry',
      targetId: 'ALL',
      meta: { scope: 'full_anonymized_telemetry' }
    });

    const readings = await HealthReading.find({})
      .populate('meta.patientId', 'patientId')
      .sort({ ts: 1 })
      .limit(20000)
      .lean();

    const headers = [
      'anonymized_patient_hash',
      'session_id',
      'timestamp_utc',
      'hr_bpm',
      'spo2_percent',
      'temp_c',
      'finger_detected',
      'signal_quality'
    ];

    const salt = env.DEVICE_HMAC_PEPPER || 'pulsecare_research_salt_2026';

    const rows = readings.map((r) => {
      const rawPatientId = r.meta?.patientId?.patientId || r.meta?.patientId?.toString() || 'unknown';
      const patientHash = crypto
        .createHash('sha256')
        .update(`${rawPatientId}:${salt}`)
        .digest('hex')
        .substring(0, 16);

      const utcStr = r.ts ? new Date(r.ts).toISOString() : '';

      return [
        escapeCsvFormula(patientHash),
        escapeCsvFormula(r.meta?.sessionId || ''),
        escapeCsvFormula(utcStr),
        escapeCsvFormula(r.valid?.hr && r.heartRate !== null ? r.heartRate : ''),
        escapeCsvFormula(r.valid?.spo2 && r.spo2 !== null ? r.spo2 : ''),
        escapeCsvFormula(r.valid?.temp && r.temperatureC !== null ? r.temperatureC : ''),
        escapeCsvFormula(r.fingerDetected ? '1' : '0'),
        escapeCsvFormula(r.signalQuality !== undefined ? r.signalQuality : '')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="PulseCare-Research-Export-${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
}
