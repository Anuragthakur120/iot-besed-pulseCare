import { ZodError } from 'zod';

/**
 * Middleware factory to validate Express requests using Zod schemas
 * @param {import('zod').ZodSchema | { body?: import('zod').ZodSchema, query?: import('zod').ZodSchema, params?: import('zod').ZodSchema }} schema
 */
export const validate = (schema) => async (req, res, next) => {
  try {
    if (schema.body) {
      req.body = await schema.body.parseAsync(req.body);
    }
    if (schema.query) {
      req.query = await schema.query.parseAsync(req.query);
    }
    if (schema.params) {
      req.params = await schema.params.parseAsync(req.params);
    }
    // If schema itself is a direct Zod object schema without body/query keys, validate req.body by default
    if (schema._def && !schema.body && !schema.query && !schema.params) {
      req.body = await schema.parseAsync(req.body);
    }
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      const formattedErrors = err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message
      }));
      const errorSummary = formattedErrors.map((e) => e.message).join('. ');
      return res.status(400).json({
        success: false,
        status: 400,
        message: errorSummary || 'Request validation failed',
        error: errorSummary || 'Request validation failed',
        errors: formattedErrors
      });
    }
    next(err);
  }
};

export default validate;
