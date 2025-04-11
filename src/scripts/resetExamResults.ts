import mongoose from 'mongoose';

async function resetExamResults() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/entrance-exam');
    console.log('Connected to MongoDB');

    // Drop the exam results collection
    await mongoose.connection.collection('examresults').drop();
    console.log('Successfully dropped exam results collection');

  } catch (error: any) {
    if (error.code === 26) {
      console.log('Collection does not exist. No need to drop.');
    } else {
      console.error('Error:', error);
    }
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
resetExamResults(); 