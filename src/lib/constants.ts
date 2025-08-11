import {
  Atom,
  BookText,
  BrainCircuit,
  Calculator,
  FlaskConical,
  Globe,
  Leaf,
  Newspaper,
  Beaker,
  Computer,
  Zap,
  Landmark,
  Scale,
} from 'lucide-react';
import type { Subject } from '@/types';

export const SUBJECTS: Subject[] = [
  { name: 'Arithmetic', slug: 'arithmetic', icon: Calculator, description: 'Test your math skills.' },
  { name: 'English', slug: 'english', icon: BookText, description: 'Challenge your vocabulary.' },
  { name: 'Physics', slug: 'physics', icon: Atom, description: 'Explore the laws of the universe.' },
  { name: 'Chemistry', slug: 'chemistry', icon: FlaskConical, description: 'Dive into the world of molecules.' },
  { name: 'Biology', slug: 'biology', icon: Leaf, description: 'Learn about living organisms.' },
  { name: 'Sciences', slug: 'sciences', icon: Beaker, description: 'General science principles.' },
  { name: 'Computer', slug: 'computer', icon: Computer, description: 'Understand computing technology.' },
  { name: 'Electricity', slug: 'electricity', icon: Zap, description: 'Learn about circuits and power.' },
  { name: 'Economics', slug: 'economics', icon: Landmark, description: 'Grasp the concepts of economy.' },
  { name: 'Civic Education', slug: 'civic-education', icon: Scale, description: 'Learn about rights and duties.' },
  { name: 'Geography', slug: 'geography', icon: Globe, description: 'Discover the world.' },
  { name: 'General Knowledge', slug: 'general-knowledge', icon: BrainCircuit, description: 'Broaden your awareness.' },
  { name: 'Current Affairs', slug: 'current-affairs', icon: Newspaper, description: 'Stay updated with events.' },
];

export const GRADES = [
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", 
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "High School", "University"
];

export const QUESTIONS_PER_LEVEL = 10;
export const TIME_PER_QUESTION = 15; // in seconds
export const SCORE_THRESHOLD = 70;
