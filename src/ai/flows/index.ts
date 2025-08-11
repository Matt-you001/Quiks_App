'use server';

import { generateTestQuestions } from './generate-test-questions';
import { adaptiveDifficultyAdjustment } from './adaptive-difficulty-adjustment';
import { textToSpeech } from './text-to-speech';

export { generateTestQuestions, adaptiveDifficultyAdjustment, textToSpeech };
