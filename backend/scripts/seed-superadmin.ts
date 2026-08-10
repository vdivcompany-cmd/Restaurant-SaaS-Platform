import '../src/config/loadEnv.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { TenantModel } from '../src/modules/tenants/model.js';
import { AuthService } from '../src/modules/auth/service.js';
import env from '../src/config/env.js';
import logger from '../src/utils/logger.js';

async function seedSuperAdmin() {
  logger.info('Starting super admin seeder...');
  await connectDatabase();

  try {
    let platformTenant = await TenantModel.findOne({ slug: 'platform-admin' });
    if (!platformTenant) {
      platformTenant = await TenantModel.create({
        name: 'Platform Operations',
        slug: 'platform-admin',
        status: 'active',
        contact: { phone: '0000000000', email: env.SUPERADMIN_EMAIL },
        settings: { currency: 'EGP', timezone: 'Africa/Cairo', language: 'en' },
      });
      logger.info('Created Platform Operations tenant (slug: platform-admin)');
    } else {
      logger.info('Platform Operations tenant already exists');
    }

    try {
      const authRes = await AuthService.createSuperAdmin({
        tenantId: platformTenant._id.toString(),
        email: env.SUPERADMIN_EMAIL,
        password: env.SUPERADMIN_PASSWORD,
      });
      logger.info({ email: authRes.user.email, id: authRes.user.id }, 'Super Admin user seeded successfully!');
    } catch (err: unknown) {
      if ((err as { statusCode?: number })?.statusCode === 409 || (err as Error)?.message?.includes('already exists')) {
        logger.info('Super Admin user already exists');
      } else {
        throw err;
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error during super admin seeding');
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
    logger.info('Seeder complete. Database disconnected.');
  }
}

seedSuperAdmin();
