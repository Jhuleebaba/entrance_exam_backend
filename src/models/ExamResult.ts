import mongoose from 'mongoose';

interface ExamQuestion {
  marks: number;
  correctAnswer: string;
}

export interface IExamResult extends mongoose.Document {
  user: mongoose.Types.ObjectId;
  answers: Map<string, string>;
  examQuestions: Map<string, ExamQuestion>;
  totalScore: number;
  totalQuestions: number;
  totalObtainableMarks: number;
  startTime: Date;
  endTime?: Date;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const examResultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: {
    type: Map,
    of: String,
    default: () => new Map()
  },
  examQuestions: {
    type: Map,
    of: {
      marks: Number,
      correctAnswer: String
    },
    required: true
  },
  totalScore: {
    type: Number,
    default: 0
  },
  totalQuestions: {
    type: Number,
    default: 0
  },
  totalObtainableMarks: {
    type: Number,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  completed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default mongoose.model<IExamResult>('ExamResult', examResultSchema); 