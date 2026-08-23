import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';

async function updateTenant() {
  await connectDatabase();
  const db = mongoose.connection.db;
  if (!db) return;

  const tenantIdStr = '6a85e588d0b508058fc5008c';
  const tenantObjectId = new mongoose.Types.ObjectId(tenantIdStr);

  const tenantDoc = {
    _id: tenantObjectId,
    name: 'Apple Food',
    slug: 'apple-food',
    status: 'active',
    subscriptionPlan: 'pro',
    contact: {
      phone: '+201000000000',
      email: 'contact@applefood.com'
    },
    settings: {
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      language: 'ar'
    },
    brandName: 'Apple Food',
    cuisineType: 'بيتزا وكريب',
    description: 'أشهى المأكولات والبيتزا والكريب من Apple Food',
    qrRedirectUrl: 'https://apple-food-sepia.vercel.app',
    isOpen: true,
    isChatbotActive: true,
    chatbotSettings: {
      offlineMessage: 'نحن مغلقون حالياً. يرجى مراجعتنا خلال ساعات العمل!',
      aiModelPreference: 'models/gemini-3.5-flash'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const res = await db.collection('tenants').replaceOne(
    { _id: tenantObjectId },
    tenantDoc,
    { upsert: true }
  );
  console.log('✅ Replaced tenant result:', res);

  const found = await db.collection('tenants').findOne({ _id: tenantObjectId });
  console.log('Confirmed tenant in DB:', JSON.stringify(found, null, 2));

  await disconnectDatabase();
}

updateTenant();

