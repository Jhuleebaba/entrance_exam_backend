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

// Function to clean HTML entities and tags
const cleanHTML = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  return str
    // First decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Then remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanupQuestions = async () => {
  try {
    await connectDB();
    
    console.log('🧹 Starting HTML cleanup process...\n');
    
    const questions = await Question.find({});
    console.log(`📋 Found ${questions.length} questions to process\n`);
    
    let updatedCount = 0;
    let processedCount = 0;
    
    for (let question of questions) {
      let needsUpdate = false;
      let updates = {};
      
      // Clean question text
      const cleanedQuestion = cleanHTML(question.question);
      if (cleanedQuestion !== question.question) {
        updates.question = cleanedQuestion;
        needsUpdate = true;
      }
      
      // Clean options
      const cleanedOptions = question.options.map(opt => cleanHTML(opt));
      if (JSON.stringify(cleanedOptions) !== JSON.stringify(question.options)) {
        updates.options = cleanedOptions;
        needsUpdate = true;
      }
      
      // Clean correct answer
      const cleanedAnswer = cleanHTML(question.correctAnswer);
      if (cleanedAnswer !== question.correctAnswer) {
        updates.correctAnswer = cleanedAnswer;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await Question.updateOne({ _id: question._id }, updates);
        updatedCount++;
        
        if (updatedCount <= 3) {
          console.log(`✨ UPDATED #${updatedCount} [${question.subject}]:`);
          console.log(`   Before: "${question.question.substring(0, 60)}..."`);
          console.log(`   After:  "${updates.question?.substring(0, 60) || question.question.substring(0, 60)}..."`);
          console.log('');
        }
      }
      
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`📊 Progress: ${processedCount}/${questions.length} processed`);
      }
    }
    
    console.log('\n🎉 CLEANUP COMPLETE!');
    console.log('═══════════════════════');
    console.log(`📋 Total questions: ${questions.length}`);
    console.log(`✨ Updated questions: ${updatedCount}`);
    console.log(`✅ Clean questions: ${questions.length - updatedCount}`);
    console.log(`📊 Success rate: ${((updatedCount / questions.length) * 100).toFixed(1)}%`);
    
    if (updatedCount > 3) {
      console.log(`\n💡 ${updatedCount - 3} more questions were cleaned (not shown above)`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed');
  }
};

console.log('🚀 HTML Entity & Tag Cleanup Tool');
console.log('═══════════════════════════════════');
console.log('🧹 This tool will clean HTML entities and tags from all questions.\n');

// Add safety prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('⚠️  This will modify your database. Continue? (y/N): ', (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    rl.close();
    cleanupQuestions();
  } else {
    console.log('❌ Cleanup cancelled by user');
    rl.close();
    process.exit(0);
  }
}); 