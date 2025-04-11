import mongoose from 'mongoose';

export interface ISettings extends mongoose.Document {
  examDurationMinutes: number;
  examInstructions: string;
  examStartDate: Date;
  examStartTime: string;
  examGroupSize: number;
  examGroupIntervalHours: number;
  examReportNextSteps: string;
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
    default: `• The entrance examination consists of multiple sections with different types of questions.
• Once you start the exam, you must complete it in one sitting.
• Make sure you have a stable internet connection before starting the exam.
• Your answers are automatically saved as you progress through the exam.`
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