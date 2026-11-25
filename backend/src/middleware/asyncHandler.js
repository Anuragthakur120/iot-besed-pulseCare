/**
 * Wraps an async route handler or middleware to catch and pass unhandled rejections to next()
 * @param {Function} fn - Async express route handler
 * @returns {Function}
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
