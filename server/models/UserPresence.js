import mongoose from 'mongoose';

const userPresenceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  status: {
    type: String,
    enum: ['online', 'away', 'offline'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  currentActivity: {
    type: String,
    enum: ['viewing_course', 'in_discussion', 'watching_lesson', 'idle'],
    default: 'idle'
  },
  socketId: String, // For real-time updates
  isTyping: {
    discussion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion'
    },
    startedAt: Date
  }
}, {
  timestamps: true
});

// Indexes (user has unique:true which already creates an index; avoid duplicate)
userPresenceSchema.index({ course: 1, status: 1 });
userPresenceSchema.index({ lastSeen: 1 });

// Auto-update lastSeen on status change
userPresenceSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'online') {
    this.lastSeen = new Date();
  }
  next();
});

export default mongoose.model('UserPresence', userPresenceSchema);