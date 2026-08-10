import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { TenantModel } from '../src/modules/tenants/model.js';
import logger from '../src/utils/logger.js';

async function migrateRestaurantToTenant() {
  logger.info('Starting Restaurant to Tenant migration...');
  await connectDatabase();

  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection failed');
    }

    const collections = await db.listCollections({ name: 'restaurants' }).toArray();
    if (collections.length === 0) {
      logger.info('No "restaurants" collection found. Migration not needed.');
      return;
    }

    const restaurantDocs = await db.collection('restaurants').find({}).toArray();
    logger.info(`Found ${restaurantDocs.length} restaurant documents to migrate.`);

    let migratedCount = 0;
    for (const rest of restaurantDocs) {
      const tenantId = rest['tenantId'];
      if (!tenantId) continue;

      const updateFields: Record<string, any> = {};
      if (rest['brandName']) updateFields['brandName'] = rest['brandName'];
      if (rest['cuisineType']) updateFields['cuisineType'] = rest['cuisineType'];
      if (rest['description']) updateFields['description'] = rest['description'];
      if (rest['logoUrl']) updateFields['logoUrl'] = rest['logoUrl'];
      if (rest['isOpen'] !== undefined) updateFields['isOpen'] = rest['isOpen'];
      if (rest['isChatbotActive'] !== undefined) updateFields['isChatbotActive'] = rest['isChatbotActive'];
      if (rest['chatbotSettings']) updateFields['chatbotSettings'] = rest['chatbotSettings'];

      if (Object.keys(updateFields).length > 0) {
        await TenantModel.findByIdAndUpdate(tenantId, { $set: updateFields });
        migratedCount++;
      }
    }

    logger.info(`Successfully migrated ${migratedCount} tenant documents from restaurants collection.`);
  } catch (err) {
    logger.error({ err }, 'Error during restaurant migration');
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
    logger.info('Migration complete. Database disconnected.');
  }
}

migrateRestaurantToTenant();
