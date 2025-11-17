import mongoose from 'mongoose';

const discussionMessageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  discussion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiscussionMessage',
    default: null
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  mentions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    position: Number // Character position in the message
  }],
  reactions: [{
    emoji: {
      type: String,
      required: true
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    count: {
      type: Number,
      default: 0
    }
  }],
  upvotes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  downvotes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  replyCount: {
    type: Number,
    default: 0
  },
  isBestAnswer: {
    type: Boolean,
    default: false
  },
  bestAnswerSelectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  bestAnswerSelectedAt: Date
}, {
  timestamps: true
});

// Indexes for efficient querying
discussionMessageSchema.index({ discussion: 1, createdAt: 1 });
discussionMessageSchema.index({ discussion: 1, parentMessage: 1, createdAt: 1 });
discussionMessageSchema.index({ author: 1 });
discussionMessageSchema.index({ discussion: 1, isBestAnswer: 1 });

// Virtual for total votes
discussionMessageSchema.virtual('totalVotes').get(function() {
  return this.upvotes.length - this.downvotes.length;
});

// Virtual for nested replies (only first level)
discussionMessageSchema.virtual('replies', {
  ref: 'DiscussionMessage',
  localField: '_id',
  foreignField: 'parentMessage'
});

// Update parent discussion's lastActivity and messageCount
discussionMessageSchema.post('save', async function() {
  const Discussion = mongoose.model('Discussion');
  
  if (this.isNew && !this.isDeleted) {
    await Discussion.findByIdAndUpdate(
      this.discussion,
      {
        $inc: { messageCount: 1 },
        lastActivity: new Date(),
        lastMessage: this._id
      }
    );
  }
});

// Update message count when message is deleted
discussionMessageSchema.post('findOneAndUpdate', async function(doc) {
  if (doc && doc.isDeleted) {
    const Discussion = mongoose.model('Discussion');
    await Discussion.findByIdAndUpdate(
      doc.discussion,
      {
        $inc: { messageCount: -1 },
        lastActivity: new Date()
      }
    );
  }
});

export default mongoose.model('DiscussionMessage', discussionMessageSchema);