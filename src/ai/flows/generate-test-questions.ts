
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
  recommendedTime: z.number().describe('The recommended time in seconds to complete the entire test, based on the question complexity.'),
});

export type GenerateTestQuestionsOutput = z.infer<typeof GenerateTestQuestionsOutputSchema>;

export async function generateTestQuestions(input: GenerateTestQuestionsInput): Promise<GenerateTestQuestionsOutput> {
  return generateTestQuestionsFlow(input);
}

const generateTestQuestionsPrompt = ai.definePrompt({
  name: 'generateTestQuestionsPrompt',
  input: {schema: GenerateTestQuestionsInputSchema},
  output: {schema: GenerateTestQuestionsOutputSchema},
  prompt: `You are an expert in generating a diverse and high-quality set of age-appropriate multiple-choice questions for educational purposes. Your primary goal is to ensure that the user receives a fresh, unique set of questions each time they take a test, drawing from a vast pool of knowledge.

  Generate {{numberOfQuestions}} multiple-choice questions for the subject of {{subject}} at a {{difficultyLevel}} difficulty, specifically tailored for a student in {{grade}}.

  **Crucially, do not repeat questions from previous sessions. Every test should feel new and different.**

  Based on the complexity and subject matter, also provide a recommended completion time in seconds for the entire set of questions. A simple arithmetic question might take 15 seconds, while a complex physics problem might take 60 seconds. Calculate the total recommended time for all questions.

  Each question must:
  1.  Be directly relevant to the core curriculum for a {{grade}} student in the subject of {{subject}}.
  2.  Have exactly 4 distinct options.
  3.  Have one, and only one, unambiguously correct answer.
  4.  Have plausible distractors (incorrect options) that are common mistakes or misconceptions for students at the {{grade}} level.
  5.  Be clearly worded and easy to understand for the specified grade level.

  Return the questions and recommended time in the following JSON format:
  {
    "questions": [
      {
        "question": "[The question text]",
        "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
        "correctAnswer": "[The correct answer]"
      },
      ...
    ],
    "recommendedTime": [Total time in seconds]
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
