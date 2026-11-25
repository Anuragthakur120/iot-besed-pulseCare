/**
 * @pulsecare/database
 * Main entrypoint exporting connection management and Mongoose data models.
 */

export {
  connectDB,
  disconnectDB,
  isDatabaseConnected,
  getConnectionStatus
} from './connection.js';

export * from './models/index.js';
export { models } from './models/index.js';
