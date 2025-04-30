import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import User from '../models/User';
import { authenticateToken, isAdmin } from '../middleware/auth';
import Settings from '../models/Settings';
import archiver from 'archiver';
import ExamResult from '../models/ExamResult';
import { auth, admin } from '../middleware/auth';
import { JWT_SECRET } from '../config';

const router = express.Router();

// Get all students (admin only)
router.get('/students', auth, admin, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('-password -__v');
    
    if (students.length > 0) {
      console.log(`First student: ${students[0].firstName} ${students[0].lastName}`);
    }
    
    res.json({ students });
  } catch (err: any) {
    console.error('Error fetching students:', err.message);
    res.status(500).send('Server error');
  }
});

// Register user
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', req.body);
    const { surname, firstName, email, phoneNumber, dateOfBirth, sex, stateOfOrigin, nationality } = req.body;

    // Validate required fields
    if (!surname || !firstName || !email || !phoneNumber || !dateOfBirth || !sex || !stateOfOrigin) {
      console.log('Missing required fields:', { surname, firstName, email, phoneNumber, dateOfBirth, sex, stateOfOrigin });
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

    console.log('Creating new user with data:', { surname, firstName, email, phoneNumber, dateOfBirth, sex, stateOfOrigin, nationality });
    // Create user with surname as password
    const user = new User({
      surname,
      firstName,
      email,
      phoneNumber,
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
        phoneNumber: user.phoneNumber,
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

      console.log('Sending successful registration response with phone:', user.phoneNumber);
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
          phoneNumber: user.phoneNumber,
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
    console.log('--- LOGIN ATTEMPT ---');
    console.log('Request Body:', { examNumber, password, email });

    // Validate required fields
    if ((!examNumber && !email) || !password) {
      console.log('Login Validation Failed: Missing fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide exam number/email and password'
      });
    }

    let user;
    // Check for user by exam number (for students) or email (for admin)
    console.log('Finding user by:', examNumber ? `ExamNumber: ${examNumber}` : `Email: ${email}`);
    if (examNumber) {
      user = await User.findOne({ examNumber });
    } else if (email) {
      user = await User.findOne({ email: email });
    }

    if (!user) {
      console.log('Login Failed: User not found with provided identifier.');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    console.log('User Found:', { _id: user._id, email: user.email, role: user.role });

    // Check password
    console.log('Comparing provided password with stored hash...');
    const isMatch = await user.comparePassword(password);
    console.log(`Password Comparison Result (isMatch): ${isMatch}`);

    // Check if this is the admin user based on .env email
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@goodlyheritage.edu';
    const adminPassword = process.env.ADMIN_PASSWORD;
    console.log('Admin Check Values:', { reqEmail: email, userEmail: user.email, adminEmailEnv: adminEmail, reqPassword: password, adminPasswordEnv: adminPassword ? '******' : 'NOT SET' });

    if (!isMatch && user.email === adminEmail && password === adminPassword) {
      // Password from .env matches, but bcrypt compare failed. Hash needs update.
      console.log(`Admin login detected with plain password match for ${adminEmail}. Updating password hash.`);
      user.password = password; // Assign plain password, pre-save hook will hash it
      await user.save();
      console.log(`Admin password hash updated for ${adminEmail}. Proceeding with login.`);
      // Now proceed as if login was successful after update
    } else if (!isMatch) {
      // Regular failed login attempt
      console.log(`Login Failed: Password mismatch for user ${user.email}.`);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    console.log(`Login Succeeded for user ${user.email}.`);

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
        _id: user._id,
        examNumber: user.examNumber,
        surname: user.surname,
        firstName: user.firstName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        examGroup: user.examGroup,
        examDateTime: user.examDateTime,
        dateOfBirth: user.dateOfBirth,
        sex: user.sex,
        stateOfOrigin: user.stateOfOrigin,
        nationality: user.nationality
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

// GET settings
router.get('/settings', auth, async (req, res) => {
  try {
    console.log('Fetching settings...');
    let settings = await Settings.findOne({});
    
    if (!settings) {
      console.log('No settings found, creating default settings...');
      settings = new Settings();
      await settings.save();
    }
    
    console.log('Returning settings:', settings);
    return res.json(settings);
  } catch (err: any) {
    console.error('Error fetching settings:', err.message);
    return res.status(500).json({ message: 'Server error fetching settings' });
  }
});

// GET exam settings for students (public)
router.get('/exam-settings', async (req, res) => {
  try {
    console.log('[Backend] GET /exam-settings route hit');
    // Find settings - there should only be one document
    let settings = await Settings.findOne({});
    
    // If no settings exist yet, create default settings
    if (!settings) {
      console.log('[Backend] No settings found, creating defaults');
      settings = new Settings();
      await settings.save();
    }
    
    // Return only the fields students need to see
    const publicSettings = {
      examDurationMinutes: settings.examDurationMinutes,
      examInstructions: settings.examInstructions,
      examVenue: settings.examVenue,
      examReportNextSteps: settings.examReportNextSteps,
      examSlipInstructions: settings.examSlipInstructions,
      totalExamQuestions: settings.totalExamQuestions
    };
    
    console.log('[Backend] Returning public settings:', publicSettings);
    res.json(publicSettings);
  } catch (error: any) {
    console.error('[Backend] Error fetching exam settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching exam settings',
      error: error.message
    });
  }
});

// UPDATE settings
router.put('/settings', auth, admin, async (req, res) => {
  try {
    console.log('Updating settings with payload:', req.body);
    const {
      examDurationMinutes,
      examInstructions,
      examStartDate,
      examStartTime,
      examGroupSize,
      examGroupIntervalHours,
      examReportNextSteps,
      examSlipInstructions,
      examVenue,
      totalExamQuestions,
      questionsPerSubject
    } = req.body;

    // Find existing settings or create a new one
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = new Settings();
    }

    // Update settings fields
    if (examDurationMinutes) settings.examDurationMinutes = examDurationMinutes;
    if (examInstructions) settings.examInstructions = examInstructions;
    if (examStartDate) settings.examStartDate = examStartDate;
    if (examStartTime) settings.examStartTime = examStartTime;
    if (examGroupSize) settings.examGroupSize = examGroupSize;
    if (examGroupIntervalHours) settings.examGroupIntervalHours = examGroupIntervalHours;
    if (examReportNextSteps) settings.examReportNextSteps = examReportNextSteps;
    if (examSlipInstructions) settings.examSlipInstructions = examSlipInstructions;
    if (examVenue) settings.examVenue = examVenue;
    if (totalExamQuestions !== undefined) settings.totalExamQuestions = totalExamQuestions;
    
    // Handle questionsPerSubject specially since it's a Map in MongoDB
    if (questionsPerSubject) {
      // Clear existing map
      settings.questionsPerSubject.clear();
      
      // Add new entries, ensuring only the fixed subjects are set
      const fixedSubjects = {
        'Mathematics': 20,
        'English': 20,
        'Quantitative Reasoning': 20,
        'Verbal Reasoning': 20,
        'General Paper': 20
      };
      
      for (const [subject, count] of Object.entries(fixedSubjects)) {
        settings.questionsPerSubject.set(subject, count);
      }
      
      // Update total questions to match fixed structure
      settings.totalExamQuestions = 100;
      
      console.log('Updated questionsPerSubject:', 
        Array.from(settings.questionsPerSubject.entries()));
    }

    await settings.save();
    console.log('Settings saved successfully');
    
    res.json({ success: true, settings });
  } catch (err: any) {
    console.error('Error updating settings:', err.message);
    res.status(500).json({ success: false, message: 'Server error updating settings' });
  }
});

// Archive and reset year data (admin only)
router.post('/archive-year', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Set response headers for zip download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=archive_${new Date().getFullYear()}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    // Pipe archive data to response
    archive.pipe(res);

    // Fetch all student users and exam results
    const students = await User.find({ role: 'student' }).select('-password').lean();
    const examResults = await ExamResult.find().lean();

    // Append JSON files to the archive
    archive.append(JSON.stringify(students, null, 2), { name: 'students.json' });
    archive.append(JSON.stringify(examResults, null, 2), { name: 'examResults.json' });

    // Finalize the archive
    await archive.finalize();

    // After streaming, clear the collections
    await User.deleteMany({ role: 'student' });
    await ExamResult.deleteMany({});
  } catch (error: any) {
    console.error('Archive year error:', error);
    res.status(500).json({ success: false, message: 'Error archiving data', error: error.message });
  }
});

export default router; 