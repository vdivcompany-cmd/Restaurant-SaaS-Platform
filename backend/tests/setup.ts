import 'dotenv/config';
import dns from 'dns';
if (process.env['FORCE_PUBLIC_DNS'] === 'true') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}
import { beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await connectDatabase();
  }
}, 30000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await disconnectDatabase();
  }
}, 30000);
