'use server';

import { generateTestQuestions } from './generate-test-questions';
import { adaptiveDifficultyAdjustment } from './adaptive-difficulty-adjustment';
import { generateFeedback } from './generate-feedback';

export { generateTestQuestions, adaptiveDifficultyAdjustment, generateFeedback };
