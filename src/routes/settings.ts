import express from 'express';
import { authenticateToken as auth, isAdmin as admin } from '../middleware/auth';
import Settings from '../models/Settings';

const router = express.Router();

// Get settings
router.get('/', auth, async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Settings not found'
      });
    }

    res.json({
      success: true,
      settings
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching settings',
      error: error.message
    });
  }
});

// Update settings (admin only)
router.put('/', auth, admin, async (req, res) => {
  try {
    const {
      examDuration,
      examStartTime,
      examEndTime,
      registrationStartDate,
      registrationEndDate,
      examYear,
      questionsPerSubject
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    // Update fields if provided
    if (examDuration) settings.examDuration = examDuration;
    if (examStartTime) settings.examStartTime = new Date(examStartTime);
    if (examEndTime) settings.examEndTime = new Date(examEndTime);
    if (registrationStartDate) settings.registrationStartDate = new Date(registrationStartDate);
    if (registrationEndDate) settings.registrationEndDate = new Date(registrationEndDate);
    if (examYear) settings.examYear = examYear;

    // Update questions per subject
    if (questionsPerSubject) {
      settings.questionsPerSubject = {
        Mathematics: 0,
        English: 0,
        'Quantitative Reasoning': 0,
        'Verbal Reasoning': 0,
        'General Paper': 0,
        ...questionsPerSubject
      };
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error updating settings',
      error: error.message
    });
  }
});

export default router; 