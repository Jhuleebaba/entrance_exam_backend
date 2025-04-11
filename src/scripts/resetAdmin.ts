import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const resetAdmin = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/entrance-exam');
    console.log('Connected to MongoDB');

    // Get the existing users collection
    const db = mongoose.connection.db;
    
    // Drop existing user collection
    await db.collection('users').deleteMany({ email: 'admin@example.com' });
    console.log('Removed existing admin user');

    // Create new admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const admin = {
      surname: 'User',
      firstName: 'Admin',
      fullName: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      username: 'admin@example.com',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('users').insertOne(admin);
    console.log('Admin user reset successfully');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

resetAdmin(); 