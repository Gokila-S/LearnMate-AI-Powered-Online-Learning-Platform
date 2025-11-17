import mongoose from 'mongoose';

const moduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Module title is required'],
    trim: true,
    maxlength: 120
  },
  description: {
    type: String,
    maxlength: 500
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  order: {
    type: Number,
    required: true,
    min: 1
  },
  lessons: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lesson'
  }],
  totalLessons: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    default: 0 // minutes
  },
  resources: [{
    title: String,
    url: String,
    type: { type: String }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

moduleSchema.index({ course: 1, order: 1 }, { unique: true });

export default mongoose.model('Module', moduleSchema);
