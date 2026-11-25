import mongoose from 'mongoose';
import { AuditEvent, User } from '@pulsecare/database';

/**
 * Formula injection escaping for CSV values
 * @param {any} val
 * @returns {string}
 */
export function escapeCsvFormula(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  // If the cell begins with =, +, -, @, prefix with a single quote '
  if (/^[=+\-@]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
}

/**
 * GET /api/audit
 * Admin-only query endpoint for system audit logs
 */
export async function getAuditLogs(req, res, next) {
  try {
    const {
      actor,
      action,
      target,
      from,
      to,
      format,
      page = 1,
      limit = 25
    } = req.query;

    const query = {};

    if (action) {
      query.action = action;
    }

    if (target) {
      query.targetType = target;
    }

    if (actor) {
      if (mongoose.Types.ObjectId.isValid(actor)) {
        query.actorId = actor;
      } else {
        const users = await User.find({
          $or: [
            { email: { $regex: actor, $options: 'i' } },
            { name: { $regex: actor, $options: 'i' } },
            { patientId: actor.toUpperCase() }
          ]
        }).select('_id');
        query.actorId = { $in: users.map((u) => u._id) };
      }
    }

    if (from || to) {
      query.at = {};
      if (from) query.at.$gte = new Date(from);
      if (to) query.at.$lte = new Date(to);
    }

    // CSV Export option
    if (format === 'csv') {
      const records = await AuditEvent.find(query)
        .populate('actorId', 'name email role')
        .sort({ at: -1 })
        .limit(5000)
        .lean();

      const headers = ['Timestamp_UTC', 'Timestamp_IST', 'Action', 'Actor_Role', 'Actor_Name', 'Actor_Email', 'Target_Type', 'Target_ID', 'IP_Address', 'Metadata'];
      const rows = records.map((r) => {
        const utcStr = r.at ? new Date(r.at).toISOString() : '';
        const istStr = r.at ? new Date(r.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
        const actorName = r.actorId?.name || 'System';
        const actorEmail = r.actorId?.email || '';
        const metaStr = r.meta ? JSON.stringify(r.meta) : '';

        return [
          escapeCsvFormula(utcStr),
          escapeCsvFormula(istStr),
          escapeCsvFormula(r.action),
          escapeCsvFormula(r.actorRole),
          escapeCsvFormula(actorName),
          escapeCsvFormula(actorEmail),
          escapeCsvFormula(r.targetType),
          escapeCsvFormula(r.targetId || ''),
          escapeCsvFormula(r.ip || ''),
          escapeCsvFormula(metaStr)
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pulsecare-audit-${Date.now()}.csv"`);
      return res.status(200).send(csvContent);
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const [events, total, actionsList] = await Promise.all([
      AuditEvent.find(query)
        .populate('actorId', 'name email role patientId')
        .sort({ at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditEvent.countDocuments(query),
      AuditEvent.distinct('action')
    ]);

    return res.status(200).json({
      success: true,
      data: {
        events,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum) || 1
        },
        actionsList
      },
      error: null
    });
  } catch (error) {
    next(error);
  }
}
