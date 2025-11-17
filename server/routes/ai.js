import express from 'express';
import { chatWithAI, generateQuizQuestions, generateQuizVariant } from '../controllers/aiController.js';

const router = express.Router();

// POST /api/ai/chat
router.post('/chat', chatWithAI);
router.post('/generate-quiz', generateQuizQuestions);
router.post('/generate-quiz-variant', generateQuizVariant);

export default router;
