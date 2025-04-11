/**
 * Utility for parsing question documents
 * 
 * This is a simplified example of how documents could be parsed.
 * In a production environment, you would use specialized libraries for
 * different file formats (docx, pdf, etc.)
 */

import fs from 'fs';

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
  
  // For now, we'll just handle text files as an example
  // In a real implementation, you would add parsers for .doc, .docx, .pdf, etc.
  // using libraries like mammoth (docx), pdf-parse (pdf), etc.
  if (extension === 'txt') {
    return parseTextDocument(filePath, subject);
  }
  
  // For demonstration, pretend other file types work the same way
  // In reality, you'd use format-specific libraries for parsing
  return parseTextDocument(filePath, subject);
};

export default parseDocument; 