import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a lesson title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a lesson description'],
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  content: {
    type: {
      type: String,
      enum: ['video', 'youtube', 'text', 'quiz', 'assignment', 'assessment'],
      required: true
    },
    data: {
      // For video: { videoUrl, duration }
      // For youtube: { youtubeUrl, videoId, duration }
      // For text: { htmlContent }
      // For quiz: { questions: [{ question, options, correct }] }
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
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
  duration: {
    type: Number, // in minutes
    default: 0
  },
  isPreview: {
    type: Boolean,
    default: false // Free preview lessons
  },
  resources: [{
    title: String,
    url: String,
    type: {
      type: String,
      enum: ['pdf', 'link', 'download', 'other']
    }
  }],
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

// Ensure lesson order is unique within a course
lessonSchema.index({ course: 1, order: 1 }, { unique: true });

export default mongoose.model('Lesson', lessonSchema);
