import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db';
import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import examResultRoutes from './routes/exam-results';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',  // Local development
    'https://ghs-entrance-exam-app.netlify.app',  // Production frontend
    process.env.FRONTEND_URL || 'http://localhost:3000'  // Fallback
  ],
  credentials: true
}));
app.use(express.json());

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exam-results', examResultRoutes);

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/entrance-exam';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connection established'))
  .catch((error) => console.error('MongoDB connection error:', error));

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 