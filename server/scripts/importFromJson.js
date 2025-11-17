import fs from 'fs/promises';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Models
import User from '../models/User.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Module from '../models/Module.js';
import Enrollment from '../models/Enrollment.js';
import Payment from '../models/Payment.js';
import ProviderApplication from '../models/ProviderApplication.js';

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map collection keys to file suffix and Model
const COLLECTIONS = [
  { key: 'users', file: 'learnmate.users.json', model: User },
  { key: 'courses', file: 'learnmate.courses.json', model: Course },
  { key: 'lessons', file: 'learnmate.lessons.json', model: Lesson },
  { key: 'modules', file: 'learnmate.modules.json', model: Module },
  { key: 'enrollments', file: 'learnmate.enrollments.json', model: Enrollment },
  { key: 'payments', file: 'learnmate.payments.json', model: Payment },
  { key: 'providerapplications', file: 'learnmate.providerapplications.json', model: ProviderApplication },
];

// Recursively convert Extended JSON to native types
function reviveExtendedJSON(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(reviveExtendedJSON);
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    // ObjectId
    if (keys.length === 1 && ('$oid' in value)) {
      return new mongoose.Types.ObjectId(value.$oid);
    }
    // Date
    if (keys.length === 1 && ('$date' in value)) {
      // Accept ISO string or number
      return new Date(value.$date);
    }
    // Recurse
    const out = {};
    for (const k of keys) {
      out[k] = reviveExtendedJSON(value[k]);
    }
    return out;
  }
  return value;
}

async function readJsonArray(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`Expected an array in ${filePath}`);
  }
  return data.map(reviveExtendedJSON);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dir: undefined, drop: true };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--path=') || a.startsWith('--dir=')) {
      opts.dir = a.split('=')[1].replace(/^"|"$/g, '');
    } else if (a === '--path' || a === '--dir') {
      opts.dir = args[i + 1];
      i++;
    } else if (a === '--no-drop') {
      opts.drop = false;
    }
  }
  return opts;
}

async function main() {
  const { dir, drop } = parseArgs();
  const baseDir = dir
    ? path.resolve(dir)
    : path.resolve(__dirname); // default: script dir (you can pass Downloads path)

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in environment');

  console.log(`Connecting to MongoDB...`);
  const conn = await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  });
  console.log(`Connected: host=${conn.connection.host} db=${conn.connection.name}`);

  let totalInserted = 0;
  for (const { key, file, model } of COLLECTIONS) {
    const filePath = path.join(baseDir, file);
    try {
      await fs.access(filePath);
    } catch {
      console.warn(`⚠️  Skipping ${key}: file not found at ${filePath}`);
      continue;
    }

    console.log(`\nProcessing ${key} from ${filePath}`);
    let docs = await readJsonArray(filePath);
    console.log(`Read ${docs.length} documents`);

    // Collection-specific transforms to match current schema
    if (key === 'users') {
      docs = docs.map((d) => {
        // Map external 'student' role to internal 'user'
        if (d.role === 'student') {
          d.role = 'user';
        }
        return d;
      });
    }

    if (drop) {
      console.log(`Clearing collection ${model.collection.collectionName}...`);
      await model.deleteMany({});
    }

    if (docs.length === 0) {
      console.log(`No documents to insert for ${key}`);
      continue;
    }

    const result = await model.insertMany(docs, { ordered: true });
    const inserted = Array.isArray(result) ? result.length : (result?.insertedCount || 0);
    totalInserted += inserted;
    console.log(`Inserted ${inserted} ${key} documents`);
  }

  await mongoose.disconnect();
  console.log(`\n✅ Import completed. Total inserted: ${totalInserted}`);
}

main().catch(async (err) => {
  console.error('❌ Import failed:', err?.message || err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
