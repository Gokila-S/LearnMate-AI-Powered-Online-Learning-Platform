import express from 'express';
import {
  getCourses,
  getCourse,
  getCategories,
  createCourse,
  updateCourse,
  deleteCourse,
  addLesson,
  getLesson
} from '../controllers/courseController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validateCourse, validateRequest } from '../middleware/validation.js';
import { lessonUpload } from '../config/upload.js';

const router = express.Router();

// Public routes
router.get('/', getCourses);
router.get('/categories', getCategories);
router.get('/:id', getCourse);

// Protected routes (Admin/Instructor only)
router.use(protect); // Apply authentication to all routes below
router.post('/', authorize('course_admin', 'website_admin'), validateCourse, validateRequest, createCourse);
router.put('/:id', authorize('course_admin', 'website_admin'), updateCourse);
router.delete('/:id', authorize('course_admin', 'website_admin'), deleteCourse);

// Lessons (protected)
router.post('/:id/lessons', authorize('course_admin', 'website_admin'), lessonUpload.single('video'), addLesson);
router.get('/:courseId/lessons/:lessonId', getLesson);

export default router;
