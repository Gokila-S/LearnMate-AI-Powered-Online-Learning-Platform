import express from 'express';
import {
  enrollInCourse,
  getUserEnrollments,
  getEnrollmentDetails,
  markLessonComplete,
  updateCurrentLesson,
  updateLessonWatchProgress,
  unenrollFromCourse,
  downloadCertificate
} from '../controllers/enrollmentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All enrollment routes require authentication
router.use(protect);

router.get('/', getUserEnrollments);
router.post('/:courseId', enrollInCourse);
router.get('/:courseId', getEnrollmentDetails);
router.put('/:courseId/lessons/:lessonId/complete', markLessonComplete);
router.put('/:courseId/lessons/:lessonId/progress', updateLessonWatchProgress);
router.put('/:courseId/current-lesson/:lessonId', updateCurrentLesson);
router.delete('/:courseId', unenrollFromCourse);
router.get('/:courseId/certificate', downloadCertificate);

export default router;
