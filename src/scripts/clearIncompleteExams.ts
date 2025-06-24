import mongoose from 'mongoose';
import ExamResult from '../models/ExamResult';

async function clearIncompleteExams() {
  try {
    // Use the same connection string as the main app
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/entrance-exam';
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');
    console.log('Database name:', mongoose.connection.name);

    // Find all incomplete exams
    const incompleteExams = await ExamResult.find({ completed: false });
    console.log(`Found ${incompleteExams.length} incomplete exam(s)`);

    if (incompleteExams.length > 0) {
      // Delete all incomplete exams
      const result = await ExamResult.deleteMany({ completed: false });
      console.log(`Successfully deleted ${result.deletedCount} incomplete exam record(s)`);
    } else {
      console.log('No incomplete exams found to delete');
    }

    // Show remaining exam count
    const totalExams = await ExamResult.countDocuments();
    console.log(`Total exam results remaining: ${totalExams}`);

  } catch (error: any) {
    console.error('Error clearing incomplete exams:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
clearIncompleteExams(); 