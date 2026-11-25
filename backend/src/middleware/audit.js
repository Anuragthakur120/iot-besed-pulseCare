import { AuditEvent } from '@pulsecare/database';

/**
 * Direct function to record an AuditEvent
 * @param {Object} params
 * @param {import('express').Request} [params.req]
 * @param {string} params.action - Event action string
 * @param {string} [params.targetType='System']
 * @param {string} [params.targetId]
 * @param {Object} [params.meta]
 * @param {Object} [params.actor]
 */
export async function logAudit(arg1, arg2) {
  try {
    let req = null;
    let action = 'UNKNOWN';
    let targetType = 'System';
    let targetId = null;
    let meta = {};
    let actor = null;

    if (arg1 && typeof arg1 === 'object' && arg1.action) {
      // Called as logAudit({ req, action, ... })
      req = arg1.req;
      action = arg1.action;
      targetType = arg1.targetType || 'System';
      targetId = arg1.targetId || null;
      meta = arg1.meta || {};
      actor = arg1.actor || null;
    } else {
      // Called as logAudit(req, { action, targetType, targetId, meta, actor })
      req = arg1;
      const opts = arg2 || {};
      action = opts.action || 'UNKNOWN';
      targetType = opts.targetType || 'System';
      targetId = opts.targetId || null;
      meta = opts.meta || {};
      actor = opts.actor || null;
    }
    const actorUser = actor || req?.user;
    const ip = req?.ip || req?.headers?.['x-forwarded-for'] || '';
    const userAgent = req?.get ? req.get('user-agent') : '';

    await AuditEvent.create({
      actorId: actorUser?._id || null,
      actorRole: actorUser?.role || 'anonymous',
      action,
      targetType,
      targetId: targetId ? targetId.toString() : null,
      ip: typeof ip === 'string' ? ip : String(ip),
      userAgent: userAgent || '',
      meta: meta || {},
      at: new Date()
    });
  } catch (err) {
    console.error(`[AUDIT_ERROR] Failed to record audit action ${action}:`, err.message);
  }
}

/**
 * Express Middleware to automatically audit endpoint requests
 * @param {string} action
 * @param {string} [targetType='Route']
 */
export const audit = (action, targetType = 'Route') => (req, res, next) => {
  res.on('finish', () => {
    // Only log if response wasn't a client error or if it was an explicit auth event
    if (res.statusCode < 400 || action.includes('FAILURE')) {
      logAudit({
        req,
        action,
        targetType,
        targetId: req.params.id || req.params.patientId || null,
        meta: {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode
        }
      });
    }
  });
  next();
};

export default { logAudit, audit };
