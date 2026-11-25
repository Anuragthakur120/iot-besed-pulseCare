import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB, User } from '@pulsecare/database';
import { passwordPolicy } from '../validators/auth.validators.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const isForce = process.argv.includes('--force');

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pulsecare';
  console.log('======================================================');
  console.log(' PulseCare CLI - Create System Administrator');
  console.log('======================================================\n');

  await connectDB(mongoUri);

  try {
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin && !isForce) {
      console.warn(`[REFUSED] An admin account already exists: ${existingAdmin.email}`);
      console.warn('To create an additional admin, re-run with the --force flag:');
      console.warn('  npm run create-admin -w backend -- --force\n');
      process.exit(1);
    }

    // Check for CLI arguments: --email=... --password=... --name=...
    let email = null;
    let password = null;
    let name = null;

    for (const arg of process.argv) {
      if (arg.startsWith('--email=')) email = arg.split('=')[1];
      if (arg.startsWith('--password=')) password = arg.split('=')[1];
      if (arg.startsWith('--name=')) name = arg.split('=')[1];
    }

    if (!email || !password) {
      const rl = readline.createInterface({ input, output });

      if (!name) {
        name = (await rl.question('Enter Admin Full Name [Hospital Admin]: ')).trim() || 'Hospital Administrator';
      }
      if (!email) {
        email = (await rl.question('Enter Admin Email Address: ')).trim().toLowerCase();
      }
      if (!password) {
        password = (await rl.question('Enter Secure Password (min 10 chars, upper, lower, number, symbol): ')).trim();
      }
      rl.close();
    }

    if (!email || !email.includes('@')) {
      console.error('[Error] Invalid email address provided.');
      process.exit(1);
    }

    const validation = passwordPolicy.safeParse(password);
    if (!validation.success) {
      console.error('\n[Error] Password does not meet security requirements:');
      validation.error.issues.forEach((iss) => console.error(`  - ${iss.message}`));
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await User.findOneAndUpdate(
      { email },
      {
        name: name || 'Hospital Administrator',
        email,
        passwordHash,
        role: 'admin',
        status: 'active',
        mustChangePassword: true
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('\n[SUCCESS] System Administrator created successfully!');
    console.log(`  Name:  ${admin.name}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
    console.log(`  MustChangePassword: ${admin.mustChangePassword}\n`);
  } catch (error) {
    console.error('[Error creating admin]', error);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

main();
