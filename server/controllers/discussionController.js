import Discussion from '../models/Discussion.js';
import DiscussionMessage from '../models/DiscussionMessage.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import UserPresence from '../models/UserPresence.js';

// @desc    Get course discussions with pagination and filtering
// @route   GET /api/courses/:courseId/discussions
// @access  Private (enrolled users)
export const getCourseDiscussions = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { 
      page = 1, 
      limit = 20, 
      category, 
      sort = 'lastActivity',
      order = 'desc',
      search,
      tags 
    } = req.query;

    // Check if user is enrolled in the course
    // Enrollment model uses 'student' field (not 'user')
    const enrollment = await Enrollment.findOne({ 
      student: req.user._id, 
      course: courseId 
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to access discussions'
      });
    }

    // Build query
    let query = { course: courseId };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    // Sort configuration
    const sortConfig = {};
    if (sort === 'lastActivity') {
      sortConfig.isPinned = -1; // Pinned first
      sortConfig.lastActivity = order === 'desc' ? -1 : 1;
    } else if (sort === 'created') {
      sortConfig.isPinned = -1;
      sortConfig.createdAt = order === 'desc' ? -1 : 1;
    } else if (sort === 'votes') {
      // We'll need to calculate this dynamically
      sortConfig.isPinned = -1;
    }

    const discussions = await Discussion.find(query)
      .populate('author', 'name profilePicture role')
      .populate('lastMessage', 'content author createdAt')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'author',
          select: 'name profilePicture'
        }
      })
      .sort(sortConfig)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Add vote counts and user vote status
    const discussionsWithVotes = discussions.map(discussion => ({
      ...discussion,
      upvoteCount: discussion.upvotes?.length || 0,
      downvoteCount: discussion.downvotes?.length || 0,
      totalVotes: (discussion.upvotes?.length || 0) - (discussion.downvotes?.length || 0),
      userVote: discussion.upvotes?.some(v => v.user.toString() === req.user._id.toString()) 
        ? 'up' 
        : discussion.downvotes?.some(v => v.user.toString() === req.user._id.toString()) 
        ? 'down' 
        : null
    }));

    const total = await Discussion.countDocuments(query);

    res.status(200).json({
      success: true,
      data: discussionsWithVotes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalDiscussions: total,
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new discussion
// @route   POST /api/courses/:courseId/discussions
// @access  Private (enrolled users)
export const createDiscussion = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, content, category, tags } = req.body;

    // Check enrollment
    const enrollment = await Enrollment.findOne({ 
      student: req.user._id, 
      course: courseId 
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to create discussions'
      });
    }

    // Validate input
    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    const discussion = await Discussion.create({
      title: title.trim(),
      content: content.trim(),
      course: courseId,
      author: req.user._id,
      category: category || 'general',
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : []
    });

    await discussion.populate('author', 'name profilePicture role');

    res.status(201).json({
      success: true,
      data: discussion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single discussion with messages
// @route   GET /api/courses/:courseId/discussions/:discussionId
// @access  Private (enrolled users)
export const getDiscussion = async (req, res, next) => {
  try {
    const { courseId, discussionId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check enrollment
    const enrollment = await Enrollment.findOne({ 
      student: req.user._id, 
      course: courseId 
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to access discussions'
      });
    }

    // Get discussion and increment views
    const discussion = await Discussion.findByIdAndUpdate(
      discussionId,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('author', 'name profilePicture role bio');

    if (!discussion || discussion.course.toString() !== courseId) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Get messages with pagination (parent messages only, replies loaded separately)
    const messages = await DiscussionMessage.find({
      discussion: discussionId,
      parentMessage: null,
      isDeleted: false
    })
      .populate('author', 'name profilePicture role')
      .populate({
        path: 'replies',
        match: { isDeleted: false },
        populate: {
          path: 'author',
          select: 'name profilePicture role'
        },
        options: { sort: { createdAt: 1 } }
      })
      .sort({ isBestAnswer: -1, createdAt: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Add vote information for messages
    const messagesWithVotes = messages.map(message => ({
      ...message,
      upvoteCount: message.upvotes?.length || 0,
      downvoteCount: message.downvotes?.length || 0,
      totalVotes: (message.upvotes?.length || 0) - (message.downvotes?.length || 0),
      userVote: message.upvotes?.some(v => v.user.toString() === req.user._id.toString()) 
        ? 'up' 
        : message.downvotes?.some(v => v.user.toString() === req.user._id.toString()) 
        ? 'down' 
        : null,
      replies: message.replies?.map(reply => ({
        ...reply,
        upvoteCount: reply.upvotes?.length || 0,
        downvoteCount: reply.downvotes?.length || 0,
        totalVotes: (reply.upvotes?.length || 0) - (reply.downvotes?.length || 0),
        userVote: reply.upvotes?.some(v => v.user.toString() === req.user._id.toString()) 
          ? 'up' 
          : reply.downvotes?.some(v => v.user.toString() === req.user._id.toString()) 
          ? 'down' 
          : null
      })) || []
    }));

    const totalMessages = await DiscussionMessage.countDocuments({
      discussion: discussionId,
      parentMessage: null,
      isDeleted: false
    });

    // Add discussion vote information
    const discussionWithVotes = {
      ...discussion.toObject(),
      upvoteCount: discussion.upvotes?.length || 0,
      downvoteCount: discussion.downvotes?.length || 0,
      totalVotes: (discussion.upvotes?.length || 0) - (discussion.downvotes?.length || 0),
      userVote: discussion.upvotes?.some(v => v.user.toString() === req.user._id.toString()) 
        ? 'up' 
        : discussion.downvotes?.some(v => v.user.toString() === req.user._id.toString()) 
        ? 'down' 
        : null
    };

    res.status(200).json({
      success: true,
      data: {
        discussion: discussionWithVotes,
        messages: messagesWithVotes,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalMessages / limit),
          totalMessages,
          hasMore: page * limit < totalMessages
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vote on discussion (upvote/downvote)
// @route   POST /api/discussions/:discussionId/vote
// @access  Private
export const voteOnDiscussion = async (req, res, next) => {
  try {
    const { discussionId } = req.params;
    const { type } = req.body; // 'up', 'down', or 'remove'

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check enrollment in the course
    const enrollment = await Enrollment.findOne({ 
      student: req.user._id, 
      course: discussion.course 
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to vote'
      });
    }

    const userId = req.user._id;

    // Remove existing votes
    discussion.upvotes = discussion.upvotes.filter(v => v.user.toString() !== userId.toString());
    discussion.downvotes = discussion.downvotes.filter(v => v.user.toString() !== userId.toString());

    // Add new vote if not removing
    if (type === 'up') {
      discussion.upvotes.push({ user: userId });
    } else if (type === 'down') {
      discussion.downvotes.push({ user: userId });
    }

    await discussion.save();

    res.status(200).json({
      success: true,
      data: {
        upvoteCount: discussion.upvotes.length,
        downvoteCount: discussion.downvotes.length,
        totalVotes: discussion.upvotes.length - discussion.downvotes.length,
        userVote: type === 'remove' ? null : type
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new message in discussion
// @route   POST /api/discussions/:discussionId/messages
// @access  Private
export const createMessage = async (req, res, next) => {
  try {
    const { discussionId } = req.params;
    const { content, parentMessageId } = req.body;

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check if discussion is locked
    if (discussion.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'This discussion is locked'
      });
    }

    // Check enrollment
    const enrollment = await Enrollment.findOne({ 
      student: req.user._id, 
      course: discussion.course 
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to post messages'
      });
    }

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const message = await DiscussionMessage.create({
      content: content.trim(),
      discussion: discussionId,
      author: req.user._id,
      parentMessage: parentMessageId || null
    });

    await message.populate('author', 'name profilePicture role');

    // Update parent message reply count if this is a reply
    if (parentMessageId) {
      await DiscussionMessage.findByIdAndUpdate(
        parentMessageId,
        { $inc: { replyCount: 1 } }
      );
    }

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vote on message
// @route   POST /api/messages/:messageId/vote
// @access  Private
export const voteOnMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { type } = req.body; // 'up', 'down', or 'remove'

    const message = await DiscussionMessage.findById(messageId).populate('discussion');
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check enrollment (Enrollment model uses 'student' field, not 'user')
    const enrollment = await Enrollment.findOne({ 
      student: req.user._id, 
      course: message.discussion.course 
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to vote'
      });
    }

    const userId = req.user._id;

    // Remove existing votes
    message.upvotes = message.upvotes.filter(v => v.user.toString() !== userId.toString());
    message.downvotes = message.downvotes.filter(v => v.user.toString() !== userId.toString());

    // Add new vote if not removing
    if (type === 'up') {
      message.upvotes.push({ user: userId });
    } else if (type === 'down') {
      message.downvotes.push({ user: userId });
    }

    await message.save();

    res.status(200).json({
      success: true,
      data: {
        upvoteCount: message.upvotes.length,
        downvoteCount: message.downvotes.length,
        totalVotes: message.upvotes.length - message.downvotes.length,
        userVote: type === 'remove' ? null : type
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark message as best answer (course owner/instructors only)
// @route   POST /api/messages/:messageId/best-answer
// @access  Private
export const markBestAnswer = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await DiscussionMessage.findById(messageId)
      .populate('discussion')
      .populate({
        path: 'discussion',
        populate: { path: 'course', select: 'owner' }
      });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is course owner, website admin, or discussion author
    const isAuthorized = req.user.role === 'website_admin' || 
                        req.user.role === 'course_admin' ||
                        message.discussion.author.toString() === req.user._id.toString() ||
                        (message.discussion.course.owner && message.discussion.course.owner.toString() === req.user._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to mark best answer'
      });
    }

    // Remove best answer status from other messages in this discussion
    await DiscussionMessage.updateMany(
      { discussion: message.discussion._id },
      { 
        $set: { 
          isBestAnswer: false,
          bestAnswerSelectedBy: null,
          bestAnswerSelectedAt: null
        }
      }
    );

    // Set this message as best answer
    message.isBestAnswer = true;
    message.bestAnswerSelectedBy = req.user._id;
    message.bestAnswerSelectedAt = new Date();
    await message.save();

    // Mark discussion as resolved
    await Discussion.findByIdAndUpdate(message.discussion._id, {
      isResolved: true,
      resolvedBy: req.user._id,
      resolvedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Message marked as best answer'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get online users in course
// @route   GET /api/courses/:courseId/online-users
// @access  Private
export const getOnlineUsers = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    // Check enrollment
    const enrollment = await Enrollment.findOne({ 
      student: req.user._id, 
      course: courseId 
    });
    
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to see online users'
      });
    }

    const onlineUsers = await UserPresence.find({
      course: courseId,
      status: 'online',
      lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
    }).populate('user', 'name profilePicture role');

    res.status(200).json({
      success: true,
      data: onlineUsers.map(presence => ({
        user: presence.user,
        status: presence.status,
        currentActivity: presence.currentActivity,
        lastSeen: presence.lastSeen
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Moderate discussion (pin, lock, resolve, etc.)
// @route   POST /api/discussions/:discussionId/moderate
// @access  Private
export const moderateDiscussion = async (req, res, next) => {
  try {
    const { discussionId } = req.params;
    const { action, value } = req.body;

    const discussion = await Discussion.findById(discussionId).populate('course');
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check moderation permissions
    const isAuthorized = req.user.role === 'website_admin' || 
                        req.user.role === 'course_admin' ||
                        discussion.author.toString() === req.user._id.toString() ||
                        (discussion.course.owner && discussion.course.owner.toString() === req.user._id.toString());

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to moderate this discussion'
      });
    }

    // Apply moderation action
    switch (action) {
      case 'pin':
        discussion.isPinned = value;
        break;
      case 'lock':
        discussion.isLocked = value;
        break;
      case 'resolve':
        discussion.isResolved = value;
        if (value) {
          discussion.resolvedBy = req.user._id;
          discussion.resolvedAt = new Date();
        } else {
          discussion.resolvedBy = null;
          discussion.resolvedAt = null;
        }
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid moderation action'
        });
    }

    await discussion.save();

    res.status(200).json({
      success: true,
      data: discussion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete discussion
// @route   DELETE /api/discussions/:discussionId
// @access  Private
export const deleteDiscussion = async (req, res, next) => {
  try {
    const { discussionId } = req.params;

    const discussion = await Discussion.findById(discussionId).populate('course');
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check delete permissions (only author or admins)
    const canDelete = req.user.role === 'website_admin' || 
                     discussion.author.toString() === req.user._id.toString();

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this discussion'
      });
    }

    // Delete all messages in the discussion
    await DiscussionMessage.deleteMany({ discussion: discussionId });

    // Delete the discussion
    await Discussion.findByIdAndDelete(discussionId);

    res.status(200).json({
      success: true,
      message: 'Discussion deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:messageId
// @access  Private
export const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await DiscussionMessage.findById(messageId)
      .populate('discussion')
      .populate({
        path: 'discussion',
        populate: { path: 'course' }
      });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check delete permissions
    const canDelete = req.user.role === 'website_admin' || 
                     message.author.toString() === req.user._id.toString();

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    // Soft delete - mark as deleted instead of removing
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = req.user._id;
    await message.save();

    // Decrement messageCount on parent discussion (only if it was a top-level message)
    try {
      if (!message.parentMessage) {
        await Discussion.findByIdAndUpdate(message.discussion._id, {
          $inc: { messageCount: -1 },
          lastActivity: new Date()
        });
      } else {
        // If it's a reply, decrement replyCount of parent
        await DiscussionMessage.findByIdAndUpdate(message.parentMessage, { $inc: { replyCount: -1 } });
      }
    } catch (adjError) {
      console.error('[deleteMessage] count adjustment failed', adjError);
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      data: { messageId: message._id }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit message
// @route   PUT /api/messages/:messageId
// @access  Private
export const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const message = await DiscussionMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check edit permissions (only author)
    if (message.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this message'
      });
    }

    // Store edit history
    if (!message.editHistory) {
      message.editHistory = [];
    }
    message.editHistory.push({
      content: message.content,
      editedAt: new Date()
    });

    // Update message
    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();
    await message.populate('author', 'name profilePicture role');

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};

// Note: Individual named exports are declared above (export const ...). A final aggregate export
// block was removed to avoid duplicate export name errors in Node ESM ("Duplicate export").