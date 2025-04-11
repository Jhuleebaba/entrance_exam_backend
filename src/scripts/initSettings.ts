import mongoose from 'mongoose';
import Settings from '../models/Settings';

async function initSettings() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/entrance-exam');
    console.log('Connected to MongoDB');

    // Check if settings already exist
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create default settings
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      
      settings = new Settings({
        examDurationMinutes: 120, // Default 2 hours
        examInstructions: `• The entrance examination consists of multiple sections with different types of questions.
• Once you start the exam, you must complete it in one sitting.
• Make sure you have a stable internet connection before starting the exam.
• Your answers are automatically saved as you progress through the exam.`,
        examStartDate: oneWeekFromNow,
        examStartTime: '09:00',
        examGroupSize: 10,
        examGroupIntervalHours: 2
      });
      await settings.save();
      console.log('Settings initialized successfully:', settings);
    } else {
      console.log('Settings already exist:', settings);
    }
  } catch (error) {
    console.error('Error initializing settings:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
initSettings(); 