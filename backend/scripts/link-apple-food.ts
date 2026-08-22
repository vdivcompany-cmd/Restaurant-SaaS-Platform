import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';

async function updateTenant() {
  await connectDatabase();
  const db = mongoose.connection.db;
  if (!db) return;

  const tenantIdStr = '6a85e588d0b508058fc5008c';
  const tenantObjectId = new mongoose.Types.ObjectId(tenantIdStr);

  const tenant = await db.collection('tenants').findOne({ _id: tenantObjectId });
  console.log('Current tenant in DB:', tenant);

  const updateResult = await db.collection('tenants').updateOne(
    { _id: tenantObjectId },
    {
      $set: {
        name: 'Apple Food',
        restaurantName: 'Apple Food',
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  console.log('Tenant update result:', updateResult);

  // Check branches for this tenant
  let branches = await db.collection('branches').find({ tenantId: tenantObjectId }).toArray();
  console.log('Branches for this tenant:', branches);

  if (branches.length === 0) {
    const branchInsert = await db.collection('branches').insertOne({
      tenantId: tenantObjectId,
      name: 'الفرع الرئيسي',
      address: 'Main Branch',
      phone: '01000000000',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('Created default branch:', branchInsert.insertedId);
    branches = await db.collection('branches').find({ tenantId: tenantObjectId }).toArray();
  }

  // Check menu for this tenant
  const menu = await db.collection('menus').findOne({ tenantId: tenantObjectId });
  console.log('Menu exists for tenant:', Boolean(menu), 'with products count:', menu?.products?.length);

  await disconnectDatabase();
}

updateTenant();
