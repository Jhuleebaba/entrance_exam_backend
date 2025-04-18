import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const createAdmin = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/entrance-exam');
    console.log('Connected to MongoDB');

    // Create admin user schema
    const userSchema = new mongoose.Schema({
      examNumber: String,
      password: String,
      surname: String,
      firstName: String,
      fullName: String,
      email: String,
      role: String
    });

    // Create the model
    const User = mongoose.model('User', userSchema);

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin1234', salt);

    // Create admin user
    const admin = new User({
      surname: 'User',
      firstName: 'Admin',
      fullName: 'Admin User',
      email: 'admin@goodlyheritage.edu',
      password: hashedPassword,
      role: 'admin'
    });

    await admin.save();
    console.log('Admin user created successfully');
    console.log('Email: admin@goodlyheritage.edu');
    console.log('Password: admin1234');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

createAdmin(); 
