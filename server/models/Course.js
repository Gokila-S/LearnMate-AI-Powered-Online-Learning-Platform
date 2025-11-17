import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  // The owning provider / course admin for access scoping
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null
  },
  title: {
    type: String,
    required: [true, 'Please provide a course title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a course description'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  shortDescription: {
    type: String,
    required: [true, 'Please provide a short description'],
    maxlength: [200, 'Short description cannot be more than 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Please provide a category'],
    enum: [
      'Programming',
      'Design',
      'Business',
      'Marketing',
      'Data Science',
      'Mobile Development',
      'Web Development',
      'DevOps',
      'AI/ML',
      'Other'
    ]
  },
  level: {
    type: String,
    required: [true, 'Please specify course level'],
    enum: ['Beginner', 'Intermediate', 'Advanced']
  },
  instructor: {
    name: {
      type: String,
      required: true
    },
    bio: String,
    avatar: String
  },
  thumbnail: {
    type: String,
    default: null
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative']
  },
  duration: {
    type: Number, // in minutes
    required: [true, 'Please provide course duration']
  },
  lessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  modules: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module'
  }],
  totalModules: {
    type: Number,
    default: 0
  },
  totalLessons: {
    type: Number,
    default: 0
  },
  enrolledStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  totalEnrollments: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  tags: [String],
  isPublished: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for search functionality
courseSchema.index({ title: 'text', description: 'text', tags: 'text' });
// Index to optimize prefix (starts-with) searches on title
courseSchema.index({ title: 1 });

// Also index owner with createdAt for common dashboard queries
courseSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model('Course', courseSchema);
