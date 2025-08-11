import type { LucideIcon } from 'lucide-react';

export interface Subject {
  name: string;
  slug: string;
  icon: LucideIcon;
  description: string;
}

export interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

export type SerializableSubject = Omit<Subject, 'icon'>;

export interface UserProfile {
  name: string;
  age: number;
}

export interface TestResult {
    date: string;
    subject: string;
    level: number;
    difficulty: string;
    grade: string;
    score: number;
    timeTaken: number;
    coinsEarned: number;
}
