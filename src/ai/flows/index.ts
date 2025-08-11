'use server';

import { generateTestQuestions } from './generate-test-questions';
import { adaptiveDifficultyAdjustment } from './adaptive-difficulty-adjustment';
import { textToSpeech } from './text-to-speech';
import { generateFeedback } from './generate-feedback';

export { generateTestQuestions, adaptiveDifficultyAdjustment, textToSpeech, generateFeedback };
