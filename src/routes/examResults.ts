import express from 'express';
import { authenticateToken, authorize } from '../middleware/auth';
import ExamResult from '../models/ExamResult';
import Question from '../models/Question';

const router = express.Router();

// Start a new exam
router.post('/start', authenticateToken, async (req, res) => {
  try {
    // Check if student already has an ongoing exam
    const ongoingExam = await ExamResult.findOne({
      student: req.user.id,
      completed: false
    });

    if (ongoingExam) {
      return res.status(400).json({
        success: false,
        message: 'You already have an ongoing exam'
      });
    }

    // Get all questions by subject
    let examQuestions = [];
    const subjects = ['Mathematics', 'English', 'General'];

    for (const subject of subjects) {
      const sectionQuestions = await Question.aggregate([
        { $match: { subject } },
        { $sample: { size: 10 } }
      ]);
      examQuestions = [...examQuestions, ...sectionQuestions];
    }

    // Create new exam result
    const result = await ExamResult.create({
      student: req.user.id,
      startTime: new Date(),
      answers: examQuestions.map(q => ({
        question: q._id,
        selectedAnswer: '',
        isCorrect: false
      })),
      completed: false
    });

    return res.status(201).json({
      success: true,
      result: {
        _id: result._id,
        questions: examQuestions.map(q => ({
          _id: q._id,
          question: q.question,
          options: q.options
        }))
      }
    });
  } catch (error) {
    console.error('Error starting exam:', error);
    return res.status(500).json({
      success: false,
      message: 'Error starting exam'
    });
  }
});

// Submit an answer
router.post('/:examId/answer', authenticateToken, async (req, res) => {
  try {
    const { questionId, selectedAnswer } = req.body;

    const examResult = await ExamResult.findOne({
      _id: req.params.examId,
      student: req.user.id,
      completed: false
    });

    if (!examResult) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found or already completed'
      });
    }

    // Get question details
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    // Find answer in the array and update it
    const answers = Array.from(examResult.answers.entries());
    const answerIndex = answers.findIndex(
      ([key, value]) => key === questionId
    );

    if (answerIndex === -1) {
      examResult.answers.set(questionId, selectedAnswer);
    } else {
      const key = answers[answerIndex][0];
      examResult.answers.set(key, selectedAnswer);
    }

    await examResult.save();

    return res.json({
      success: true,
      message: 'Answer submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    return res.status(500).json({
      success: false,
      message: 'Error submitting answer'
    });
  }
});

// Submit exam
router.post('/:examId/submit', authenticateToken, async (req, res) => {
  try {
    const examResult = await ExamResult.findOne({
      _id: req.params.examId,
      student: req.user.id,
      completed: false
    });

    if (!examResult) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found or already completed'
      });
    }

    // Calculate score by checking correct answers
    const totalAnswers = Array.from(examResult.answers.entries()).length;
    const correctAnswers = Array.from(examResult.answers.entries())
      .filter(([key, value]) => {
        const question = examResult.examQuestions.get(key);
        return question && value === question.correctAnswer;
      })
      .length;

    examResult.completed = true;
    examResult.endTime = new Date();
    examResult.totalScore = correctAnswers;

    await examResult.save();

    return res.json({
      success: true,
      message: 'Exam submitted successfully',
      result: {
        totalScore: correctAnswers,
        totalQuestions: totalAnswers,
        percentage: (correctAnswers / totalAnswers) * 100
      }
    });
  } catch (error) {
    console.error('Error submitting exam:', error);
    return res.status(500).json({
      success: false,
      message: 'Error submitting exam'
    });
  }
});

// Get all exam results for admin
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Check if the user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource'
      });
    }

    const results = await ExamResult.find().populate('student', 'name email');

    return res.json({
      success: true,
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Error fetching exam results:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching exam results'
    });
  }
});

export default router; 