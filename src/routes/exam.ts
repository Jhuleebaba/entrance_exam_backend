import express from 'express';
import { authenticateToken as auth, isAdmin as admin } from '../middleware/auth';
import ExamResult from '../models/ExamResult';

const router = express.Router();

// Get exam results (admin only)
router.get('/results', auth, admin, async (req, res) => {
  try {
    const results = await ExamResult.find().populate('user', '-password');
    res.json({
      success: true,
      results
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching exam results',
      error: error.message
    });
  }
});

export default router; 