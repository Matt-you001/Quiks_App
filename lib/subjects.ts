import type { Difficulty, Subject } from "../types/app";

export const grades = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "High School",
  "University",
];

export const difficulties: Difficulty[] = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Expert",
];

export const subjects: Subject[] = [
  {
    id: "arithmetic",
    name: "Arithmetic",
    tagline: "Speed, accuracy, and number sense",
    icon: "calculator-variant-outline",
    accent: ["#35B7D7", "#7AD7F0"],
    description: "Practice operations, fractions, percentages, and mental math.",
    aiPromptHint: "Focus on arithmetic fluency and step-by-step explanations.",
  },
  {
    id: "english",
    name: "English",
    tagline: "Vocabulary, grammar, and reading",
    icon: "book-open-page-variant-outline",
    accent: ["#1F8A70", "#5DD39E"],
    description: "Grow comprehension, sentence structure, and word power.",
    aiPromptHint: "Focus on grammar, reading comprehension, and vocabulary usage.",
  },
  {
    id: "physics",
    name: "Physics",
    tagline: "Forces, energy, and motion",
    icon: "atom-variant",
    accent: ["#7755DD", "#A38BFF"],
    description: "Explore the laws that shape movement, light, and matter.",
    aiPromptHint: "Include real-life physical situations and conceptual reasoning.",
  },
  {
    id: "chemistry",
    name: "Chemistry",
    tagline: "Elements, reactions, and formulas",
    icon: "flask-outline",
    accent: ["#E56B6F", "#FFB4A2"],
    description: "Learn atoms, compounds, mixtures, and chemical change.",
    aiPromptHint: "Use chemistry terms carefully and avoid unsafe experiment prompts.",
  },
  {
    id: "biology",
    name: "Biology",
    tagline: "Life systems and living things",
    icon: "leaf-circle-outline",
    accent: ["#2A9D8F", "#8FD694"],
    description: "Study organisms, cells, ecosystems, and body systems.",
    aiPromptHint: "Explain biological ideas with age-appropriate examples.",
  },
  {
    id: "computer",
    name: "Computer",
    tagline: "Digital literacy and logic",
    icon: "laptop",
    accent: ["#2D6CDF", "#6FA8FF"],
    description: "Build confidence in computing concepts, devices, and algorithms.",
    aiPromptHint: "Blend computer basics with problem-solving scenarios.",
  },
];

export const QUESTIONS_PER_LEVEL = 10;
export const SCORE_THRESHOLD = 70;
export const BASE_QUIZ_TIME_SECONDS = 120;
export const TIME_INCREMENT_PER_LEVEL = 5;

export function getSubjectById(id?: string | string[]) {
  if (!id || Array.isArray(id)) {
    return undefined;
  }

  return subjects.find((subject) => subject.id === id);
}
