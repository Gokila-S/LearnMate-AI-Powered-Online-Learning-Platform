import app from './app.js';
import connectDB from './config/database.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`📚 LearnMate API: http://localhost:${PORT}/api/health`);
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        console.log('💳 Razorpay configured: key id present');
      } else {
        console.warn('⚠️  Razorpay NOT configured (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env)');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
