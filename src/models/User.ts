import mongoose, { CallbackError } from 'mongoose';
import bcrypt from 'bcryptjs';
import Settings from './Settings';

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
  updateExamDateTime(settings: any): Promise<void>;
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
      // Get settings
      const settings = await Settings.findOne();

      if (settings) {
        // Get the count of all students to determine the group
        const User = mongoose.model('User');
        const studentCount = await User.countDocuments({ role: 'student' });

        // Assign to exam group (0-indexed)
        const examGroup = Math.floor(studentCount / settings.examGroupSize);
        this.examGroup = examGroup;

        // Calculate the exam date and time for this group
        if (settings.examStartTime) {
          const examDateTime = new Date(settings.examStartTime);
          examDateTime.setHours(
            examDateTime.getHours() + (examGroup * settings.examGroupIntervalHours)
          );
          this.examDateTime = examDateTime;
        }
      }
    }
    next();
  } catch (error) {
    next(error as CallbackError);
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

// Update the examDateTime based on settings
userSchema.methods.updateExamDateTime = async function(settings: any) {
  if (this.examGroup && settings.examStartTime) {
    const examDate = new Date(settings.examStartTime);
    const groupIndex = parseInt(this.examGroup.replace(/[^0-9]/g, '')) - 1;
    const hoursToAdd = groupIndex * (settings.examGroupIntervalHours || 2);
    
    examDate.setHours(examDate.getHours() + hoursToAdd);
    this.examDateTime = examDate;
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