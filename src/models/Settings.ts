import mongoose from 'mongoose';

export interface ISettings extends mongoose.Document {
  examDurationMinutes: number;
  examInstructions: string;
  examSlipInstructions: string;
  examVenue: string;
  examStartDate: Date;
  examStartTime: string;
  examGroupSize: number;
  examGroupIntervalHours: number;
  examReportNextSteps: string;
  totalExamQuestions: number;
  questionsPerSubject: {
    Mathematics: number;
    English: number;
    'Quantitative Reasoning': number;
    'Verbal Reasoning': number;
    'General Paper': number;
  };
  updatedAt: Date;
}

const settingsSchema = new mongoose.Schema({
  examDurationMinutes: {
    type: Number,
    required: true,
    default: 120 // Default 2 hours
  },
  examInstructions: {
    type: String,
    required: true,
    default: `• The entrance examination consists of 5 subjects with 20 questions each.
• Once you start the exam, you must complete it in one sitting.
• Make sure you have a stable internet connection before starting the exam.
• Your answers are automatically saved as you progress through the exam.`
  },
  examSlipInstructions: {
    type: String,
    required: false,
    default: `1. Please arrive at the exam venue at least 30 minutes before your scheduled time.
2. Bring this registration slip, a valid ID card, and writing materials.
3. Your login credentials: Exam Number and Password (your surname).
4. Mobile phones and electronic devices are not allowed during the exam.
5. Dress appropriately in accordance with the school dress code.
6. In case of any emergency on the day of the exam, contact: 08012345678.
7. For any inquiries, please contact the school administration.`
  },
  examVenue: {
    type: String,
    required: false,
    default: 'Goodly Heritage Comprehensive High School'
  },
  examStartDate: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default to 1 week from now
  },
  examStartTime: {
    type: String,
    required: true,
    default: '09:00' // Default to 9 AM
  },
  examGroupSize: {
    type: Number,
    required: true,
    default: 10 // Default 10 students per group
  },
  examGroupIntervalHours: {
    type: Number,
    required: true,
    default: 2 // Default 2 hours between groups
  },
  examReportNextSteps: {
    type: String,
    required: false,
    default: `1. Admission results will be published within 2 weeks on the school website and notice board.
2. If selected, you will need to complete the enrollment process by the deadline stated in your admission letter.
3. Be prepared to provide original copies of your documents during enrollment verification.
4. For any inquiries, please contact the admission office at admissions@goodlyheritage.edu.ng or call 08012345678.`
  },
  totalExamQuestions: {
    type: Number,
    required: true,
    default: 100 // Default to 100 questions total (20 per subject)
  },
  questionsPerSubject: {
    type: Map,
    of: Number,
    default: {
      'Mathematics': 20,
      'English': 20,
      'Quantitative Reasoning': 20,
      'Verbal Reasoning': 20,
      'General Paper': 20
    }
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
settingsSchema.pre('save', async function(next) {
  const Settings = mongoose.model('Settings');
  const count = await Settings.countDocuments();
  if (count === 0 || this._id) {
    next();
  } else {
    next(new Error('Only one settings document can exist'));
  }
});

export default mongoose.model<ISettings>('Settings', settingsSchema); 