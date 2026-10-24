import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import * as backfillVisits from './backfillVisits.js';

// Usage: npm run migrate:up | npm run migrate:down   (uses MONGODB_URI)
// Prints counts only — never record contents.
const migrations = { backfillVisits };

export async function runMigrations(direction) {
  if (direction !== 'up' && direction !== 'down') {
    throw new Error('Direction must be "up" or "down".');
  }
  const names = Object.keys(migrations);
  const ordered = direction === 'up' ? names : [...names].reverse();
  const results = {};
  for (const name of ordered) {
    results[name] = await migrations[name][direction]();
  }
  return results;
}

async function main() {
  const direction = process.argv[2];
  try {
    await connectDatabase();
    const results = await runMigrations(direction);
    for (const [name, counts] of Object.entries(results)) {
      console.log(`${name} ${direction}: ${JSON.stringify(counts)}`);
    }
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
