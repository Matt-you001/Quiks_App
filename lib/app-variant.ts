import Constants from "expo-constants";
import type { Difficulty, TestMode } from "../types/app";

export type AppVariant = "children" | "teens" | "uni";

export interface VariantTheme {
  ink: string;
  navy: string;
  slate: string;
  mist: string;
  sky: string;
  aqua: string;
  mint: string;
  success: string;
  warn: string;
  danger: string;
  paper: string;
  white: string;
  gradientTop: string;
  gradientMid: string;
  gradientBottom: string;
  glowTop: string;
  glowBottom: string;
}

export interface VariantConfig {
  id: AppVariant;
  appName: string;
  slug: string;
  scheme: string;
  androidPackage: string;
  audienceLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  profileNoun: string;
  profileEditorSubtitle: string;
  defaultTargetExam: string;
  targetExamPlaceholder: string;
  defaultDailyGoalMinutes: number;
  aiGuidance: string;
  defaultMode: TestMode;
  defaultDifficulty: Difficulty;
  trainingLabel: string;
  trainingHint: string;
  quizLabel: string;
  quizHint: string;
  studyAssistantTitle: string;
  curriculumSingular: string;
  curriculumPlural: string;
  allowedGrades: string[];
  allowedSubjectIds: string[];
  subjectNameOverrides?: Record<string, string>;
  theme: VariantTheme;
}

const childrenTheme: VariantTheme = {
  ink: "#1A1033",
  navy: "#7A2CC8",
  slate: "#493A72",
  mist: "#E9DDFB",
  sky: "#F7A7D8",
  aqua: "#F46BB5",
  mint: "#FFECC8",
  success: "#20A36E",
  warn: "#F3A62A",
  danger: "#E0527A",
  paper: "#FFF9FD",
  white: "#FFFFFF",
  gradientTop: "#7A2CC8",
  gradientMid: "#F46BB5",
  gradientBottom: "#FFF9FD",
  glowTop: "rgba(247, 167, 216, 0.26)",
  glowBottom: "rgba(255, 236, 200, 0.22)",
};

const teensTheme: VariantTheme = {
  ink: "#131A20",
  navy: "#0E5C63",
  slate: "#31575C",
  mist: "#D7EEF0",
  sky: "#7EE2D9",
  aqua: "#1AB6A6",
  mint: "#E7F6D3",
  success: "#15875E",
  warn: "#F0B23D",
  danger: "#D75669",
  paper: "#F7FBFB",
  white: "#FFFFFF",
  gradientTop: "#11444A",
  gradientMid: "#1AB6A6",
  gradientBottom: "#F7FBFB",
  glowTop: "rgba(126, 226, 217, 0.24)",
  glowBottom: "rgba(231, 246, 211, 0.18)",
};

const uniTheme: VariantTheme = {
  ink: "#08111F",
  navy: "#0B1F33",
  slate: "#20364A",
  mist: "#D9E6F2",
  sky: "#7AD7F0",
  aqua: "#35B7D7",
  mint: "#D7F5E9",
  success: "#0F9D74",
  warn: "#F2B851",
  danger: "#D9485F",
  paper: "#F6F8FB",
  white: "#FFFFFF",
  gradientTop: "#0B1F33",
  gradientMid: "#102A43",
  gradientBottom: "#F6F8FB",
  glowTop: "rgba(122, 215, 240, 0.22)",
  glowBottom: "rgba(53, 183, 215, 0.18)",
};

export const variantConfigs: Record<AppVariant, VariantConfig> = {
  children: {
    id: "children",
    appName: "Quiks Children",
    slug: "quiks-children",
    scheme: "quiks-children",
    androidPackage: "com.quiks.mobile",
    audienceLabel: "Ages 5 to 12",
    heroTitle: "Quiks Children",
    heroSubtitle: "A bright learning app for younger learners with guided practice, profile-based progress, and friendly study support.",
    profileNoun: "student",
    profileEditorSubtitle: "Create a child-friendly student profile so practice, progress, and encouragement stay personal.",
    defaultTargetExam: "Primary school prep",
    targetExamPlaceholder: "Primary school prep, common entrance...",
    defaultDailyGoalMinutes: 20,
    aiGuidance: "Use a warm, clear, child-friendly teaching style. Keep questions concrete, age-appropriate, and encouraging.",
    defaultMode: "quiz",
    defaultDifficulty: "Beginner",
    trainingLabel: "Training",
    trainingHint: "Slower pace with explanations",
    quizLabel: "Quiz",
    quizHint: "Timed challenge for performance",
    studyAssistantTitle: "AI coach for this subject",
    curriculumSingular: "subject",
    curriculumPlural: "Subjects",
    allowedGrades: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"],
    allowedSubjectIds: ["arithmetic", "english", "mental-mathematics", "computer", "global-perspectives", "history", "home-economics", "geography", "integrated-science", "civic-education", "phe", "brainteaser"],
    theme: childrenTheme,
  },
  teens: {
    id: "teens",
    appName: "Quiks Teens",
    slug: "quiks-teens",
    scheme: "quiks-teens",
    androidPackage: "com.quiks.teens",
    audienceLabel: "Ages 11 to 20",
    heroTitle: "Quiks Teens",
    heroSubtitle: "Exam-ready practice for secondary and college students with deeper drills, focused revision, and stronger performance tracking.",
    profileNoun: "learner",
    profileEditorSubtitle: "Create a secondary-school learner profile with exam goals, stronger revision habits, and steady performance tracking.",
    defaultTargetExam: "WAEC / NECO prep",
    targetExamPlaceholder: "WAEC, NECO, JAMB foundation, school exams...",
    defaultDailyGoalMinutes: 35,
    aiGuidance: "Use a sharper, exam-ready academic tone for teenagers. Push reasoning, interpretation, and multi-step problem solving without sounding childish.",
    defaultMode: "quiz",
    defaultDifficulty: "Intermediate",
    trainingLabel: "Revision",
    trainingHint: "Guided review with explanations",
    quizLabel: "Test",
    quizHint: "Timed challenge for exam readiness",
    studyAssistantTitle: "AI study coach for this subject",
    curriculumSingular: "subject",
    curriculumPlural: "Subjects",
    allowedGrades: ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "High School"],
    allowedSubjectIds: ["arithmetic", "english", "computer", "global-perspectives", "history", "economics", "geography", "government", "civic-education", "biology", "physics", "chemistry", "further-mathematics", "commerce", "arts", "music", "agricultural-science", "literature-in-english", "phe", "brainteaser"],
    subjectNameOverrides: {
      arithmetic: "Mathematics",
    },
    theme: teensTheme,
  },
  uni: {
    id: "uni",
    appName: "Quiks Uni",
    slug: "quiks-uni",
    scheme: "quiks-uni",
    androidPackage: "com.quiks.uni",
    audienceLabel: "Tertiary and University",
    heroTitle: "Quiks Uni",
    heroSubtitle: "Advanced study support for tertiary students with focused practice, AI-backed question generation, and stronger academic workflows.",
    profileNoun: "student",
    profileEditorSubtitle: "Create a university learner profile for deeper independent study, course-focused practice, and stronger academic planning.",
    defaultTargetExam: "University coursework and exams",
    targetExamPlaceholder: "Course exams, professional exams, semester tests...",
    defaultDailyGoalMinutes: 45,
    aiGuidance: "Use a mature, concise academic tone suitable for tertiary learners. Favor analysis, application, and conceptual depth.",
    defaultMode: "training",
    defaultDifficulty: "Intermediate",
    trainingLabel: "Study Session",
    trainingHint: "Concept-led practice with explanations",
    quizLabel: "Assessment",
    quizHint: "Timed check for academic mastery",
    studyAssistantTitle: "AI study assistant for this course",
    curriculumSingular: "course",
    curriculumPlural: "Courses",
    allowedGrades: ["University"],
    allowedSubjectIds: ["arithmetic", "english", "computer", "history", "economics", "geography", "government", "civic-education", "biology", "physics", "chemistry", "statistics", "accounting", "sociology", "psychology", "philosophy", "communication-studies", "law", "engineering", "medicine", "management-studies"],
    subjectNameOverrides: {
      arithmetic: "Mathematics",
    },
    theme: uniTheme,
  },
};

function normalizeVariant(value: string | undefined): AppVariant {
  if (value === "teens" || value === "uni") {
    return value;
  }

  return "children";
}

function readKnownVariant(value: string | null | undefined): AppVariant | undefined {
  return value === "children" || value === "teens" || value === "uni" ? value : undefined;
}

function readVariantFromWebLocation(): AppVariant | undefined {
  if (typeof globalThis === "undefined" || !("location" in globalThis) || !globalThis.location) {
    return undefined;
  }

  const location = globalThis.location;
  const queryVariant = readKnownVariant(new URLSearchParams(location.search).get("variant"));
  if (queryVariant) {
    return queryVariant;
  }

  const hostname = location.hostname.toLowerCase();
  const hostFirstSegment = hostname.split(".")[0];
  if (hostFirstSegment === "children" || hostFirstSegment === "teens" || hostFirstSegment === "uni") {
    return hostFirstSegment;
  }

  const declaredVariant =
    typeof document !== "undefined"
      ? readKnownVariant(document.querySelector('meta[name="quiks-variant"]')?.getAttribute("content"))
      : undefined;
  if (declaredVariant) {
    return declaredVariant;
  }

  const pathFirstSegment = location.pathname.split("/").filter(Boolean)[0];
  if (pathFirstSegment === "children" || pathFirstSegment === "teens" || pathFirstSegment === "uni") {
    return pathFirstSegment;
  }

  return undefined;
}

export function getConfiguredVariant(): AppVariant {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
  const webVariant = readVariantFromWebLocation();
  return normalizeVariant(webVariant ?? process.env.EXPO_PUBLIC_APP_VARIANT ?? extra.EXPO_PUBLIC_APP_VARIANT ?? extra.APP_VARIANT);
}

export const activeVariant = getConfiguredVariant();
export const appVariant = variantConfigs[activeVariant];
