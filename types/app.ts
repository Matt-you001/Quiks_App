export type TestMode = "quiz" | "training";

export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export type QuestionFocusMode = "general" | "topic";

export interface SubjectTopic {
  id: string;
  label: string;
  description: string;
  keywords: string[];
}

export interface Subject {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  accent: [string, string];
  description: string;
  aiPromptHint: string;
  topics: SubjectTopic[];
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
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
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
  formatLabel?: string;
  story: string;
  teachingPoint?: string;
  teachingTitle?: string;
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
  focusMode?: QuestionFocusMode;
  topicId?: string;
  topicLabel?: string;
  profile?: UserProfile | null;
  recentQuestionIds?: string[];
}

export interface QuestionResponse {
  questions: Question[];
  source: "remote" | "demo" | "local";
}

export interface FeedbackRequest {
  score: number;
  subject: Subject;
  grade: string;
  focusMode?: QuestionFocusMode;
  topicLabel?: string;
  profile?: UserProfile | null;
}

export interface CoachPlanRequest {
  resultScore: number;
  subject: Subject;
  grade: string;
  level: number;
  focusMode?: QuestionFocusMode;
  topicLabel?: string;
  profile?: UserProfile | null;
}
