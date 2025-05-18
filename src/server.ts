import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import User from './models/User';
import authRoutes from './routes/auth';
import questionRoutes from './routes/questions';
import examResultRoutes from './routes/exam-results';
import examRoutes from './routes/exam';
import settingsRoutes from './routes/settings';
import { errorHandler } from './middleware/errorHandler';
import logger, { stream } from './utils/logger';

dotenv.config();

// Log startup information
logger.info('Starting server initialization', {
  environment: process.env.NODE_ENV,
  nodeVersion: process.version
});

const app = express();

// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 500, // Limit each IP to 500 requests per `window` (increased from 100)
  windowMs: 60 * 60 * 1000, // 1 hour
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Compression middleware
app.use(compression());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/entrance-exam';

logger.info('Attempting to connect to MongoDB', { 
  uri: MONGODB_URI,
  environment: process.env.NODE_ENV 
});

mongoose.set('strictQuery', false);

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info('MongoDB Connected Successfully', {
      database: mongoose.connection.name,
      host: mongoose.connection.host
    });
    
    // Create admin user if it doesn't exist
    try {
      const adminExists = await User.findOne({ role: 'admin' });
      if (!adminExists) {
        const adminUser = await User.create({
          surname: 'Admin',
          firstName: 'System',
          password: process.env.ADMIN_PASSWORD || 'admin123',
          fullName: 'System Administrator',
          email: process.env.ADMIN_EMAIL || 'admin@goodlyheritage.edu',
          role: 'admin',
        });
        logger.info('Admin user created successfully', {
          fullName: adminUser.fullName,
          email: adminUser.email
        });
      } else {
        logger.info('Admin user already exists', {
          fullName: adminExists.fullName,
          email: adminExists.email
        });
      }
    } catch (error) {
      logger.error('Error creating admin user:', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  } catch (error) {
    logger.error('MongoDB connection error:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
};

connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exam-results', examResultRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/settings', settingsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  };
  logger.info('Health check performed', health);
  res.status(200).json(health);
});

// Root route
app.get('/', (req, res) => {
  const info = {
    message: 'API is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  };
  logger.info('Root route accessed', info);
  res.json(info);
});

// Global error handling
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise,
    reason: reason instanceof Error ? reason.message : reason
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV,
    nodeVersion: process.version
  });
}); 