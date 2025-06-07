const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/entrance-exam', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Settings schema
const settingsSchema = new mongoose.Schema({
  questionsPerSubject: {
    type: {
      Mathematics: { type: Number, default: 0 },
      English: { type: Number, default: 0 },
      'Quantitative Reasoning': { type: Number, default: 0 },
      'Verbal Reasoning': { type: Number, default: 0 },
      'General Paper': { type: Number, default: 0 }
    },
    required: true,
    _id: false
  },
  examDuration: {
    type: Number,
    required: true,
    default: 120 // 2 hours in minutes
  },
  examStartTime: {
    type: Date,
    required: true
  },
  examEndTime: {
    type: Date,
    required: true
  },
  registrationStartDate: {
    type: Date,
    required: true
  },
  registrationEndDate: {
    type: Date,
    required: true
  },
  examYear: {
    type: Number,
    required: true
  },
  examInstructions: {
    type: String,
    required: true
  },
  examSlipInstructions: {
    type: String,
    required: false
  },
  examVenue: {
    type: String,
    required: false
  },
  examStartDate: {
    type: Date,
    required: true
  },
  examGroupSize: {
    type: Number,
    required: true,
    default: 10
  },
  examGroupIntervalHours: {
    type: Number,
    required: true,
    default: 2
  },
  examReportNextSteps: {
    type: String,
    required: false
  },
  totalExamQuestions: {
    type: Number,
    required: true,
    default: 100
  }
}, {
  timestamps: true
});

const Settings = mongoose.model('Settings', settingsSchema);

const updateExamDuration = async () => {
  try {
    await connectDB();
    
    // Find and update the settings document
    const result = await Settings.updateMany(
      {}, // Update all settings documents
      { 
        $set: { 
          examDuration: 120,
          totalExamQuestions: 100,
          'questionsPerSubject.Mathematics': 20,
          'questionsPerSubject.English': 20,
          'questionsPerSubject.Quantitative Reasoning': 20,
          'questionsPerSubject.Verbal Reasoning': 20,
          'questionsPerSubject.General Paper': 20
        } 
      }
    );
    
    console.log('Update result:', result);
    
    // Verify the update
    const settings = await Settings.findOne();
    console.log('Updated settings:', {
      examDuration: settings?.examDuration,
      totalExamQuestions: settings?.totalExamQuestions,
      questionsPerSubject: settings?.questionsPerSubject
    });
    
    console.log('Exam duration updated successfully to 120 minutes (2 hours)');
    
  } catch (error) {
    console.error('Error updating exam duration:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

updateExamDuration(); 