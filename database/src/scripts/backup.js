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
const backupDir = path.resolve(__dirname, '../../backups');

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const targetFolder = path.join(backupDir, `backup_${timestamp}`);

console.log('======================================================');
console.log(' PulseCare MongoDB Backup Utility (mongodump)');
console.log('======================================================');
console.log(`URI:     ${mongoUri.replace(/:([^@]+)@/, ':****@')}`);
console.log(`Target:  ${targetFolder}`);

const cmd = `mongodump --uri="${mongoUri}" --out="${targetFolder}" --gzip`;

console.log('\nExecuting mongodump...');
exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error('\n[Backup Error] mongodump execution failed.');
    console.error(error.message);
    if (error.message.includes('not recognized') || error.message.includes('command not found')) {
      console.warn('\nNote: MongoDB Database Tools (mongodump) must be installed on your system.');
      console.warn('Download from: https://www.mongodb.com/try/download/database-tools');
    }
    process.exit(1);
  }

  if (stdout) console.log(stdout);
  if (stderr) console.log(stderr);

  console.log(`\n[Success] Backup completed successfully at: ${targetFolder}`);
});
