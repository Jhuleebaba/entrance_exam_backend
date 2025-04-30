import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  options: {
    type: [String],
    required: [true, 'Four options are required'],
    validate: {
      validator: function(v: string[]) {
        return v.length === 4;
      },
      message: 'Exactly four options are required'
    }
  },
  correctAnswer: {
    type: String,
    required: [true, 'Correct answer is required']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    index: true
  },
  marks: {
    type: Number,
    required: [true, 'Marks are required'],
    min: [1, 'Marks must be at least 1']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add compound index for subject and random selection
questionSchema.index({ subject: 1, _id: 1 });

const Question = mongoose.model('Question', questionSchema);

export default Question; 