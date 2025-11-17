import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Course from '../models/Course.js';

// Load env from server/.env relative to this file, not process cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/*
  One-time migration: set Course.owner for existing courses.
  - Defaults to courseadmin@learnmate.com if OWNER_EMAIL not provided.
  - Only updates courses where owner is null/undefined.
*/

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'courseadmin@learnmate.com';

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');

    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const ownerUser = await User.findOne({ email: OWNER_EMAIL });
    if (!ownerUser) {
      throw new Error(`Owner user with email ${OWNER_EMAIL} not found. Seed admins first.`);
    }

    const filter = { $or: [{ owner: null }, { owner: { $exists: false } }] };
    const toUpdate = await Course.countDocuments(filter);
    if (toUpdate === 0) {
      console.log('No courses require owner migration.');
      process.exit(0);
    }

    const res = await Course.updateMany(filter, { $set: { owner: ownerUser._id } });
    console.log(`Updated ${res.modifiedCount ?? res.nModified} course(s) to owner ${OWNER_EMAIL}`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

run();
