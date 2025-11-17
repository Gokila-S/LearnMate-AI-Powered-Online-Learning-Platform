import express from 'express';
import {
  getCourseDiscussions,
  createDiscussion,
  getDiscussion,
  voteOnDiscussion,
  createMessage,
  voteOnMessage,
  markBestAnswer,
  getOnlineUsers,
  moderateDiscussion,
  deleteDiscussion,
  deleteMessage,
  editMessage
} from '../controllers/discussionController.js';
// Updated: auth middleware exports are protect/authorize, not 'auth'
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Course discussion routes
router.route('/:courseId/discussions')
  .get(protect, getCourseDiscussions)
  .post(protect, createDiscussion);

router.route('/:courseId/discussions/:discussionId')
  .get(protect, getDiscussion);

router.route('/:courseId/online-users')
  .get(protect, getOnlineUsers);

// Discussion voting
router.post('/discussions/:discussionId/vote', protect, voteOnDiscussion);
router.post('/discussions/:discussionId/moderate', protect, moderateDiscussion);
router.delete('/discussions/:discussionId', protect, deleteDiscussion);

// Message routes
router.post('/discussions/:discussionId/messages', protect, createMessage);
router.post('/messages/:messageId/vote', protect, voteOnMessage);
router.post('/messages/:messageId/best-answer', protect, markBestAnswer);
router.put('/messages/:messageId', protect, editMessage);
router.delete('/messages/:messageId', protect, deleteMessage);

export default router;