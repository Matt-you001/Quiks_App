export type TestMode = "quiz" | "training";

export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface Subject {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  accent: [string, string];
  description: string;
  aiPromptHint: string;
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  targetExam: string;
  dailyGoalMinutes: number;
}

export interface Question {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface SessionResult {
  id: string;
  date: string;
  subjectId: string;
  subjectName: string;
  level: number;
  difficulty: Difficulty;
  grade: string;
  mode: TestMode;
  score: number;
  timeTakenSeconds: number;
  correctAnswers: number;
  totalQuestions: number;
  coinsEarned: number;
  aiFeedback: string;
  aiStudyPlan: string[];
}

export interface BreatherContent {
  id: string;
  title: string;
  intro: string;
  story: string;
  reflection: string;
  facts: string[];
  continueLabel?: string;
}

export interface StoredAppState {
  profiles: UserProfile[];
  currentProfileId: string | null;
  results: Record<string, SessionResult[]>;
}

export interface QuestionRequest {
  subject: Subject;
  grade: string;
  difficulty: Difficulty;
  mode: TestMode;
  level: number;
  questionCount: number;
  profile?: UserProfile | null;
}

export interface QuestionResponse {
  questions: Question[];
  source: "remote" | "demo" | "local";
}

export interface FeedbackRequest {
  score: number;
  subject: Subject;
  grade: string;
  profile?: UserProfile | null;
}

export interface CoachPlanRequest {
  resultScore: number;
  subject: Subject;
  grade: string;
  level: number;
  profile?: UserProfile | null;
}
