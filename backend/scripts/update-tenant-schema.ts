import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { TenantModel } from '../src/modules/tenants/model.js';

async function updateTenantSchema() {
  await connectDatabase();

  const tenantIdStr = '6a85e588d0b508058fc5008c';
  const tenantObjectId = new mongoose.Types.ObjectId(tenantIdStr);

  const tenantData = {
    _id: tenantObjectId,
    name: 'Apple Food',
    slug: 'apple-food',
    status: 'active' as const,
    subscriptionPlan: 'pro',
    contact: {
      phone: '+201000000000',
      email: 'contact@applefood.com',
    },
    settings: {
      currency: 'EGP',
      timezone: 'Africa/Cairo',
      language: 'ar' as const,
    },
    brandName: 'Apple Food',
    cuisineType: 'بيتزا وكريب',
    description: 'أشهى المأكولات والبيتزا والكريب من Apple Food',
    qrRedirectUrl: 'https://apple-food-sepia.vercel.app',
    isOpen: true,
    isChatbotActive: true,
    chatbotSettings: {
      offlineMessage: 'نحن مغلقون حالياً. يرجى مراجعتنا خلال ساعات العمل!',
      aiModelPreference: 'models/gemini-3.5-flash',
    },
  };

  const updatedTenant = await TenantModel.findByIdAndUpdate(
    tenantObjectId,
    { $set: tenantData },
    { upsert: true, new: true, runValidators: true }
  );

  console.log('✅ Updated Tenant with full Schema Model:');
  console.log(JSON.stringify(updatedTenant, null, 2));

  await disconnectDatabase();
}

updateTenantSchema();
