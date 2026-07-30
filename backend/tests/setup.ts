import 'dotenv/config';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }
}, 30000);

beforeEach(async () => {
  if (mongoose.connection.readyState !== 0 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
}, 30000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await disconnectDatabase();
  }
}, 30000);
