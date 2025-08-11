'use server';

/**
 * @fileOverview Generates encouraging audio feedback for the user based on their test score.
 *
 * - generateFeedback - A function that generates a supportive message.
 * - GenerateFeedbackInput - The input type for the generateFeedback function.
 * - GenerateFeedbackOutput - The return type for the generateFeedback function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFeedbackInputSchema = z.object({
  score: z.number().describe("The user's final score percentage."),
  subject: z.string().describe('The subject of the test.'),
  grade: z.string().describe("The user's grade level."),
});
export type GenerateFeedbackInput = z.infer<typeof GenerateFeedbackInputSchema>;

const GenerateFeedbackOutputSchema = z.object({
  feedback: z
    .string()
    .describe(
      'A short, encouraging, and positive feedback message for the user, tailored to their performance. The tone should be friendly and motivational, as if talking to a child.'
    ),
});
export type GenerateFeedbackOutput = z.infer<typeof GenerateFeedbackOutputSchema>;

export async function generateFeedback(
  input: GenerateFeedbackInput
): Promise<GenerateFeedbackOutput> {
  return generateFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFeedbackPrompt',
  input: {schema: GenerateFeedbackInputSchema},
  output: {schema: GenerateFeedbackOutputSchema},
  prompt: `You are a friendly and encouraging educational coach for kids.

A student in {{grade}} just completed a test on the subject of {{subject}} and scored {{score}}%.

Your task is to provide a short (1-2 sentences), positive, and motivational feedback message.

- If the score is high (above 70%), praise their effort and success. Use words like "Excellent!", "Great job!", or "Wow!".
- If the score is low (below 70%), be encouraging and focus on learning and trying again. Avoid negative words. Use phrases like "Nice try!", "You're getting there!", or "Keep practicing!".
- Always maintain a positive and supportive tone.
- Tailor the message to be appropriate for a child in {{grade}}.

Example for a high score: "Wow, 90%! You're a star at {{subject}}! Keep up the amazing work!"
Example for a low score: "You scored 50%. That's a great start! Keep practicing {{subject}} and you'll be an expert in no time!"

Generate the feedback message now.`,
});

const generateFeedbackFlow = ai.defineFlow(
  {
    name: 'generateFeedbackFlow',
    inputSchema: GenerateFeedbackInputSchema,
    outputSchema: GenerateFeedbackOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
