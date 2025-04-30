import mongoose from 'mongoose';
import Settings from '../models/Settings';
import dotenv from 'dotenv';

dotenv.config();

const updateSettings = async () => {
  try {
    // Connect to MongoDB
    const DB_URI = process.env.MONGODB_URI || 'mongodb://jhulee1:Omoiyaeyo1@cluster0-shard-00-00.da7b5xz.mongodb.net:27017,cluster0-shard-00-01.da7b5xz.mongodb.net:27017,cluster0-shard-00-02.da7b5xz.mongodb.net:27017/?ssl=true&replicaSet=atlas-dtrnwi-shard-0&authSource=admin&retryWrites=true&w=majority';
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(DB_URI);
    console.log('Connected to MongoDB');

    // Find the settings document
    const settings = await Settings.findOne();
    if (!settings) {
      console.log('No settings document found');
      return;
    }

    console.log('Current settings:', settings);

    // Default values for the new fields
    const defaultExamSlipInstructions = `1. Please arrive at the exam venue at least 30 minutes before your scheduled time.
2. Bring this registration slip, a valid ID card, and writing materials.
3. Your login credentials: Exam Number and Password (your surname).
4. Mobile phones and electronic devices are not allowed during the exam.
5. Dress appropriately in accordance with the school dress code.
6. In case of any emergency on the day of the exam, contact: 08012345678.
7. For any inquiries, please contact the school administration.`;

    const defaultExamVenue = 'Goodly Heritage Comprehensive High School';

    // Update the document with the new fields if they don't exist
    if (!settings.get('examSlipInstructions')) {
      settings.set('examSlipInstructions', defaultExamSlipInstructions);
      console.log('Added examSlipInstructions field');
    }

    if (!settings.get('examVenue')) {
      settings.set('examVenue', defaultExamVenue);
      console.log('Added examVenue field');
    }

    // Save the updated document
    await settings.save();
    console.log('Settings document updated successfully');
    console.log('Updated settings:', settings);

  } catch (error) {
    console.error('Error updating settings:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run the update function
updateSettings(); 