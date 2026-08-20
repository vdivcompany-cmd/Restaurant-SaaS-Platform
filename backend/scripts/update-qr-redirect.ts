import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { TenantModel } from '../src/modules/tenants/model.js';
import logger from '../src/utils/logger.js';

async function updateQrRedirectUrl() {
  logger.info('Starting QR redirect URL update script...');
  await connectDatabase();

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const result = await TenantModel.updateMany(
      {},
      { $set: { qrRedirectUrl: frontendUrl } }
    );
    logger.info(`Successfully updated ${result.modifiedCount} tenant documents with Web Frontend URL: ${frontendUrl}`);
  } catch (err) {
    logger.error({ err }, 'Error during QR redirect URL update');
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
    logger.info('Update complete. Database disconnected.');
  }
}

updateQrRedirectUrl();
