import mongoose from 'mongoose';
import Question from '../models/Question';

const sampleQuestions = [
  // Mathematics Questions
  {
    question: "What is the value of π (pi) to two decimal places?",
    options: ["3.12", "3.14", "3.16", "3.18"],
    correctAnswer: "3.14",
    subject: "Mathematics",
    marks: 2
  },
  {
    question: "Solve for x: 2x + 5 = 13",
    options: ["x = 4", "x = 6", "x = 8", "x = 3"],
    correctAnswer: "x = 4",
    subject: "Mathematics",
    marks: 2
  },
  {
    question: "What is the square root of 144?",
    options: ["10", "12", "14", "16"],
    correctAnswer: "12",
    subject: "Mathematics",
    marks: 2
  },

  // English Questions
  {
    question: "Which of these is a proper noun?",
    options: ["happy", "London", "beautiful", "quickly"],
    correctAnswer: "London",
    subject: "English",
    marks: 1
  },
  {
    question: "What is the past tense of 'write'?",
    options: ["wrote", "written", "writing", "writes"],
    correctAnswer: "wrote",
    subject: "English",
    marks: 1
  },
  {
    question: "Identify the correct sentence:",
    options: [
      "They is going home.",
      "He have a book.",
      "She is reading a book.",
      "We is happy."
    ],
    correctAnswer: "She is reading a book.",
    subject: "English",
    marks: 1
  },

  // Science Questions
  {
    question: "What is the chemical symbol for gold?",
    options: ["Au", "Ag", "Fe", "Cu"],
    correctAnswer: "Au",
    subject: "Science",
    marks: 2
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Jupiter", "Mars", "Saturn"],
    correctAnswer: "Mars",
    subject: "Science",
    marks: 1
  },
  {
    question: "What is the largest organ in the human body?",
    options: ["Heart", "Brain", "Liver", "Skin"],
    correctAnswer: "Skin",
    subject: "Science",
    marks: 2
  },

  // General Knowledge Questions
  {
    question: "What is the capital of Nigeria?",
    options: ["Lagos", "Abuja", "Kano", "Port Harcourt"],
    correctAnswer: "Abuja",
    subject: "General Knowledge",
    marks: 2
  },
  {
    question: "Who wrote 'Things Fall Apart'?",
    options: [
      "Wole Soyinka",
      "Chinua Achebe",
      "Chimamanda Adichie",
      "Ben Okri"
    ],
    correctAnswer: "Chinua Achebe",
    subject: "General Knowledge",
    marks: 2
  },
  {
    question: "Which river is the longest in Africa?",
    options: ["Congo River", "Niger River", "Nile River", "Zambezi River"],
    correctAnswer: "Nile River",
    subject: "General Knowledge",
    marks: 2
  }
];

const addSampleQuestions = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/entrance-exam');
    console.log('Connected to MongoDB');

    // Delete existing questions
    await Question.deleteMany({});
    console.log('Cleared existing questions');

    // Add new questions
    const questions = await Question.insertMany(sampleQuestions);
    console.log(`Added ${questions.length} sample questions`);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error adding sample questions:', error);
  }
};

// Run the script
addSampleQuestions(); 