import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const checkAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const admins = await User.find({ 
      role: { $in: ['course_admin', 'website_admin'] } 
    }).select('name email role');

    console.log('\nAdmin accounts found:');
    console.log('=====================');
    admins.forEach(admin => {
      console.log(`Name: ${admin.name}`);
      console.log(`Email: ${admin.email}`);
      console.log(`Role: ${admin.role}`);
      console.log('---');
    });

    if (admins.length === 0) {
      console.log('No admin accounts found. Run seedAdmins.js first.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkAdmins();
