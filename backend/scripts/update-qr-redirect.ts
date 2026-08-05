import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { TenantModel } from '../src/modules/tenants/model.js';
import logger from '../src/utils/logger.js';

async function updateQrRedirectUrl() {
  logger.info('Starting QR redirect URL update script...');
  await connectDatabase();

  try {
    const result = await TenantModel.updateMany(
      { $or: [{ qrRedirectUrl: { $exists: false } }, { qrRedirectUrl: '' }, { qrRedirectUrl: null }] },
      { $set: { qrRedirectUrl: 'https://t.me/resturanchatbot' } }
    );
    logger.info(`Successfully updated ${result.modifiedCount} tenant documents with default Telegram bot URL.`);
  } catch (err) {
    logger.error({ err }, 'Error during QR redirect URL update');
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
    logger.info('Update complete. Database disconnected.');
  }
}

updateQrRedirectUrl();
