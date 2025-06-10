import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import User from '../models/User';
import { authenticateToken as auth, isAdmin as admin } from '../middleware/auth';
import Settings from '../models/Settings';
import archiver from 'archiver';
import ExamResult from '../models/ExamResult';
import { JWT_SECRET } from '../config';

const router = express.Router();

// Initialize empty scores object
const emptyScores = {
  Mathematics: 0,
  English: 0,
  'Quantitative Reasoning': 0,
  'Verbal Reasoning': 0,
  'General Paper': 0
};

// Helper function to clear scores
function clearScores(scores: typeof emptyScores) {
  Object.keys(scores).forEach(key => {
    scores[key as keyof typeof scores] = 0;
  });
  return scores;
}

// Helper function to set a score
function setScore(scores: typeof emptyScores, subject: keyof typeof scores, value: number) {
  scores[subject] = value;
  return scores;
}

// Get all students (admin only)
router.get('/students', auth, admin, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('-password -__v');
    
    // Convert to objects and ensure fullName is always available
    const studentsWithFullName = students.map(student => {
      const studentObj = student.toObject();
      return {
        ...studentObj,
        fullName: studentObj.fullName || `${student.firstName || ''} ${student.surname || ''}`.trim() || 'Name not available',
        phoneNumber: student.phoneNumber || 'Not provided'
      };
    });
    
    console.log(`Fetched ${studentsWithFullName.length} students`);
    if (studentsWithFullName.length > 0) {
      console.log(`First student: ${studentsWithFullName[0].firstName} ${studentsWithFullName[0].surname} (${studentsWithFullName[0].fullName})`);
      console.log(`Exam group: ${studentsWithFullName[0].examGroup}, Exam date: ${studentsWithFullName[0].examDateTime}`);
    }
    
    res.json({ 
      success: true,
      students: studentsWithFullName 
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
router.get('/me', auth, async (req, res) => {
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
router.get('/settings', auth, admin, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      // Create default settings if none exist
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      settings = new Settings({
        examDuration: 120,
        examStartTime: oneWeekFromNow,
        examEndTime: twoWeeksFromNow,
        registrationStartDate: now,
        registrationEndDate: oneWeekFromNow,
        examYear: new Date().getFullYear(),
        examStartDate: oneWeekFromNow,
        examGroupSize: 10,
        examGroupIntervalHours: 2,
        totalExamQuestions: 100,
        questionsPerSubject: {
          Mathematics: 20,
          English: 20,
          'Quantitative Reasoning': 20,
          'Verbal Reasoning': 20,
          'General Paper': 20
        }
      });
      await settings.save();
    }

    res.json({
      success: true,
      settings: {
        examDurationMinutes: settings.examDuration, // Map examDuration to examDurationMinutes
        examDuration: settings.examDuration,
        examInstructions: settings.examInstructions,
        examStartTime: settings.examStartTimeString || '09:00', // Return time string for frontend
        examStartTimeDate: settings.examStartTime, // Keep original for backwards compatibility
        examEndTime: settings.examEndTime,
        examStartDate: settings.examStartDate,
        examGroupSize: settings.examGroupSize,
        examGroupIntervalHours: settings.examGroupIntervalHours,
        examReportNextSteps: settings.examReportNextSteps,
        examSlipInstructions: settings.examSlipInstructions,
        examVenue: settings.examVenue,
        totalExamQuestions: settings.totalExamQuestions,
        registrationStartDate: settings.registrationStartDate,
        registrationEndDate: settings.registrationEndDate,
        examYear: settings.examYear,
        questionsPerSubject: settings.questionsPerSubject
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching settings',
      error: error.message
    });
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
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      settings = new Settings({
        examDuration: 120,
        examStartTime: oneWeekFromNow,
        examEndTime: twoWeeksFromNow,
        registrationStartDate: now,
        registrationEndDate: oneWeekFromNow,
        examYear: new Date().getFullYear(),
        examStartDate: oneWeekFromNow,
        examGroupSize: 10,
        examGroupIntervalHours: 2,
        totalExamQuestions: 100,
        questionsPerSubject: {
          Mathematics: 20,
          English: 20,
          'Quantitative Reasoning': 20,
          'Verbal Reasoning': 20,
          'General Paper': 20
        }
      });
      await settings.save();
    }
    
    // Return only the fields students need to see
    const publicSettings = {
      examDurationMinutes: settings.examDuration, // Map examDuration to examDurationMinutes for frontend
      examDuration: settings.examDuration,
      examInstructions: settings.examInstructions,
      examStartTime: settings.examStartTime,
      examEndTime: settings.examEndTime,
      registrationStartDate: settings.registrationStartDate,
      registrationEndDate: settings.registrationEndDate,
      examYear: settings.examYear,
      questionsPerSubject: settings.questionsPerSubject
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

// Update settings
router.put('/settings', auth, admin, async (req, res) => {
  try {
    console.log('[Backend] PUT /settings - Request body:', req.body);
    console.log('[Backend] PUT /settings - User:', req.user);
    
    const {
      examDurationMinutes,
      examDuration,
      examInstructions,
      examStartTime,
      examEndTime,
      examStartDate,
      examGroupSize,
      examGroupIntervalHours,
      examReportNextSteps,
      examSlipInstructions,
      examVenue,
      totalExamQuestions,
      registrationStartDate,
      registrationEndDate,
      examYear,
      questionsPerSubject
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      console.log('[Backend] No settings found, creating new one');
      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      
      settings = new Settings({
        examDuration: 120,
        examStartTime: oneWeekFromNow,
        examEndTime: twoWeeksFromNow,
        registrationStartDate: now,
        registrationEndDate: oneWeekFromNow,
        examYear: new Date().getFullYear(),
        examStartDate: oneWeekFromNow,
        examGroupSize: 10,
        examGroupIntervalHours: 2,
        totalExamQuestions: 100,
        examStartTimeString: '09:00',
        questionsPerSubject: {
          Mathematics: 20,
          English: 20,
          'Quantitative Reasoning': 20,
          'Verbal Reasoning': 20,
          'General Paper': 20
        }
      });
    }

    // Update fields if provided - handle both examDuration and examDurationMinutes
    if (examDurationMinutes !== undefined) settings.examDuration = examDurationMinutes;
    if (examDuration !== undefined) settings.examDuration = examDuration;
    if (examInstructions !== undefined) settings.examInstructions = examInstructions;
    if (examStartTime !== undefined) {
      // Handle examStartTime - if it's a time string like "09:00", store it in examStartTimeString
      // If it's a date, store it in examStartTime (for backwards compatibility)
      if (typeof examStartTime === 'string' && examStartTime.includes(':')) {
        settings.examStartTimeString = examStartTime;
        console.log('[Backend] Set examStartTimeString to:', examStartTime);
      } else {
        settings.examStartTime = new Date(examStartTime);
        console.log('[Backend] Set examStartTime to:', new Date(examStartTime));
      }
    }
    if (examEndTime !== undefined) settings.examEndTime = new Date(examEndTime);
    if (examStartDate !== undefined) {
      settings.examStartDate = new Date(examStartDate);
      console.log('[Backend] Set examStartDate to:', new Date(examStartDate));
    }
    if (examGroupSize !== undefined) settings.examGroupSize = examGroupSize;
    if (examGroupIntervalHours !== undefined) settings.examGroupIntervalHours = examGroupIntervalHours;
    if (examReportNextSteps !== undefined) settings.examReportNextSteps = examReportNextSteps;
    if (examSlipInstructions !== undefined) settings.examSlipInstructions = examSlipInstructions;
    if (examVenue !== undefined) settings.examVenue = examVenue;
    if (totalExamQuestions !== undefined) settings.totalExamQuestions = totalExamQuestions;
    if (registrationStartDate !== undefined) settings.registrationStartDate = new Date(registrationStartDate);
    if (registrationEndDate !== undefined) settings.registrationEndDate = new Date(registrationEndDate);
    if (examYear !== undefined) settings.examYear = examYear;

    // Update questions per subject
    if (questionsPerSubject) {
      settings.questionsPerSubject = {
        Mathematics: 20,
        English: 20,
        'Quantitative Reasoning': 20,
        'Verbal Reasoning': 20,
        'General Paper': 20,
        ...questionsPerSubject
      };
    }

    const savedSettings = await settings.save();
    console.log('[Backend] Settings saved successfully');

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: savedSettings
    });
  } catch (error: any) {
    console.error('[Backend] Error updating settings:', error);
    console.error('[Backend] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error updating settings',
      error: error.message
    });
  }
});

// Archive and reset year data (admin only)
router.post('/archive-year', auth, admin, async (req, res) => {
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