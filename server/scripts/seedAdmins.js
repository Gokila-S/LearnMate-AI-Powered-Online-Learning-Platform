import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const seedAdmins = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admins already exist
    const existingCourseAdmin = await User.findOne({ email: 'courseadmin@learnmate.com' });
    const existingWebsiteAdmin = await User.findOne({ email: 'websiteadmin@learnmate.com' });

    if (existingCourseAdmin && existingWebsiteAdmin) {
      console.log('Admin users already exist');
      process.exit(0);
    }

    // Create Course Admin
    if (!existingCourseAdmin) {
      const courseAdmin = new User({
        name: 'Course Administrator',
        email: 'courseadmin@learnmate.com',
        password: 'CourseAdmin123!',
        role: 'course_admin',
        bio: 'Course Administrator - Manages courses, lessons, and educational content'
      });
      await courseAdmin.save();
      console.log('Course Admin created:');
      console.log('Email: courseadmin@learnmate.com');
      console.log('Password: CourseAdmin123!');
    }

    // Create Website Admin
    if (!existingWebsiteAdmin) {
      const websiteAdmin = new User({
        name: 'Website Administrator',
        email: 'websiteadmin@learnmate.com',
        password: 'WebsiteAdmin123!',
        role: 'website_admin',
        bio: 'Website Administrator - Oversees platform analytics, users, and system management'
      });
      await websiteAdmin.save();
      console.log('Website Admin created:');
      console.log('Email: websiteadmin@learnmate.com');
      console.log('Password: WebsiteAdmin123!');
    }

    console.log('Admin seeding completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admins:', error);
    process.exit(1);
  }
};

seedAdmins();
