const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/entrance-exam';
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to database:', mongoose.connection.name);
  } catch (error) {
    console.error('❌ Connection error:', error);
    process.exit(1);
  }
};

const questionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  correctAnswer: String,
  subject: String,
  marks: Number
});

const Question = mongoose.model('Question', questionSchema);

const checkQuestions = async () => {
  try {
    await connectDB();
    
    // Get first 3 questions from each subject
    const subjects = ['Mathematics', 'English', 'Verbal Reasoning', 'Quantitative Reasoning', 'General Paper'];
    
    console.log('📋 ACTUAL QUESTION DATA SAMPLE:\n');
    
    for (let subject of subjects) {
      const questions = await Question.find({ subject }).limit(2);
      
      console.log(`🎯 ${subject.toUpperCase()} (${questions.length} samples):`);
      console.log('=' .repeat(50));
      
      questions.forEach((q, index) => {
        console.log(`\n${index + 1}. ID: ${q._id}`);
        console.log(`   Question: "${q.question}"`);
        console.log(`   Options:`);
        q.options.forEach((opt, i) => {
          console.log(`     ${String.fromCharCode(65 + i)}: "${opt}"`);
        });
        console.log(`   Correct: "${q.correctAnswer}"`);
        console.log(`   Marks: ${q.marks}`);
      });
      console.log('\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Connection closed');
  }
};

checkQuestions(); 