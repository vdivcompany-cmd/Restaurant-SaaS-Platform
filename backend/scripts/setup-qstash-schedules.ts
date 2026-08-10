import '../src/config/loadEnv.js';
import { Client } from '@upstash/qstash';
import env from '../src/config/env.js';

async function main() {
  const client = new Client({ token: env.QSTASH_TOKEN });

  await client.schedules.create({
    destination: `${env.PUBLIC_API_BASE_URL}/api/v1/jobs/backups`,
    cron: '0 2 * * *',
    body: JSON.stringify({ backupType: 'daily' }),
  });

  await client.schedules.create({
    destination: `${env.PUBLIC_API_BASE_URL}/api/v1/jobs/table-history-cleanup`,
    cron: '0 3 1 * *',
  });

  console.log('QStash schedules registered: daily backup (0 2 * * *), monthly table-history purge (0 3 1 * *)');
}

main().catch((err) => {
  console.error('Failed to register QStash schedules:', err);
  process.exit(1);
});
