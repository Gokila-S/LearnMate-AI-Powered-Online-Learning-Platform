import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI not set');

    // Prefer options suitable for Atlas; Mongoose 8 uses drivers defaults
    const conn = await mongoose.connect(uri, {
      // bufferCommands default is true; keep default
      // maxPoolSize for Atlas typical usage
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000
    });
    const { host, name } = conn.connection;
    console.log(`MongoDB Connected: host=${host} db=${name}`);
  } catch (error) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
