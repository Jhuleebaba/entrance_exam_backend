import mongoose, { CallbackError } from 'mongoose';
import bcrypt from 'bcryptjs';
import Settings from './Settings';

export interface IUser extends mongoose.Document {
  examNumber: string;
  password: string;
  surname: string;
  firstName: string;
  fullName: string;
  email: string;
  dateOfBirth: Date;
  sex: 'Male' | 'Female';
  stateOfOrigin: string;
  nationality: string;
  role: 'admin' | 'student';
  examGroup: number;
  examDateTime: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema({
  examNumber: {
    type: String,
    unique: true,
    sparse: true, // This allows null values while maintaining uniqueness
  },
  password: {
    type: String,
    required: true,
  },
  surname: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  fullName: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  dateOfBirth: {
    type: Date,
  },
  sex: {
    type: String,
    enum: ['Male', 'Female'],
  },
  stateOfOrigin: {
    type: String,
  },
  nationality: {
    type: String,
    default: 'Nigerian',
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

// Generate exam number
userSchema.pre('save', async function(next) {
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
userSchema.pre('save', async function(next) {
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
        // Parse base date and time
        const baseDate = new Date(settings.examStartDate);
        const [hours, minutes] = settings.examStartTime.split(':').map(Number);
        
        baseDate.setHours(hours, minutes, 0, 0);
        
        // Add interval hours based on group number
        const examDateTime = new Date(baseDate);
        examDateTime.setHours(
          examDateTime.getHours() + (examGroup * settings.examGroupIntervalHours)
        );
        
        this.examDateTime = examDateTime;
      }
    }
    next();
  } catch (error) {
    next(error as CallbackError);
  }
});

// Set fullName from surname and firstName
userSchema.pre('save', function(next) {
  this.fullName = `${this.surname} ${this.firstName}`;
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
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
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

export default mongoose.model<IUser>('User', userSchema); 