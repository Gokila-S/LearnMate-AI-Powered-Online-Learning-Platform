import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { submitProviderApplication, listProviderApplications, approveProviderApplication, denyProviderApplication } from '../controllers/providerController.js';

const router = express.Router();

// Public submit for provider applications
router.post('/applications', submitProviderApplication);

// Website admins manage applications
router.get('/applications', protect, authorize('website_admin'), listProviderApplications);
router.post('/applications/:id/approve', protect, authorize('website_admin'), approveProviderApplication);
router.post('/applications/:id/deny', protect, authorize('website_admin'), denyProviderApplication);

export default router;
