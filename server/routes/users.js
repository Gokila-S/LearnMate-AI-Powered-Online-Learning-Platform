import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  addBookmark,
  removeBookmark,
  getUserBookmarks
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All user routes require authentication
router.use(protect);

router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.get('/bookmarks', getUserBookmarks);
router.post('/bookmarks/:lessonId', addBookmark);
router.delete('/bookmarks/:lessonId', removeBookmark);

export default router;
