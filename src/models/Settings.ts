import mongoose, { Schema, Document } from 'mongoose';

export interface SubjectQuestions {
  Mathematics: number;
  English: number;
  'Quantitative Reasoning': number;
  'Verbal Reasoning': number;
  'General Paper': number;
}

export interface ISettings extends Document {
  questionsPerSubject: SubjectQuestions;
  examDuration: number;
  examStartTime: Date;
  examEndTime: Date;
  registrationStartDate: Date;
  registrationEndDate: Date;
  examYear: number;
  examInstructions: string;
  examSlipInstructions: string;
  examVenue: string;
  examStartDate: Date;
  examGroupSize: number;
  examGroupIntervalHours: number;
  examReportNextSteps: string;
  totalExamQuestions: number;
}

const settingsSchema = new Schema({
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
    default: 180 // 3 hours in minutes
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