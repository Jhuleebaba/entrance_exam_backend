import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import User from '../models/User';
import { authenticateToken, isAdmin } from '../middleware/auth';
import Settings from '../models/Settings';

const router = express.Router();

// Get all students (admin only)
router.get('/students', authenticateToken, isAdmin, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password');
    res.json({
      success: true,
      count: students.length,
      students
    });
  } catch (error: any) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: error.message
    });
  }
});

// Register user
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const { surname, firstName, email, dateOfBirth, sex, stateOfOrigin, nationality } = req.body;

    // Validate required fields
    if (!surname || !firstName || !email || !dateOfBirth || !sex || !stateOfOrigin) {
      console.log('Missing required fields:', { surname, firstName, email, dateOfBirth, sex, stateOfOrigin });
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if email already exists
    console.log('Checking for existing user with email:', email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User with email already exists:', email);
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    console.log('Creating new user with data:', { surname, firstName, email, dateOfBirth, sex, stateOfOrigin, nationality });
    // Create user with surname as password
    const user = new User({
      surname,
      firstName,
      email,
      dateOfBirth,
      sex,
      stateOfOrigin,
      nationality: nationality || 'Nigerian', // Default to Nigerian if not provided
      password: surname, // Will be hashed by the pre-save hook
      role: 'student'
    });

    console.log('Saving user...');
    try {
      await user.save();
      console.log('User saved successfully:', {
        examNumber: user.examNumber,
        fullName: user.fullName,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        sex: user.sex,
        stateOfOrigin: user.stateOfOrigin,
        nationality: user.nationality
      });

      // Create token
      const signOptions: SignOptions = { expiresIn: '1d' };
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        signOptions
      );

      console.log('Sending successful registration response');
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        token,
        user: {
          examNumber: user.examNumber,
          surname: user.surname,
          firstName: user.firstName,
          fullName: user.fullName,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          sex: user.sex,
          stateOfOrigin: user.stateOfOrigin,
          nationality: user.nationality,
          role: user.role,
          examGroup: user.examGroup,
          examDateTime: user.examDateTime
        }
      });
    } catch (saveError: any) {
      console.error('Error saving user:', saveError);
      if (saveError.code === 11000) {
        // Duplicate key error
        return res.status(400).json({
          success: false,
          message: 'This email or exam number is already registered'
        });
      }
      throw saveError;
    }
  } catch (error: any) {
    console.error('Registration error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again.',
      error: error.message
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { examNumber, password, email } = req.body;

    // Validate required fields
    if ((!examNumber && !email) || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide exam number/email and password'
      });
    }

    let user;
    // Check for user by exam number (for students) or email (for admin)
    if (examNumber) {
      user = await User.findOne({ examNumber });
    } else if (email) {
      user = await User.findOne({ email });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token
    const signOptions: SignOptions = { expiresIn: '1d' };
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      signOptions
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        examNumber: user.examNumber,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        examGroup: user.examGroup,
        examDateTime: user.examDateTime
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login',
      error: error.message
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user?.id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.json({
      success: true,
      user
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user information',
      error: error.message
    });
  }
});

// Create admin user
router.post('/create-admin', async (req, res) => {
  try {
    const { surname, firstName, email, password } = req.body;

    // Validate required fields
    if (!surname || !firstName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Create admin user
    const user = new User({
      surname,
      firstName,
      email,
      password,
      role: 'admin'
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        fullName: user.fullName,
        email: user.email,
        role: user.role
      }
    });
  } catch (error: any) {
    console.error('Create admin error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while creating admin user',
      error: error.message
    });
  }
});

// Get settings
router.get('/settings', authenticateToken, isAdmin, async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// Update settings
router.put('/settings', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { 
      examDurationMinutes, 
      examInstructions,
      examStartDate,
      examStartTime,
      examGroupSize,
      examGroupIntervalHours,
      examReportNextSteps
    } = req.body;
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ 
        examDurationMinutes,
        examInstructions,
        examStartDate,
        examStartTime,
        examGroupSize,
        examGroupIntervalHours,
        examReportNextSteps
      });
    } else {
      settings.examDurationMinutes = examDurationMinutes;
      if (examInstructions !== undefined) {
        settings.examInstructions = examInstructions;
      }
      if (examStartDate !== undefined) {
        settings.examStartDate = examStartDate;
      }
      if (examStartTime !== undefined) {
        settings.examStartTime = examStartTime;
      }
      if (examGroupSize !== undefined) {
        settings.examGroupSize = examGroupSize;
      }
      if (examGroupIntervalHours !== undefined) {
        settings.examGroupIntervalHours = examGroupIntervalHours;
      }
      if (examReportNextSteps !== undefined) {
        settings.examReportNextSteps = examReportNextSteps;
      }
    }
    await settings.save();
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// Get exam settings (for students)
router.get('/exam-settings', authenticateToken, async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    // Return both duration and instructions for students
    res.json({
      examDurationMinutes: settings.examDurationMinutes,
      examInstructions: settings.examInstructions
    });
  } catch (error) {
    console.error('Error fetching exam settings:', error);
    res.status(500).json({ message: 'Error fetching exam settings' });
  }
});

export default router; 