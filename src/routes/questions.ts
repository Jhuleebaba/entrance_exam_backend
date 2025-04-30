import express from 'express';
import { authenticateToken, isAdmin } from '../middleware/auth';
import Question from '../models/Question';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import parseDocument from '../utils/documentParser';
import redis from '../utils/redis';

const router = express.Router();

// Set up storage for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to accept only doc, docx, and pdf files
const fileFilter = (req: any, file: any, cb: any) => {
  const allowedFileTypes = ['.doc', '.docx', '.pdf'];
  const extname = path.extname(file.originalname).toLowerCase();
  
  if (allowedFileTypes.includes(extname)) {
    cb(null, true);
  } else {
    cb(new Error('Only .doc, .docx, and .pdf files are allowed'));
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Get all questions (admin only)
router.get('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await Question.countDocuments();

    // Get paginated questions
    const questions = await Question.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      count: questions.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      questions
    });
  } catch (error) {
    console.error('Error in GET /questions:', error);
    res.status(500).json({ success: false, message: 'Error fetching questions' });
  }
});

// Get questions by subject (admin only)
router.get('/by-subject', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Group questions by subject
    const questionsBySubject = await Question.aggregate([
      { $group: { _id: '$subject', questions: { $push: '$$ROOT' } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Get unique subjects
    const subjects = await Question.distinct('subject');
    
    res.json({
      success: true,
      subjects,
      questionsBySubject
    });
  } catch (error) {
    console.error('Error in GET /questions/by-subject:', error);
    res.status(500).json({ success: false, message: 'Error fetching questions by subject' });
  }
});

// Upload document with questions (admin only)
router.post('/upload', authenticateToken, isAdmin, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    if (!req.body.subject) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required'
      });
    }
    
    // Save file information
    const fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      subject: req.body.subject,
      uploadedAt: new Date()
    };
    
    // Start parsing process and respond immediately (will process in background)
    res.status(200).json({
      success: true,
      message: `File uploaded successfully for subject: ${req.body.subject}`,
      file: fileInfo,
      note: 'Document will be processed to extract questions. Please check the Required Format guide for how to structure your document.',
      expectedFormat: `
Required Format for Question Documents:

1. Each question must be formatted as follows:
   Q: [Question text]
   A: [Option A]
   B: [Option B]
   C: [Option C]
   D: [Option D]
   Correct: [A/B/C/D]
   Marks: [number]

2. Separate each question with a blank line or horizontal line.

3. Make sure the "Correct:" line clearly indicates which option is correct.

4. Example:
   Q: What is the capital of France?
   A: London
   B: Berlin
   C: Paris
   D: Rome
   Correct: C
   Marks: 1
      `
    });
    
    // Process the document in the background
    // This won't block the response
    processUploadedDocument(req.file.path, req.body.subject)
      .then(result => {
        console.log(`Processed document with ${result.addedCount} questions added`);
      })
      .catch(error => {
        console.error('Error processing document:', error);
      });
    
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error uploading file'
    });
  }
});

/**
 * Process an uploaded document and save questions to the database
 * 
 * @param filePath Path to the uploaded file
 * @param subject Subject to assign to questions
 * @returns Object with processing results
 */
const processUploadedDocument = async (filePath: string, subject: string) => {
  try {
    // Parse the document to extract questions
    const parsedQuestions = await parseDocument(filePath, subject);
    console.log(`Parsed ${parsedQuestions.length} questions from document`);
    
    // Skip invalid questions (e.g., missing required fields)
    const validQuestions = parsedQuestions.filter(q => 
      q.question && 
      q.options.length === 4 && 
      q.options.every(opt => opt && opt.trim() !== '') &&
      q.correctAnswer && 
      q.options.includes(q.correctAnswer)
    );
    
    // Save valid questions to the database
    if (validQuestions.length > 0) {
      await Question.insertMany(validQuestions);
    }
    
    // Optionally remove the file after processing
    // await fs.promises.unlink(filePath);
    
    return {
      totalParsed: parsedQuestions.length,
      validCount: validQuestions.length,
      addedCount: validQuestions.length,
      subject
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
};

// Get random questions for exam
router.get('/exam', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching random questions for exam...');
    
    // Try to get from cache first
    const cachedQuestions = await redis.get('exam:questions');
    if (cachedQuestions) {
      console.log('Returning cached exam questions');
      return res.json(JSON.parse(cachedQuestions));
    }
    
    // Get all subjects
    const subjects = await Question.distinct('subject');
    
    // Get 30 random questions for each subject using a single aggregation
    const questions = await Question.aggregate([
      {
        $group: {
          _id: '$subject',
          questions: { $push: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 0,
          subject: '$_id',
          questions: {
            $slice: [
              { $shuffle: '$questions' },
              30
            ]
          }
        }
      },
      {
        $unwind: '$questions'
      },
      {
        $replaceRoot: { newRoot: '$questions' }
      }
    ]);

    // Calculate total obtainable marks
    const totalObtainableMarks = questions.reduce((total, q) => total + q.marks, 0);

    // Remove correct answers from response
    const questionsForStudent = questions.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      marks: q.marks,
      subject: q.subject
    }));

    const response = {
      success: true,
      questions: questionsForStudent,
      totalObtainableMarks
    };

    // Cache the response for 1 hour
    await redis.setex('exam:questions', 3600, JSON.stringify(response));

    console.log(`Selected ${questions.length} questions for exam (${subjects.length} subjects × 30 questions)`);
    res.json(response);
  } catch (error) {
    console.error('Error in GET /questions/exam:', error);
    res.status(500).json({ success: false, message: 'Error fetching exam questions' });
  }
});

// Add new question (admin only)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('Adding new question:', req.body);
    const { question, options, correctAnswer, subject, marks } = req.body;

    // Validate required fields
    if (!question || !options || !correctAnswer || !subject || !marks) {
      console.log('Missing required fields:', { question, options, correctAnswer, subject, marks });
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate options array
    if (!Array.isArray(options) || options.length !== 4) {
      console.log('Invalid options array:', options);
      return res.status(400).json({
        success: false,
        message: 'Four options are required'
      });
    }

    // Validate correct answer is among options
    if (!options.includes(correctAnswer)) {
      console.log('Correct answer not in options:', { correctAnswer, options });
      return res.status(400).json({
        success: false,
        message: 'Correct answer must be one of the options'
      });
    }

    const newQuestion = new Question({
      question,
      options,
      correctAnswer,
      subject,
      marks
    });

    await newQuestion.save();
    console.log('Question added successfully:', newQuestion._id);
    res.status(201).json({
      success: true,
      message: 'Question added successfully',
      question: newQuestion
    });
  } catch (error) {
    console.error('Error in POST /questions:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding question'
    });
  }
});

// Update question (admin only)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('Updating question:', req.params.id);
    const { question, options, correctAnswer, subject, marks } = req.body;

    // Validate required fields
    if (!question || !options || !correctAnswer || !subject || !marks) {
      console.log('Missing required fields:', { question, options, correctAnswer, subject, marks });
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate options array
    if (!Array.isArray(options) || options.length !== 4) {
      console.log('Invalid options array:', options);
      return res.status(400).json({
        success: false,
        message: 'Four options are required'
      });
    }

    // Validate correct answer is among options
    if (!options.includes(correctAnswer)) {
      console.log('Correct answer not in options:', { correctAnswer, options });
      return res.status(400).json({
        success: false,
        message: 'Correct answer must be one of the options'
      });
    }

    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      {
        question,
        options,
        correctAnswer,
        subject,
        marks
      },
      { new: true }
    );

    if (!updatedQuestion) {
      console.log('Question not found:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    console.log('Question updated successfully:', req.params.id);
    res.json({
      success: true,
      message: 'Question updated successfully',
      question: updatedQuestion
    });
  } catch (error) {
    console.error('Error in PUT /questions/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating question'
    });
  }
});

// Delete question (admin only)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('Deleting question:', req.params.id);
    const deletedQuestion = await Question.findByIdAndDelete(req.params.id);
    
    if (!deletedQuestion) {
      console.log('Question not found:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    console.log('Question deleted successfully:', req.params.id);
    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /questions/:id:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting question'
    });
  }
});

export default router; 