const mongoose = require('mongoose');

// User schema (simplified for the update script)
const userSchema = new mongoose.Schema({
  examNumber: String,
  surname: String,
  firstName: String,
  email: String,
  phoneNumber: String,
  dateOfBirth: Date,
  sex: String,
  stateOfOrigin: String,
  nationality: String,
  password: String,
  role: String,
  examGroup: Number,
  examDateTime: Date,
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);

async function updateStudentExamDetails() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/entrance-exam';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Exam settings - Adjusted for UTC+1 timezone
    const EXAM_START_DATE = '2025-07-12';
    const EXAM_START_TIME = '08:00'; // 8:00 AM UTC = 9:00 AM UTC+1
    const EXAM_GROUP_SIZE = 10;
    const EXAM_GROUP_INTERVAL_HOURS = 2;

    // Get all students sorted by creation date
    const students = await User.find({ role: 'student' }).sort({ createdAt: 1 });
    console.log(`Found ${students.length} students to update`);

    let updateCount = 0;

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      // Calculate group assignment based on order
      const examGroup = Math.floor(i / EXAM_GROUP_SIZE);
      
      // Calculate exam date/time for this group
      const examDateTime = new Date(EXAM_START_DATE + 'T' + EXAM_START_TIME + ':00.000Z');
      examDateTime.setHours(examDateTime.getHours() + (examGroup * EXAM_GROUP_INTERVAL_HOURS));

      // Update student if exam details are different
      if (student.examGroup !== examGroup || 
          !student.examDateTime || 
          student.examDateTime.getTime() !== examDateTime.getTime()) {
        
        await User.findByIdAndUpdate(student._id, {
          examGroup: examGroup,
          examDateTime: examDateTime
        });

        console.log(`Updated ${student.firstName} ${student.surname}:`);
        console.log(`- Group: ${examGroup + 1}`);
        console.log(`- Date/Time: ${examDateTime.toLocaleString()}`);
        updateCount++;
      }
    }

    console.log(`\nUpdate completed! Updated ${updateCount} students.`);
    console.log('All students now have correct exam date (July 12, 2025 at 9:00 AM) and group assignments.');

  } catch (error) {
    console.error('Error updating student exam details:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the update
updateStudentExamDetails(); 