const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/entrance-exam';
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Question schema
const questionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  correctAnswer: String,
  subject: String,
  marks: Number
});

const Question = mongoose.model('Question', questionSchema);

// Function to check if a string contains HTML tags
const containsHTML = (str) => {
  return /<[^>]*>/.test(str);
};

// Function to clean HTML tags for preview
const cleanHTML = (htmlString) => {
  if (!htmlString || typeof htmlString !== 'string') {
    return htmlString;
  }
  
  return htmlString
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const analyzeQuestions = async () => {
  try {
    await connectDB();
    
    console.log('\n🔍 Analyzing questions for HTML content...\n');
    
    // Find all questions
    const questions = await Question.find({});
    console.log(`📋 Found ${questions.length} total questions\n`);
    
    let questionsWithHTML = [];
    let htmlCount = 0;
    
    for (let question of questions) {
      let hasHTML = false;
      let htmlFields = [];
      
      // Check question text
      if (containsHTML(question.question)) {
        hasHTML = true;
        htmlFields.push('question');
      }
      
      // Check options
      question.options.forEach((option, index) => {
        if (containsHTML(option)) {
          hasHTML = true;
          htmlFields.push(`option${index + 1}`);
        }
      });
      
      // Check correct answer
      if (containsHTML(question.correctAnswer)) {
        hasHTML = true;
        htmlFields.push('correctAnswer');
      }
      
      if (hasHTML) {
        htmlCount++;
        questionsWithHTML.push({
          id: question._id,
          subject: question.subject,
          htmlFields: htmlFields,
          question: question.question,
          options: question.options,
          correctAnswer: question.correctAnswer
        });
      }
    }
    
    console.log(`📊 ANALYSIS RESULTS:`);
    console.log(`─────────────────────`);
    console.log(`📋 Total questions: ${questions.length}`);
    console.log(`🏷️  Questions with HTML: ${htmlCount}`);
    console.log(`✅ Clean questions: ${questions.length - htmlCount}`);
    console.log(`📈 HTML percentage: ${((htmlCount / questions.length) * 100).toFixed(1)}%\n`);
    
    if (htmlCount > 0) {
      console.log('📝 DETAILED BREAKDOWN:\n');
      
      // Group by subject
      const bySubject = {};
      questionsWithHTML.forEach(q => {
        if (!bySubject[q.subject]) bySubject[q.subject] = [];
        bySubject[q.subject].push(q);
      });
      
      Object.keys(bySubject).forEach(subject => {
        console.log(`🎯 ${subject}: ${bySubject[subject].length} questions with HTML`);
      });
      
      console.log('\n📄 SAMPLE PROBLEMS (first 3):');
      console.log('─────────────────────────────────');
      
      questionsWithHTML.slice(0, 3).forEach((q, index) => {
        console.log(`\n${index + 1}. [${q.subject}] - Fields: ${q.htmlFields.join(', ')}`);
        console.log(`   ❌ Original: "${q.question.substring(0, 80)}${q.question.length > 80 ? '...' : ''}"`);
        console.log(`   ✅ Cleaned:  "${cleanHTML(q.question).substring(0, 80)}${cleanHTML(q.question).length > 80 ? '...' : ''}"`);
      });
      
      if (questionsWithHTML.length > 3) {
        console.log(`\n   ... and ${questionsWithHTML.length - 3} more questions with HTML content`);
      }
      
      console.log('\n🔧 NEXT STEPS:');
      console.log('─────────────────');
      console.log('1. Review the samples above to confirm cleanup is needed');
      console.log('2. Create a database backup');
      console.log('3. Run: node cleanupQuestionHTML.js');
      
    } else {
      console.log('🎉 GREAT NEWS! No HTML content found in questions.');
      console.log('📝 All questions appear to be clean text already.');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing questions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n📝 Database connection closed');
  }
};

// Run the analysis
console.log('🚀 Question HTML Content Analyzer');
console.log('═══════════════════════════════════');
console.log('📋 This tool analyzes questions for HTML content without making changes.\n');

analyzeQuestions(); 