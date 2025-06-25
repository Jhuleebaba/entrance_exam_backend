import express from 'express';
import { authenticateToken, isAdmin } from '../middleware/auth';
import ExamResult, { IExamResult } from '../models/ExamResult';
import Question from '../models/Question';
import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import { RequestHandler } from '../types/express';
import redisService from '../services/redisService';
import { cacheKeys, invalidateCache } from '../middleware/cache';
import logger from '../utils/logger';

const router = express.Router();

// Helper function to check and handle ongoing exams
async function checkAndHandleOngoingExam(userId: string): Promise<{ hasOngoing: boolean; message?: string }> {
  const ongoingExam = await ExamResult.findOne({
    user: userId,
    completed: false
  });

  if (ongoingExam) {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    if (ongoingExam.startTime < threeHoursAgo) {
      await ExamResult.findByIdAndDelete(ongoingExam._id);
      logger.info('Auto-deleted expired incomplete exam', {
        userId,
        examId: ongoingExam._id,
        startTime: ongoingExam.startTime
      });
      return { hasOngoing: false };
    }
    return { hasOngoing: true, message: 'You already have an ongoing exam' };
  }

  return { hasOngoing: false };
}

// Get all exam results (admin only)
router.get('/all', authenticateToken, isAdmin, (async (req, res) => {
  try {
    const results = await ExamResult.find()
      .populate('user', 'surname firstName fullName examNumber email phoneNumber sex stateOfOrigin nationality')
      .sort({ createdAt: -1 });

    // Ensure fullName is always available
    const processedResults = results.map(result => {
      const resultObj = result.toObject();
      // Type assertion since we know user is populated
      const user = resultObj.user as any;
      if (user && typeof user === 'object') {
        user.fullName = user.fullName || 
          `${user.firstName || ''} ${user.surname || ''}`.trim() || 
          'Name not available';
      }
      return resultObj;
    });

    res.json({
      success: true,
      count: processedResults.length,
      results: processedResults
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
      .populate('user', 'surname firstName fullName examNumber email phoneNumber sex stateOfOrigin nationality')
      .sort({ createdAt: -1 });

    // Ensure fullName is always available
    const processedResults = results.map(result => {
      const resultObj = result.toObject();
      // Type assertion since we know user is populated
      const user = resultObj.user as any;
      if (user && typeof user === 'object') {
        user.fullName = user.fullName || 
          `${user.firstName || ''} ${user.surname || ''}`.trim() || 
          'Name not available';
      }
      return resultObj;
    });

    res.json({
      success: true,
      count: processedResults.length,
      results: processedResults
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
      .populate('user', 'surname firstName fullName examNumber email phoneNumber sex stateOfOrigin nationality');

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

    // Ensure answers and examQuestions are Maps (fix for MongoDB serialization)
    if (result && result.answers && !(result.answers instanceof Map)) {
      result.answers = new Map(Object.entries(result.answers));
    }
    if (result && result.examQuestions && !(result.examQuestions instanceof Map)) {
      result.examQuestions = new Map(Object.entries(result.examQuestions));
    }

    // Build detailed answers array and calculate subject scores
    const answersArray = [];
    const subjectScores: { [subject: string]: { correct: number, total: number, percentage: number } } = {};
    
    // Initialize subject scores
    const subjects = ['Mathematics', 'English', 'Verbal Reasoning', 'Quantitative Reasoning', 'General Paper'];
    subjects.forEach(subject => {
      subjectScores[subject] = { correct: 0, total: 0, percentage: 0 };
    });
    
    if (result.answers && result.examQuestions) {
      console.log('Raw result.answers:', result.answers);
      console.log('Raw result.examQuestions:', result.examQuestions);
      for (const [questionId, selectedAnswer] of result.answers.entries()) {
        // Fetch question details
        const questionDoc = await Question.findById(questionId);
        if (questionDoc) {
          const examQ = result.examQuestions.get(questionId);
          const isCorrect = examQ && selectedAnswer === examQ.correctAnswer;
          const marks = examQ?.marks || 1;
          const subject = questionDoc.subject;
          
          // Update subject scores - count questions, not marks
          if (!subjectScores[subject]) {
            subjectScores[subject] = { correct: 0, total: 0, percentage: 0 };
          }
          
          // Count total questions attempted for this subject
          subjectScores[subject].total += 1;
          if (isCorrect) {
            // Count correct questions for this subject
            subjectScores[subject].correct += 1;
          }
          
          answersArray.push({
            question: {
              question: questionDoc.question,
              options: questionDoc.options,
              correctAnswer: questionDoc.correctAnswer,
              subject: questionDoc.subject,
              marks: questionDoc.marks
            },
            selectedAnswer,
            isCorrect
          });
        }
      }
    }
    
    // Calculate percentages and cap at 20 questions per subject
    Object.keys(subjectScores).forEach(subject => {
      const subjectData = subjectScores[subject];
      // Ensure no subject has more than 20 total questions (maximum per subject)
      if (subjectData.total > 20) {
        console.warn(`Warning: Subject ${subject} has ${subjectData.total} total questions, capping at 20`);
        subjectData.total = 20;
      }
      if (subjectData.correct > 20) {
        console.warn(`Warning: Subject ${subject} has ${subjectData.correct} correct questions, capping at 20`);
        subjectData.correct = 20;
      }
      subjectData.percentage = subjectData.total > 0 ? (subjectData.correct / subjectData.total) * 100 : 0;
    });
    
    console.log('Built answersArray:', answersArray);
    console.log('Calculated subject scores:', subjectScores);

    res.json({
      success: true,
      result: {
        ...result.toObject(),
        answers: answersArray,
        subjectScores
      }
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
    const ongoingCheck = await checkAndHandleOngoingExam(req.user?.id || '');
    if (ongoingCheck.hasOngoing) {
      return res.status(400).json({
        success: false,
        message: ongoingCheck.message
      });
    }
    // Get exam questions efficiently using the optimized questions endpoint logic
    const subjectConfig = [
      { name: 'Mathematics', count: 20 },
      { name: 'English', count: 20 },
      { name: 'Verbal Reasoning', count: 20 },
      { name: 'Quantitative Reasoning', count: 20 },
      { name: 'General Paper', count: 20 }
    ];

    // Try to get questions from cache first
    let questionsResponse: any[] = [];
    const examQuestionsKey = 'exam:questions:pool';
    
    if (redisService.isReady()) {
      try {
        const cachedQuestions = await redisService.getJSON<any[]>(examQuestionsKey);
        if (cachedQuestions && cachedQuestions.length >= 100) {
          // Use cached questions but still randomize selection
          const shuffled = [...cachedQuestions].sort(() => 0.5 - Math.random());
          questionsResponse = shuffled.slice(0, 100);
          logger.info('Using cached exam questions', { count: questionsResponse.length });
        }
      } catch (error) {
        logger.warn('Failed to get cached questions', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // If no cached questions or insufficient count, fetch from database
    if (questionsResponse.length === 0) {
      logger.info('Fetching fresh questions from database');
      
      // Use parallel queries for better performance
      const questionPromises = subjectConfig.map(async ({ name, count }) => {
        return Question.aggregate([
          { $match: { subject: name } },
          { $sample: { size: count } }
        ]);
      });

      // Execute all queries in parallel
      const subjectResults = await Promise.all(questionPromises);
      questionsResponse = subjectResults.flat();
      
      // Cache the questions for 30 minutes (questions don't change often)
      if (redisService.isReady() && questionsResponse.length > 0) {
        redisService.cacheJSON(examQuestionsKey, questionsResponse, 1800) // 30 minutes
          .catch(error => logger.warn('Failed to cache questions', { error: error.message }));
      }
    }

    if (questionsResponse.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions available for exam'
      });
    }

    // Calculate total obtainable marks for these specific questions
    const totalObtainableMarks = questionsResponse.reduce((total, q) => total + (q.marks || 1), 0);

    // Create a Map for exam questions (store answers for grading)
    const examQuestions = new Map();
    questionsResponse.forEach(q => {
      examQuestions.set(q._id.toString(), {
        marks: q.marks || 1,
        correctAnswer: q.correctAnswer
      });
    });

    console.log(`Storing ${questionsResponse.length} exam questions for grading`);

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
      marks: q.marks || 1,
      subject: q.subject
    }));

    res.status(201).json({
      success: true,
      message: 'Exam started successfully',
      result: {
        _id: result._id,
        startTime: result.startTime,
        questions: questionsForStudent,
        totalQuestions: questionsResponse.length,
        totalObtainableMarks
      }
    });
  } catch (error: any) {
    console.error('Error starting exam:', error);
    
    // If exam creation failed but we created a record, clean it up
    try {
      if (req.user?.id) {
        await ExamResult.deleteMany({
          user: req.user.id,
          completed: false,
          startTime: { $gte: new Date(Date.now() - 60000) } // Last minute
        });
        logger.info('Cleaned up failed exam attempt', { userId: req.user.id });
      }
    } catch (cleanupError) {
      logger.warn('Failed to cleanup incomplete exam', { 
        error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error' 
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error starting exam',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Prepare exam questions (no exam record created until student starts)
router.post('/prepare', authenticateToken, async (req, res) => {
  try {
    // Check if student has an ongoing exam
    const ongoingExam = await ExamResult.findOne({
      user: req.user?.id,
      completed: false
    });

    if (ongoingExam) {
      // Check if the ongoing exam is older than 3 hours (auto-expire)
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      if (ongoingExam.startTime < threeHoursAgo) {
        // Auto-delete expired incomplete exam
        await ExamResult.findByIdAndDelete(ongoingExam._id);
        logger.info('Auto-deleted expired incomplete exam', {
          userId: req.user?.id,
          examId: ongoingExam._id,
          startTime: ongoingExam.startTime
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'You already have an ongoing exam'
        });
      }
    }

    // Get exam questions efficiently using the optimized questions endpoint logic
    const subjectConfig = [
      { name: 'Mathematics', count: 20 },
      { name: 'English', count: 20 },
      { name: 'Verbal Reasoning', count: 20 },
      { name: 'Quantitative Reasoning', count: 20 },
      { name: 'General Paper', count: 20 }
    ];

    // Try to get questions from cache first
    let questionsResponse: any[] = [];
    const examQuestionsKey = 'exam:questions:pool';
    
    if (redisService.isReady()) {
      try {
        const cachedQuestions = await redisService.getJSON<any[]>(examQuestionsKey);
        if (cachedQuestions && cachedQuestions.length >= 100) {
          // Use cached questions but still randomize selection
          const shuffled = [...cachedQuestions].sort(() => 0.5 - Math.random());
          questionsResponse = shuffled.slice(0, 100);
          logger.info('Using cached exam questions', { count: questionsResponse.length });
        }
      } catch (error) {
        logger.warn('Failed to get cached questions', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    // If no cached questions or insufficient count, fetch from database
    if (questionsResponse.length === 0) {
      logger.info('Fetching fresh questions from database');
      
      // Use parallel queries for better performance
      const questionPromises = subjectConfig.map(async ({ name, count }) => {
        return Question.aggregate([
          { $match: { subject: name } },
          { $sample: { size: count } }
        ]);
      });

      // Execute all queries in parallel
      const subjectResults = await Promise.all(questionPromises);
      questionsResponse = subjectResults.flat();
      
      // Cache the questions for 30 minutes (questions don't change often)
      if (redisService.isReady() && questionsResponse.length > 0) {
        redisService.cacheJSON(examQuestionsKey, questionsResponse, 1800) // 30 minutes
          .catch(error => logger.warn('Failed to cache questions', { error: error.message }));
      }
    }

    if (questionsResponse.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No questions available for exam'
      });
    }

    // Calculate total obtainable marks for these specific questions
    const totalObtainableMarks = questionsResponse.reduce((total, q) => total + (q.marks || 1), 0);

    // Prepare questions for student (without correct answers)
    const questionsForStudent = questionsResponse.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      marks: q.marks || 1,
      subject: q.subject
    }));

    // Store question data temporarily in cache for when student actually starts exam
    const tempExamKey = `temp_exam:${req.user?.id}`;

    // Create exam questions map for later use
    const examQuestions = new Map();
    questionsResponse.forEach(q => {
      examQuestions.set(q._id.toString(), {
        marks: q.marks || 1,
        correctAnswer: q.correctAnswer
      });
    });

    // Store minimal data needed for exam creation
    const examData = {
      questionIds: questionsResponse.map(q => q._id.toString()),
      examQuestions: Object.fromEntries(examQuestions), // Convert Map to object for JSON storage
      totalObtainableMarks,
      totalQuestions: questionsResponse.length,
      timestamp: Date.now()
    };

    if (redisService.isReady()) {
      try {
        await redisService.cacheJSON(tempExamKey, examData, 3600); // 1 hour TTL
      } catch (error) {
        logger.error('Failed to cache exam data', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: req.user?.id
        });
        return res.status(500).json({
          success: false,
          message: 'Failed to prepare exam. Please try again.'
        });
      }
    } else {
      return res.status(503).json({
        success: false,
        message: 'Exam preparation service is temporarily unavailable'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Questions prepared successfully',
      questions: questionsForStudent,
      totalQuestions: questionsResponse.length,
      totalObtainableMarks
    });
  } catch (error: any) {
    console.error('Error preparing exam:', error);
    res.status(500).json({
      success: false,
      message: 'Error preparing exam',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Actually start the exam (create exam record)
router.post('/begin', authenticateToken, async (req, res) => {
  try {
    // Check if student has an ongoing exam (with auto-expiry)
    const ongoingCheck = await checkAndHandleOngoingExam(req.user?.id || '');
    if (ongoingCheck.hasOngoing) {
      return res.status(400).json({
        success: false,
        message: ongoingCheck.message
      });
    }
    // Get exam data from temporary cache
    const tempExamKey = `temp_exam:${req.user?.id}`;
    let examData: any = null;

    if (redisService.isReady()) {
      try {
        examData = await redisService.getJSON(tempExamKey);
      } catch (error) {
        logger.warn('Failed to get temp exam data', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    if (!examData || !examData.questionIds || examData.questionIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No exam questions prepared. Please refresh and try again.'
      });
    }

    // Check if exam data is too old (more than 1 hour)
    const oneHourAgo = Date.now() - 3600000;
    if (examData.timestamp < oneHourAgo) {
      return res.status(400).json({
        success: false,
        message: 'Exam preparation expired. Please refresh and try again.'
      });
    }

    // Create a Map for exam questions (store answers for grading)
    const examQuestions = new Map();
    Object.entries(examData.examQuestions).forEach(([questionId, questionInfo]) => {
      examQuestions.set(questionId, questionInfo);
    });

    // Create the exam result record
    const result = new ExamResult({
      user: req.user?.id,
      startTime: new Date(),
      completed: false,
      answers: new Map(),
      totalScore: 0,
      totalQuestions: examData.totalQuestions,
      totalObtainableMarks: examData.totalObtainableMarks,
      examQuestions
    });

    await result.save();

    // Clean up temporary exam data
    if (redisService.isReady()) {
      redisService.del(tempExamKey).catch(error => 
        logger.warn('Failed to clean temp exam data', { error: error.message })
      );
    }

    logger.info('Exam started successfully', {
      userId: req.user?.id,
      examId: result._id,
      questionCount: examData.totalQuestions
    });

    res.status(201).json({
      success: true,
      message: 'Exam started successfully',
      examId: result._id,
      startTime: result.startTime
    });
  } catch (error: any) {
    console.error('Error beginning exam:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting exam',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    // Calculate score using stored exam questions and build subject-wise breakdown
    let totalScore = 0;
    const answersMap = new Map<string, string>();
    const subjectScores: { [subject: string]: { correct: number, total: number, percentage: number } } = {};
    
    // First, get all question details to properly calculate subject scores
    const questionIds = Array.from(examResult.examQuestions.keys());
    const questionDocs = await Question.find({ _id: { $in: questionIds } });
    const questionMap = new Map(questionDocs.map(q => [q._id.toString(), q]));
    
    // Initialize subject scores with hardcoded subjects
    const subjects = ['Mathematics', 'English', 'Verbal Reasoning', 'Quantitative Reasoning', 'General Paper'];
    subjects.forEach(subject => {
      subjectScores[subject] = { correct: 0, total: 0, percentage: 0 };
    });
    
    // Calculate scores
    Object.entries(answers).forEach(([questionId, answer]) => {
      answersMap.set(questionId, answer);
      const questionData = examResult.examQuestions.get(questionId);
      const questionDoc = questionMap.get(questionId);
      
      if (questionData && questionDoc) {
        const subject = questionDoc.subject;
        const marks = questionData.marks || 1;
        
        // Initialize subject if not already done
        if (!subjectScores[subject]) {
          subjectScores[subject] = { correct: 0, total: 0, percentage: 0 };
        }
        
        // Count total questions attempted for this subject
        subjectScores[subject].total += 1;
        
        if (answer === questionData.correctAnswer) {
          // Count correct questions for this subject
          subjectScores[subject].correct += 1;
          totalScore += marks;
        }
      }
    });
    
    // Calculate percentages for each subject and ensure no subject exceeds 20 questions
    Object.keys(subjectScores).forEach(subject => {
      const subjectData = subjectScores[subject];
      // Ensure no subject has more than 20 total questions (20 questions per subject)
      if (subjectData.total > 20) {
        console.warn(`Warning: Subject ${subject} has ${subjectData.total} total questions, capping at 20`);
        subjectData.total = 20;
      }
      if (subjectData.correct > 20) {
        console.warn(`Warning: Subject ${subject} has ${subjectData.correct} correct questions, capping at 20`);
        subjectData.correct = 20;
      }
      
      subjectData.percentage = subjectData.total > 0 ? (subjectData.correct / subjectData.total) * 100 : 0;
    });

    // Update exam result
    examResult.answers = answersMap;
    examResult.totalScore = totalScore;
    examResult.totalQuestions = examResult.examQuestions.size;
    examResult.completed = true;
    examResult.endTime = new Date();
    
    // Store subject scores in a new field (we might need to add this to the model)
    (examResult as any).subjectScores = subjectScores;

    await examResult.save();

    // Calculate percentage based on total obtainable marks
    const percentage = (totalScore / examResult.totalObtainableMarks) * 100;
    
    console.log('Calculated subject scores:', subjectScores);
    console.log('Total score:', totalScore, 'out of', examResult.totalObtainableMarks);

    res.json({
      success: true,
      message: 'Exam submitted successfully',
      result: {
        ...examResult.toObject(),
        subjectScores,
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

// Admin clear all incomplete exams endpoint
router.post('/admin-clear-incomplete', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Check if the requesting user is an admin
    const requestingUser = req.user;
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized: Admin access required' });
    }

    // Find and delete all incomplete exam results
    const result = await ExamResult.deleteMany({
      'completed': false
    });

    logger.info('Admin cleared incomplete exams', {
      admin: requestingUser.id,
      deletedCount: result.deletedCount
    });

    return res.json({ 
      success: true, 
      message: `Successfully cleared ${result.deletedCount} incomplete exam(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error clearing incomplete exams:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error clearing incomplete exams' 
    });
  }
});

export default router; 