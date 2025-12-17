import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Middleware imports
import errorHandler from './middleware/errorHandler.js';

// Route imports
import courseRoutes from './routes/courses.js';
import paymentRoutes from './routes/payments.js';
import enrollmentRoutes from './routes/enrollments.js';
import userRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import moduleRoutes from './routes/modules.js';
import providerRoutes from './routes/providers.js';
import lessonRoutes from './routes/lessons.js';
import discussionRoutes from './routes/discussions.js';
import aiRoutes from './routes/ai.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploaded lesson videos/resources
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/courses', discussionRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/modules', moduleRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/ai', aiRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'LearnMate API is running!',
    timestamp: new Date().toISOString()
  });
});

// Handle undefined routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
