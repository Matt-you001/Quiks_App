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
  {
    id: "history",
    name: "History",
    tagline: "People, timelines, and turning points",
    icon: "bank-outline",
    accent: ["#A65E2E", "#E6A15C"],
    description: "Study key events, leaders, empires, and lessons from the past.",
    aiPromptHint: "Use clear timelines, important figures, and cause-and-effect thinking.",
  },
  {
    id: "economics",
    name: "Economics",
    tagline: "Choices, markets, and money",
    icon: "chart-line",
    accent: ["#1E9B7A", "#7BD8AE"],
    description: "Learn needs and wants, trade, saving, prices, and production.",
    aiPromptHint: "Connect economic ideas to everyday family, school, and market decisions.",
  },
  {
    id: "geography",
    name: "Geography",
    tagline: "Maps, places, and environments",
    icon: "earth",
    accent: ["#2D8AC7", "#78D1F2"],
    description: "Explore landforms, weather, resources, regions, and human settlement.",
    aiPromptHint: "Use map skills, location clues, and real-world environmental examples.",
  },
  {
    id: "government",
    name: "Government",
    tagline: "Leadership, institutions, and public life",
    icon: "account-group-outline",
    accent: ["#4C63D2", "#8EA2FF"],
    description: "Understand branches of government, constitutions, elections, and civic order.",
    aiPromptHint: "Explain government structures, rights, responsibilities, and public institutions.",
  },
  {
    id: "civic-education",
    name: "Civic Education",
    tagline: "Citizenship, values, and community",
    icon: "hand-heart-outline",
    accent: ["#D96C57", "#F6AF8D"],
    description: "Build character, social responsibility, national values, and peaceful living.",
    aiPromptHint: "Focus on citizenship, values, community service, and responsible behavior.",
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
