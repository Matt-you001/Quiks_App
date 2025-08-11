import {
  Atom,
  BookText,
  BrainCircuit,
  Calculator,
  FlaskConical,
  Globe,
  Leaf,
  Newspaper,
} from 'lucide-react';
import type { Subject } from '@/types';

export const SUBJECTS: Subject[] = [
  { name: 'Arithmetic', slug: 'arithmetic', icon: Calculator, description: 'Test your math skills.' },
  { name: 'English', slug: 'english', icon: BookText, description: 'Challenge your vocabulary.' },
  { name: 'Physics', slug: 'physics', icon: Atom, description: 'Explore the laws of the universe.' },
  { name: 'Chemistry', slug: 'chemistry', icon: FlaskConical, description: 'Dive into the world of molecules.' },
  { name: 'Biology', slug: 'biology', icon: Leaf, description: 'Learn about living organisms.' },
  { name: 'Geography', slug: 'geography', icon: Globe, description: 'Discover the world.' },
  { name: 'General Knowledge', slug: 'general-knowledge', icon: BrainCircuit, description: 'Broaden your awareness.' },
  { name: 'Current Affairs', slug: 'current-affairs', icon: Newspaper, description: 'Stay updated with events.' },
];

export const QUESTIONS_PER_LEVEL = 5;
export const TIME_PER_QUESTION = 20; // in seconds
export const SCORE_THRESHOLD = 70;
