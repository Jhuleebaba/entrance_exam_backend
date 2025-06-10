import mongoose, { CallbackError } from 'mongoose';
import bcrypt from 'bcryptjs';


export interface IUser extends mongoose.Document {
  examNumber: string;
  surname: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: Date;
  sex: 'Male' | 'Female';
  stateOfOrigin: string;
  nationality: string;
  password: string;
  role: 'admin' | 'student';
  examGroup: number;
  examDateTime: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  formatExamTime(): string | null;
}

const userSchema = new mongoose.Schema({
  examNumber: {
    type: String,
    unique: true,
    sparse: true, // This allows null values while maintaining uniqueness
  },
  surname: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  sex: {
    type: String,
    required: true,
    enum: ['Male', 'Female'],
  },
  stateOfOrigin: {
    type: String,
    required: true,
  },
  nationality: {
    type: String,
    default: 'Nigerian',
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['admin', 'student'],
    default: 'student',
  },
  examGroup: {
    type: Number,
    default: 0,
  },
  examDateTime: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Virtual for lastName (same as surname)
userSchema.virtual('lastName').get(function(this: IUser) {
  return this.surname;
});

// Virtual for user's full name
userSchema.virtual('fullName').get(function(this: IUser) {
  return `${this.firstName} ${this.surname}`;
});

// Generate exam number
userSchema.pre('save', async function (next) {
  try {
    if (this.isNew && this.role === 'student') {
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        const currentYear = new Date().getFullYear().toString().slice(-2);
        const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const proposedExamNumber = `GH${currentYear}${randomNum}`;

        // Check if this exam number already exists
        const User = mongoose.model('User');
        const existingUser = await User.findOne({ examNumber: proposedExamNumber });

        if (!existingUser) {
          this.examNumber = proposedExamNumber;
          isUnique = true;
        }

        attempts++;
      }

      if (!isUnique) {
        throw new Error('Failed to generate unique exam number after multiple attempts. Please try again.');
      }
    }
    next();
  } catch (error) {
    next(error as CallbackError);
  }
});

// Assign exam group and date/time
userSchema.pre('save', async function (next) {
  try {
    if (this.isNew && this.role === 'student') {
      // HARDCODED EXAM SETTINGS - No more database dependency
      const EXAM_START_DATE = '2025-07-12'; // Match auth.ts date: July 12, 2025
      const EXAM_START_TIME = '09:00'; // Match auth.ts time: 9:00 AM
      const EXAM_GROUP_SIZE = 10; // Students per group
      const EXAM_GROUP_INTERVAL_HOURS = 2; // Hours between groups

      // Get the count of all students to determine the group
      const User = mongoose.model('User');
      const studentCount = await User.countDocuments({ role: 'student' });

      // Assign to exam group (0-indexed)
      const examGroup = Math.floor(studentCount / EXAM_GROUP_SIZE);
      this.examGroup = examGroup;

      // Calculate the exam date and time for this group
      const examDateTime = new Date(EXAM_START_DATE + 'T' + EXAM_START_TIME + ':00.000Z');
      
      // Add hours for the group interval (each group gets a different time slot)
      examDateTime.setHours(
        examDateTime.getHours() + (examGroup * EXAM_GROUP_INTERVAL_HOURS)
      );
      
      this.examDateTime = examDateTime;

      console.log(`Student ${this.firstName} ${this.surname} assigned to:`);
      console.log(`- Group: ${examGroup}`);
      console.log(`- Exam Date/Time: ${examDateTime.toISOString()}`);
      console.log(`- Local Time: ${examDateTime.toLocaleString()}`);
    }
    next();
  } catch (error) {
    console.error('Error in user pre-save hook:', error);
    next(error);
  }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Format exam time
userSchema.methods.formatExamTime = function() {
  if (this.examDateTime) {
    return this.examDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  return null;
};

export default mongoose.model<IUser>('User', userSchema); 