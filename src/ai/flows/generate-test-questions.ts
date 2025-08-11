'use server';

/**
 * @fileOverview This file defines a Genkit flow for generating multiple-choice test questions based on a given subject and difficulty level.
 *
 * - generateTestQuestions - A function that generates test questions.
 * - GenerateTestQuestionsInput - The input type for the generateTestQuestions function.
 * - GenerateTestQuestionsOutput - The return type for the generateTestQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTestQuestionsInputSchema = z.object({
  subject: z.string().describe('The subject for which to generate questions (e.g., Arithmetic, English, Physics).'),
  difficultyLevel: z.string().describe('The difficulty level of the questions (e.g., easy, medium, hard).'),
  numberOfQuestions: z.number().describe('The number of questions to generate.'),
  grade: z.string().describe("The user's selected grade level (e.g., Grade 1, Grade 5, High School)."),
});

export type GenerateTestQuestionsInput = z.infer<typeof GenerateTestQuestionsInputSchema>;

const GenerateTestQuestionsOutputSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe('The text of the question.'),
      options: z.array(z.string()).describe('An array of possible answers, including the correct answer.'),
      correctAnswer: z.string().describe('The correct answer to the question.'),
    })
  ).describe('An array of generated questions with their options and correct answers.'),
});

export type GenerateTestQuestionsOutput = z.infer<typeof GenerateTestQuestionsOutputSchema>;

export async function generateTestQuestions(input: GenerateTestQuestionsInput): Promise<GenerateTestQuestionsOutput> {
  return generateTestQuestionsFlow(input);
}

const generateTestQuestionsPrompt = ai.definePrompt({
  name: 'generateTestQuestionsPrompt',
  input: {schema: GenerateTestQuestionsInputSchema},
  output: {schema: GenerateTestQuestionsOutputSchema},
  prompt: `You are an expert in generating multiple-choice questions for various subjects and grade levels.

  Generate {{numberOfQuestions}} multiple-choice questions for the subject of {{subject}} at a {{difficultyLevel}} difficulty level, tailored for a student in {{grade}}.

  Each question should have 4 options, with one correct answer. The questions must be appropriate for the specified grade level.

  Return the questions in the following JSON format:
  {
    "questions": [
      {
        "question": "[The question text]",
        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
        "correctAnswer": "[The correct answer]"
      },
      ...
    ]
  }
  `,
});

const generateTestQuestionsFlow = ai.defineFlow(
  {
    name: 'generateTestQuestionsFlow',
    inputSchema: GenerateTestQuestionsInputSchema,
    outputSchema: GenerateTestQuestionsOutputSchema,
  },
  async input => {
    const {output} = await generateTestQuestionsPrompt(input);
    return output!;
  }
);
