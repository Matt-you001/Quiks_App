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
