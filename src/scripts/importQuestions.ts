import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Question from '../models/Question';
import { sampleQuestions } from '../data/sampleQuestions';

dotenv.config();

const importQuestions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/exam-system');
    console.log('Connected to MongoDB');

    // Clear existing questions
    await Question.deleteMany({});
    console.log('Cleared existing questions');

    // Insert sample questions
    await Question.insertMany(sampleQuestions);
    console.log('Successfully imported sample questions');

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error importing questions:', error);
    process.exit(1);
  }
};

importQuestions(); 