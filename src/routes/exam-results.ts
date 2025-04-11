import express from 'express';
import { authenticateToken, isAdmin } from '../middleware/auth';
import ExamResult, { IExamResult } from '../models/ExamResult';
import Question from '../models/Question';
import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import { RequestHandler } from '../types/express';

const router = express.Router();

// Get all exam results (admin only)
router.get('/all', authenticateToken, isAdmin, (async (req, res) => {
  try {
    const results = await ExamResult.find()
      .populate('user', 'username fullName examNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error fetching exam results:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching exam results',
      error: error.message
    });
  }
}) as RequestHandler);

// Get student's own exam results
router.get('/', authenticateToken, async (req, res) => {
  try {
    const results = await ExamResult.find({ user: req.user?.id })
      .populate('user', 'username fullName examNumber')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error: any) {
    console.error('Error fetching exam results:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching exam results',
      error: error.message
    });
  }
});

// Get exam result by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await ExamResult.findById(req.params.id)
      .populate('user', 'username fullName examNumber');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Exam result not found'
      });
    }

    // Check if user is admin or the result belongs to the user
    if (req.user?.role !== 'admin' && result.user.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this result'
      });
    }

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('Error fetching exam result:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching exam result',
      error: error.message
    });
  }
});

// Start a new exam
router.post('/start', authenticateToken, async (req, res) => {
  try {
    // Check if student has an ongoing exam
    const ongoingExam = await ExamResult.findOne({
      user: req.user?.id,
      completed: false
    });

    if (ongoingExam) {
      return res.status(400).json({
        success: false,
        message: 'You already have an ongoing exam'
      });
    }

    // Get random questions and total obtainable marks for the exam
    const questionsResponse = await Question.aggregate([
      { $sample: { size: 50 } }
    ]);

    // Calculate total obtainable marks for these specific questions
    const totalObtainableMarks = questionsResponse.reduce((total, q) => total + q.marks, 0);

    // Create a Map for exam questions
    const examQuestions = new Map();
    questionsResponse.forEach(q => {
      examQuestions.set(q._id.toString(), {
        marks: q.marks,
        correctAnswer: q.correctAnswer
      });
    });

    console.log('Storing exam questions:', Object.fromEntries(examQuestions)); // Debug log

    // Create a new exam result
    const result = new ExamResult({
      user: req.user?.id,
      startTime: new Date(),
      completed: false,
      answers: new Map(),
      totalScore: 0,
      totalQuestions: questionsResponse.length,
      totalObtainableMarks,
      examQuestions // Store the Map directly
    });

    await result.save();

    // Prepare questions for student (without correct answers)
    const questionsForStudent = questionsResponse.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      marks: q.marks,
      subject: q.subject
    }));

    res.status(201).json({
      success: true,
      message: 'Exam started successfully',
      result: {
        _id: result._id,
        startTime: result.startTime,
        questions: questionsForStudent
      }
    });
  } catch (error: any) {
    console.error('Error starting exam:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting exam',
      error: error.message
    });
  }
});

// Submit exam result
router.post('/:id/submit', authenticateToken, (async (req, res) => {
  try {
    const { answers } = req.body as { answers: Record<string, string> };
    const examResult = await ExamResult.findById(req.params.id);

    if (!examResult) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    if (!req.user || examResult.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this exam'
      });
    }

    if (examResult.completed) {
      return res.status(400).json({
        success: false,
        message: 'This exam has already been submitted'
      });
    }

    // Calculate score using stored exam questions
    let totalScore = 0;
    const answersMap = new Map<string, string>();
    
    Object.entries(answers).forEach(([questionId, answer]) => {
      answersMap.set(questionId, answer);
      const questionData = examResult.examQuestions.get(questionId);
      if (questionData && answer === questionData.correctAnswer) {
        totalScore += questionData.marks;
      }
    });

    // Update exam result
    examResult.answers = answersMap;
    examResult.totalScore = totalScore;
    examResult.totalQuestions = examResult.examQuestions.size;
    examResult.completed = true;
    examResult.endTime = new Date();

    await examResult.save();

    // Calculate percentage based on total obtainable marks
    const percentage = (totalScore / examResult.totalObtainableMarks) * 100;

    res.json({
      success: true,
      message: 'Exam submitted successfully',
      result: {
        ...examResult.toObject(),
        percentage: percentage.toFixed(1)
      }
    });
  } catch (error: any) {
    console.error('Error submitting exam:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting exam',
      error: error.message
    });
  }
}) as RequestHandler);

// Cancel exam
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const examResult = await ExamResult.findById(req.params.id);

    if (!examResult) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found'
      });
    }

    if (examResult.user.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this exam'
      });
    }

    // Delete the exam result
    await ExamResult.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Exam cancelled successfully'
    });
  } catch (error: any) {
    console.error('Error cancelling exam:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling exam',
      error: error.message
    });
  }
});

// Reset student's exam status
router.post('/reset', authenticateToken, async (req, res) => {
  try {
    // Find and delete any incomplete exams for the user
    await ExamResult.deleteMany({
      user: req.user?.id,
      completed: false
    });

    res.json({
      success: true,
      message: 'Exam status reset successfully'
    });
  } catch (error: any) {
    console.error('Error resetting exam status:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting exam status',
      error: error.message
    });
  }
});

// Admin reset endpoint
router.post('/admin-reset/:userId', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Check if the requesting user is an admin
    const requestingUser = req.user;
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    const { userId } = req.params;

    // Find and delete any incomplete exam results for the user
    const result = await ExamResult.deleteMany({
      'user': userId,
      'completed': false
    });

    if (result.deletedCount > 0) {
      return res.json({ 
        success: true, 
        message: 'Exam status reset successfully' 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        message: 'No incomplete exam found for this user' 
      });
    }
  } catch (error) {
    console.error('Error resetting exam status:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error resetting exam status' 
    });
  }
});

export default router; 