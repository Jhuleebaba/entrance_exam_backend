const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    // Use your production MongoDB connection string here
    // You can get this from your deployed backend's environment variables
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/entrance-exam';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Question schema
const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  options: {
    type: [String],
    required: [true, 'Four options are required'],
    validate: {
      validator: function(v) {
        return v.length === 4;
      },
      message: 'Exactly four options are required'
    }
  },
  correctAnswer: {
    type: String,
    required: [true, 'Correct answer is required']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    index: true
  },
  marks: {
    type: Number,
    required: [true, 'Marks are required'],
    min: [1, 'Marks must be at least 1']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Question = mongoose.model('Question', questionSchema);

// Function to clean HTML tags and convert to plain text
const cleanHTML = (htmlString) => {
  if (!htmlString || typeof htmlString !== 'string') {
    return htmlString;
  }
  
  return htmlString
    // Remove HTML tags but keep the content
    .replace(/<[^>]*>/g, '')
    // Convert HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

// Function to check if a string contains HTML tags
const containsHTML = (str) => {
  return /<[^>]*>/.test(str);
};

const cleanupQuestions = async () => {
  try {
    await connectDB();
    
    console.log('Starting question cleanup...');
    
    // Find all questions
    const questions = await Question.find({});
    console.log(`Found ${questions.length} questions to process`);
    
    let updatedCount = 0;
    let cleanedQuestions = [];
    
    for (let question of questions) {
      let needsUpdate = false;
      let updates = {};
      
      // Check and clean question text
      if (containsHTML(question.question)) {
        const cleanedQuestion = cleanHTML(question.question);
        updates.question = cleanedQuestion;
        needsUpdate = true;
        console.log(`Cleaning question: "${question.question.substring(0, 50)}..." -> "${cleanedQuestion.substring(0, 50)}..."`);
      }
      
      // Check and clean options
      const cleanedOptions = [];
      let optionsNeedUpdate = false;
      
      for (let i = 0; i < question.options.length; i++) {
        const option = question.options[i];
        if (containsHTML(option)) {
          const cleanedOption = cleanHTML(option);
          cleanedOptions.push(cleanedOption);
          optionsNeedUpdate = true;
          console.log(`Cleaning option: "${option}" -> "${cleanedOption}"`);
        } else {
          cleanedOptions.push(option);
        }
      }
      
      if (optionsNeedUpdate) {
        updates.options = cleanedOptions;
        needsUpdate = true;
      }
      
      // Check and clean correct answer
      if (containsHTML(question.correctAnswer)) {
        const cleanedAnswer = cleanHTML(question.correctAnswer);
        updates.correctAnswer = cleanedAnswer;
        needsUpdate = true;
        console.log(`Cleaning correct answer: "${question.correctAnswer}" -> "${cleanedAnswer}"`);
      }
      
      // Update the question if needed
      if (needsUpdate) {
        await Question.findByIdAndUpdate(question._id, updates);
        updatedCount++;
        cleanedQuestions.push({
          id: question._id,
          subject: question.subject,
          originalQuestion: question.question.substring(0, 50) + '...',
          cleanedQuestion: updates.question ? updates.question.substring(0, 50) + '...' : 'No change'
        });
      }
    }
    
    console.log(`\n✅ Cleanup completed!`);
    console.log(`📊 Total questions processed: ${questions.length}`);
    console.log(`🔧 Questions updated: ${updatedCount}`);
    console.log(`✨ Questions already clean: ${questions.length - updatedCount}`);
    
    if (cleanedQuestions.length > 0) {
      console.log('\n📋 Summary of cleaned questions:');
      cleanedQuestions.forEach((q, index) => {
        console.log(`${index + 1}. [${q.subject}] ${q.originalQuestion} -> ${q.cleanedQuestion}`);
      });
    }
    
    console.log('\n🎉 All questions have been cleaned! HTML tags removed and text preserved.');
    
  } catch (error) {
    console.error('❌ Error cleaning up questions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
};

// Run the cleanup
console.log('🚀 Starting Question HTML Cleanup Script...');
console.log('This script will remove HTML tags from questions while preserving the text content.');
console.log('Please ensure you have a backup of your database before running this script.\n');

cleanupQuestions(); 