/**
 * Utility for parsing question documents
 * 
 * This is a simplified example of how documents could be parsed.
 * In a production environment, you would use specialized libraries for
 * different file formats (docx, pdf, etc.)
 */

import fs from 'fs';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

interface ParsedQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  marks: number;
  subject: string;
}

/**
 * Parse a text document containing questions
 * 
 * @param filePath Path to the text file
 * @param subject Subject to assign to all questions
 * @returns Array of parsed questions
 */
export const parseTextDocument = async (filePath: string, subject: string): Promise<ParsedQuestion[]> => {
  try {
    // Read file content
    const content = await fs.promises.readFile(filePath, 'utf8');

    // Split the content by double newlines to separate questions
    const questionBlocks = content.split(/\n\s*\n+/);

    const parsedQuestions: ParsedQuestion[] = [];

    for (let block of questionBlocks) {
      try {
        const lines = block.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length < 6) {
          console.warn('Skipping block with insufficient lines:', block);
          continue;
        }

        let questionText = '';
        let options: string[] = ['', '', '', ''];
        let correctAnswer = '';
        let marks = 1;

        for (let line of lines) {
          if (line.startsWith('Q:')) {
            questionText = line.substring(2).trim();
          } else if (line.startsWith('A:')) {
            options[0] = line.substring(2).trim();
          } else if (line.startsWith('B:')) {
            options[1] = line.substring(2).trim();
          } else if (line.startsWith('C:')) {
            options[2] = line.substring(2).trim();
          } else if (line.startsWith('D:')) {
            options[3] = line.substring(2).trim();
          } else if (line.startsWith('Correct:')) {
            const correctOption = line.substring(8).trim();

            // Map the letter (A, B, C, D) to the corresponding option
            if (correctOption === 'A') {
              correctAnswer = options[0];
            } else if (correctOption === 'B') {
              correctAnswer = options[1];
            } else if (correctOption === 'C') {
              correctAnswer = options[2];
            } else if (correctOption === 'D') {
              correctAnswer = options[3];
            }
          } else if (line.startsWith('Marks:')) {
            marks = parseInt(line.substring(6).trim(), 10) || 1;
          }
        }

        // Validate the parsed question
        if (
          questionText &&
          options.every(opt => opt.length > 0) &&
          correctAnswer &&
          options.includes(correctAnswer)
        ) {
          parsedQuestions.push({
            question: questionText,
            options,
            correctAnswer,
            marks,
            subject
          });
        } else {
          console.warn('Invalid question format:', block);
        }
      } catch (err) {
        console.error('Error parsing question block:', err);
      }
    }

    return parsedQuestions;
  } catch (error) {
    console.error('Error parsing document:', error);
    throw new Error('Failed to parse document');
  }
};

/**
 * Main function to parse uploaded document
 * This would be expanded to handle different file types
 * 
 * @param filePath Path to the uploaded file
 * @param subject Subject to assign to all questions
 * @returns Array of parsed questions
 */
export const parseDocument = async (filePath: string, subject: string): Promise<ParsedQuestion[]> => {
  const extension = filePath.split('.').pop()?.toLowerCase();

  let textContent: string;
  try {
    if (extension === 'docx' || extension === 'doc') {
      const result = await mammoth.extractRawText({ path: filePath });
      textContent = result.value;
    } else if (extension === 'pdf') {
      const data = await fs.promises.readFile(filePath);
      const result = await pdfParse(data);
      textContent = result.text;
    } else {
      // default to txt
      textContent = await fs.promises.readFile(filePath, 'utf8');
    }
    // Split into blocks and parse each block
    const questionBlocks = textContent.split(/\n\s*\n+/);
    // Use the same parsing logic as parseTextDocument on each block
    const parsedQuestions: ParsedQuestion[] = [];
    for (const block of questionBlocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 6) continue;
      let questionText = '';
      const options = ['', '', '', ''];
      let correctAnswer = '';
      let marks = 1;
      for (const line of lines) {
        if (line.startsWith('Q:')) questionText = line.substring(2).trim();
        else if (line.startsWith('A:')) options[0] = line.substring(2).trim();
        else if (line.startsWith('B:')) options[1] = line.substring(2).trim();
        else if (line.startsWith('C:')) options[2] = line.substring(2).trim();
        else if (line.startsWith('D:')) options[3] = line.substring(2).trim();
        else if (line.startsWith('Correct:')) {
          const opt = line.substring(8).trim();
          const idx = ['A', 'B', 'C', 'D'].indexOf(opt);
          if (idx >= 0) correctAnswer = options[idx];
        } else if (line.startsWith('Marks:')) marks = parseInt(line.substring(6).trim(), 10) || 1;
      }
      if (questionText && options.every(o => o) && options.includes(correctAnswer)) {
        parsedQuestions.push({ question: questionText, options, correctAnswer, marks, subject });
      }
    }
    return parsedQuestions;
  } catch (err) {
    console.error('Error parsing document:', err);
    throw new Error('Failed to parse document');
  }
};

export default parseDocument; 