import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { updateLesson, deleteLesson } from '../controllers/lessonController.js';
import { lessonUpload } from '../config/upload.js';

const router = express.Router();

// All lesson modification routes require auth
router.use(protect);

router.put('/:lessonId', authorize('course_admin', 'website_admin'), lessonUpload.single('video'), updateLesson);
router.delete('/:lessonId', authorize('course_admin', 'website_admin'), deleteLesson);

export default router;
