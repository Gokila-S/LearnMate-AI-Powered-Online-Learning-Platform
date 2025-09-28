import express from 'express';
import {
  getWebsiteAnalytics,
  getAllUsers,
  updateUserRole,
  deleteUser,
  getCourseManagement
} from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Website Admin routes
router.get('/analytics', authorize('website_admin'), getWebsiteAnalytics);
router.get('/users', authorize('website_admin'), getAllUsers);
router.put('/users/:id/role', authorize('website_admin'), updateUserRole);
router.delete('/users/:id', authorize('website_admin'), deleteUser);

// Course Admin & Website Admin routes
router.get('/courses-management', authorize('course_admin', 'website_admin'), getCourseManagement);

export default router;
