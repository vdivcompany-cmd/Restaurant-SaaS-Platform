import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';

async function listAllCollections() {
  await connectDatabase();
  const db = mongoose.connection.db;
  if (!db) return;
  const cols = await db.listCollections().toArray();
  for (const col of cols) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`📁 Collection: [${col.name}] -> ${count} documents`);
  }
  await disconnectDatabase();
}

listAllCollections();
