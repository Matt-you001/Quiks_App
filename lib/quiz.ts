import { BASE_QUIZ_TIME_SECONDS, SCORE_THRESHOLD, TIME_INCREMENT_PER_LEVEL, difficulties } from "./subjects";
import type { Difficulty, Question, SessionResult } from "../types/app";

export interface LevelProgressOption {
  level: number;
  isPassed: boolean;
  isNextUnlocked: boolean;
}

export function shuffleOptions(options: string[]) {
  const next = [...options];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function normalizeQuestions(questions: Question[]) {
  return questions.map((question) => ({
    ...question,
    options: shuffleOptions(question.options),
  }));
}

export function calculateQuizTime(level: number, customSeconds?: number) {
  if (customSeconds && customSeconds > 0) {
    return customSeconds;
  }

  return BASE_QUIZ_TIME_SECONDS + (level - 1) * TIME_INCREMENT_PER_LEVEL;
}

export function getNextDifficulty(current: Difficulty): Difficulty {
  const currentIndex = difficulties.indexOf(current);
  return difficulties[Math.min(currentIndex + 1, difficulties.length - 1)];
}

export function getUnlockedLevels(results: SessionResult[], subjectId: string) {
  let maxUnlocked = 1;
  for (const result of results) {
    if (result.subjectId === subjectId && result.score >= SCORE_THRESHOLD) {
      maxUnlocked = Math.max(maxUnlocked, result.level + 1);
    }
  }
  return Array.from({ length: maxUnlocked }, (_, index) => index + 1);
}

export function getUnlockedLevelsForGrade(results: SessionResult[], subjectId: string, grade: string) {
  let maxUnlocked = 1;
  for (const result of results) {
    if (result.subjectId === subjectId && result.grade === grade && result.score >= SCORE_THRESHOLD) {
      maxUnlocked = Math.max(maxUnlocked, result.level + 1);
    }
  }
  return Array.from({ length: maxUnlocked }, (_, index) => index + 1);
}

export function getLevelProgressForGrade(results: SessionResult[], subjectId: string, grade: string): LevelProgressOption[] {
  const unlockedLevels = getUnlockedLevelsForGrade(results, subjectId, grade);
  const passedLevels = new Set(
    results
      .filter((result) => result.subjectId === subjectId && result.grade === grade && result.score >= SCORE_THRESHOLD)
      .map((result) => result.level)
  );

  return unlockedLevels.map((level, index) => ({
    level,
    isPassed: passedLevels.has(level),
    isNextUnlocked: index === unlockedLevels.length - 1 && !passedLevels.has(level),
  }));
}

export function scoreQuestions(questions: Question[], answers: Array<string | null>) {
  let correctAnswers = 0;
  questions.forEach((question, index) => {
    if (answers[index] === question.answer) {
      correctAnswers += 1;
    }
  });

  return {
    correctAnswers,
    totalQuestions: questions.length,
    score: Math.round((correctAnswers / questions.length) * 100),
  };
}
