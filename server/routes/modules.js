import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { createModule, updateModule, deleteModule, getModules, addLessonToModule, reorderModules, reorderModuleLessons } from '../controllers/moduleController.js';

const router = express.Router({ mergeParams: true });

// All module routes require auth for modification
router.get('/:courseId', getModules); // public/ or could restrict to enrolled
router.post('/:courseId', protect, authorize('course_admin','website_admin'), createModule);
router.put('/:moduleId', protect, authorize('course_admin','website_admin'), updateModule);
router.delete('/:moduleId', protect, authorize('course_admin','website_admin'), deleteModule);
router.post('/:moduleId/lessons', protect, authorize('course_admin','website_admin'), addLessonToModule);
// Reorder endpoints
// Important: specific literal route first to avoid ":courseId" catching "module"
router.put('/module/:moduleId/reorder', protect, authorize('course_admin','website_admin'), reorderModuleLessons);
router.put('/:courseId/reorder', protect, authorize('course_admin','website_admin'), reorderModules);

export default router;
