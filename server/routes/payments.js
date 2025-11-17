import express from 'express';
import { protect } from '../middleware/auth.js';
import { createOrder, verifyPayment } from '../controllers/paymentController.js';

const router = express.Router();
router.post('/order', protect, createOrder);
router.post('/verify', protect, verifyPayment);

export default router;
