import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pulsecare';
const backupBaseDir = path.resolve(__dirname, '../../backups');

// Locate target backup folder from argument or pick most recent
let restoreSource = process.argv[2];

if (!restoreSource) {
  if (!fs.existsSync(backupBaseDir)) {
    console.error(`[Restore Error] No backup directory exists at: ${backupBaseDir}`);
    process.exit(1);
  }

  const backups = fs
    .readdirSync(backupBaseDir)
    .filter((f) => fs.statSync(path.join(backupBaseDir, f)).isDirectory())
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.error(`[Restore Error] No backup folders found in: ${backupBaseDir}`);
    process.exit(1);
  }

  restoreSource = path.join(backupBaseDir, backups[0]);
}

console.log('======================================================');
console.log(' PulseCare MongoDB Restore Utility (mongorestore)');
console.log('======================================================');
console.log(`URI:     ${mongoUri.replace(/:([^@]+)@/, ':****@')}`);
console.log(`Source:  ${restoreSource}`);

const cmd = `mongorestore --uri="${mongoUri}" --gzip --drop "${restoreSource}"`;

console.log('\nExecuting mongorestore (--drop mode enabled)...');
exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error('\n[Restore Error] mongorestore execution failed.');
    console.error(error.message);
    if (error.message.includes('not recognized') || error.message.includes('command not found')) {
      console.warn('\nNote: MongoDB Database Tools (mongorestore) must be installed on your system.');
      console.warn('Download from: https://www.mongodb.com/try/download/database-tools');
    }
    process.exit(1);
  }

  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);

  console.log(`\n[Success] Database restore completed successfully from: ${restoreSource}`);
});
