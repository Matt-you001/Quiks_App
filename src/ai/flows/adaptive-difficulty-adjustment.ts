'use server';

/**
 * @fileOverview Dynamically adjusts the difficulty of questions based on user performance.
 *
 * - adaptiveDifficultyAdjustment - Adjusts question difficulty based on user score.
 * - AdaptiveDifficultyInput - The input type for adaptiveDifficultyAdjustment.
 * - AdaptiveDifficultyOutput - The return type for adaptiveDifficultyAdjustment.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdaptiveDifficultyInputSchema = z.object({
  currentScore: z
    .number()
    .describe("The user's current score on the previous level."),
  currentDifficulty: z
    .string()
    .describe('The current difficulty level of the questions.'),
  subject: z.string().describe('The subject of the questions.'),
});
export type AdaptiveDifficultyInput = z.infer<typeof AdaptiveDifficultyInputSchema>;

const AdaptiveDifficultyOutputSchema = z.object({
  newDifficulty: z
    .string()
    .describe(
      'The new difficulty level of the questions, adjusted based on the user score.'
    ),
  reasoning: z
    .string()
    .describe(
      'The AI reasoning for difficulty adjustment, so the user knows why he/she has been promoted.'
    ),
});
export type AdaptiveDifficultyOutput = z.infer<typeof AdaptiveDifficultyOutputSchema>;

export async function adaptiveDifficultyAdjustment(
  input: AdaptiveDifficultyInput
): Promise<AdaptiveDifficultyOutput> {
  return adaptiveDifficultyAdjustmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adaptiveDifficultyPrompt',
  input: {schema: AdaptiveDifficultyInputSchema},
  output: {schema: AdaptiveDifficultyOutputSchema},
  prompt: `You are an AI that adjusts the difficulty of questions for a user based on their performance.

The user has a score of {{currentScore}} on the {{currentDifficulty}} level in {{subject}}.

Based on the user's score, determine the new difficulty level. Possible difficulty levels are: Beginner, Intermediate, Advanced, Expert

If the user's score is less than 70, keep the difficulty at the same level and let them repeat.
If the user's score is 70 or higher, increase the difficulty to the next level.

Difficulty levels are Beginner < Intermediate < Advanced < Expert.

Return the new difficulty level and your reasoning for why you chose that difficulty. Always start with beginner difficulty level.

Output the difficulty and reasoning in JSON format.`,
});

const adaptiveDifficultyAdjustmentFlow = ai.defineFlow(
  {
    name: 'adaptiveDifficultyAdjustmentFlow',
    inputSchema: AdaptiveDifficultyInputSchema,
    outputSchema: AdaptiveDifficultyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
