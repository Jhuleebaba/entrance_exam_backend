import mongoose from 'mongoose';

interface IQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  subject: string;
  marks: number;
}

const questionSchema = new mongoose.Schema<IQuestion>({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  options: {
    type: [String],
    required: [true, 'Options are required'],
    validate: {
      validator: function(this: IQuestion, v: string[]) {
        return v.length === 4;
      },
      message: 'Question must have exactly 4 options'
    }
  },
  correctAnswer: {
    type: String,
    required: [true, 'Correct answer is required'],
    validate: {
      validator: function(this: IQuestion, v: string) {
        return this.options.includes(v);
      },
      message: 'Correct answer must be one of the options'
    }
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  marks: {
    type: Number,
    required: [true, 'Marks are required'],
    min: [1, 'Marks must be at least 1']
  }
}, {
  timestamps: true
});

export default mongoose.model<IQuestion>('Question', questionSchema); 