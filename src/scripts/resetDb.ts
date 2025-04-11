import mongoose from 'mongoose';

const resetDb = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/entrance-exam');
    console.log('Connected to MongoDB');

    // Drop the users collection
    await mongoose.connection.db.collection('users').drop();
    console.log('Dropped users collection');

    // Drop all indexes
    await mongoose.connection.db.collection('users').dropIndexes();
    console.log('Dropped all indexes on users collection');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

resetDb(); 