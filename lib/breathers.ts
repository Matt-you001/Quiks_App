import { SCORE_THRESHOLD } from "./subjects";
import type { BreatherContent, SessionResult } from "../types/app";

const BREATHER_INTERVAL = 3;

const subjectBreathers: Record<string, BreatherContent[]> = {
  arithmetic: [
    {
      id: "arith-archimedes",
      title: "Number Break: Archimedes and Problem Solving",
      intro: "You have earned a breather. Here is a quick story from the world of mathematics.",
      story:
        "Archimedes of Syracuse loved solving problems so much that he looked for patterns in everyday life. One famous story says he noticed how water rose in a bath and used that observation to solve a difficult puzzle for a king. The lesson is that mathematics is not only about numbers on paper. It is also about paying attention, spotting patterns, and thinking carefully about the world around you.",
      reflection: "As you continue, try to look for the pattern hiding inside each problem before you rush to calculate.",
      facts: [
        "Many math discoveries began with simple observations.",
        "Strong mathematicians often slow down first, then solve faster.",
      ],
      continueLabel: "Continue to the next challenge",
    },
  ],
  english: [
    {
      id: "eng-achebe",
      title: "Language Break: The Power of Story",
      intro: "A short breather can still teach something memorable.",
      story:
        "Writers such as Chinua Achebe showed how language can preserve culture, values, and identity. Through storytelling, readers learn new words, understand different people, and see how ideas are connected. Every strong reader becomes a stronger thinker because language helps us explain the world more clearly.",
      reflection: "On your next question, pay attention to how one word can change the meaning of an entire sentence.",
      facts: [
        "Reading grows vocabulary and comprehension at the same time.",
        "Good writers choose words carefully to guide the reader.",
      ],
      continueLabel: "Continue reading and learning",
    },
  ],
  physics: [
    {
      id: "phy-flight",
      title: "Discovery Break: From Curiosity to Flight",
      intro: "Here is a quick science breather before the next level.",
      story:
        "Early inventors and scientists studied birds, wind, and balance long before airplanes became common. They learned that lift, drag, and motion are not magic. They are patterns that can be tested and improved. Physics helps people explain why things move, stop, float, or fall, and those explanations make invention possible.",
      reflection: "As you continue, try asking not only what happens, but why it happens.",
      facts: [
        "Physics turns observation into explanation.",
        "Many inventions began with simple questions about motion and force.",
      ],
      continueLabel: "Continue exploring physics",
    },
  ],
  chemistry: [
    {
      id: "chem-mendeleev",
      title: "Lab Break: Finding Order in Matter",
      intro: "A quick pause can help your mind connect ideas.",
      story:
        "Dmitri Mendeleev is remembered for organizing the periodic table in a way that revealed patterns among elements. He noticed that when elements were arranged carefully, their properties followed a rhythm. Chemistry becomes easier when you stop seeing facts as isolated pieces and start seeing them as connected patterns in matter and change.",
      reflection: "When the next question appears, ask yourself which pattern or property is most important.",
      facts: [
        "Chemistry often rewards careful grouping and comparison.",
        "Patterns help scientists predict behavior before they test it.",
      ],
      continueLabel: "Continue with chemistry",
    },
  ],
  biology: [
    {
      id: "bio-wangari",
      title: "Nature Break: Learning from Living Systems",
      intro: "This breather is here to refresh you and keep learning alive.",
      story:
        "Environmental leaders such as Wangari Maathai showed that caring for living things also means caring for communities. Biology teaches that plants, animals, people, and ecosystems depend on one another. When learners understand those relationships, science becomes more than memorizing parts. It becomes a way of protecting life and making wise choices.",
      reflection: "In the next set of questions, look for relationships between parts of a system, not just isolated facts.",
      facts: [
        "Biology explains how living things survive, adapt, and connect.",
        "Healthy ecosystems support healthy communities.",
      ],
      continueLabel: "Continue with biology",
    },
  ],
  computer: [
    {
      id: "comp-lovelace",
      title: "Tech Break: Thinking Before Coding",
      intro: "A strong learner knows when to pause and reset.",
      story:
        "Ada Lovelace is often remembered for seeing that machines could follow instructions in powerful ways. Long before modern apps, she understood that clear steps and logic matter. Computer studies are not only about screens and devices. They train the mind to break a big task into smaller, logical parts that can be solved one by one.",
      reflection: "As you continue, think of each question as a small system with clues you can organize.",
      facts: [
        "Computing grows logical thinking as well as digital skill.",
        "Clear steps often solve complex problems better than guessing.",
      ],
      continueLabel: "Continue with computing",
    },
  ],
  history: [
    {
      id: "hist-benin",
      title: "History Spotlight: The Benin Kingdom",
      intro: "A reward break can still deepen your understanding.",
      story:
        "The Benin Kingdom became known for strong leadership, organized administration, and remarkable bronze artworks. Its history reminds learners that African societies built systems of trade, culture, and governance long before colonial rule. Studying history helps us challenge shallow stories and understand how people shaped their own worlds with creativity and structure.",
      reflection: "In the next history questions, watch for cause, consequence, and the role of leadership.",
      facts: [
        "History is easier to remember when events are linked to causes and outcomes.",
        "African history includes powerful kingdoms, innovations, and trade networks.",
      ],
      continueLabel: "Continue with history",
    },
  ],
  economics: [
    {
      id: "econ-market",
      title: "Economics Break: The Story Behind a Market Day",
      intro: "Here is a calm but useful pause before the next round.",
      story:
        "A busy market may look simple, but it is full of economic decisions. Sellers think about cost, profit, and demand. Buyers compare needs, wants, and prices. Transport, weather, and supply all affect what people can buy and sell. Economics becomes easier when you connect ideas like scarcity and choice to everyday life around you.",
      reflection: "As you return to your exercise, ask which choice gives the best value or solves the biggest need.",
      facts: [
        "Economics is about decisions people make with limited resources.",
        "Prices often change when supply or demand changes.",
      ],
      continueLabel: "Continue with economics",
    },
  ],
  geography: [
    {
      id: "geo-nile",
      title: "Geography Break: Why Rivers Shape Civilizations",
      intro: "A short breather can help the next set feel lighter.",
      story:
        "Many early civilizations grew near rivers because rivers provide water, fertile soil, transport routes, and trade opportunities. Geography is powerful because it helps explain why people settle where they do and how land, climate, and resources influence human life. Maps and environments tell stories about both nature and society.",
      reflection: "In your next questions, think about how place affects people’s choices and activities.",
      facts: [
        "Geography connects physical features to human activity.",
        "Maps help us compare location, distance, and direction clearly.",
      ],
      continueLabel: "Continue with geography",
    },
  ],
  government: [
    {
      id: "gov-constitution",
      title: "Government Break: Why Rules and Institutions Matter",
      intro: "This is your reward pause before the next stretch.",
      story:
        "A society runs more fairly when power is organized and responsibilities are clear. Constitutions, courts, legislatures, and elections exist so that decisions do not depend on one person alone. Government studies help learners understand how authority should be limited, how leaders are chosen, and how public institutions protect order and rights.",
      reflection: "As you continue, ask what role each institution plays and why balance of power matters.",
      facts: [
        "Good government depends on structure as well as leadership.",
        "Civic knowledge helps citizens evaluate public decisions wisely.",
      ],
      continueLabel: "Continue with government",
    },
  ],
  "civic-education": [
    {
      id: "civic-community",
      title: "Civic Break: Small Actions Build Strong Communities",
      intro: "You have earned a gentler learning moment.",
      story:
        "Civic education teaches that communities grow stronger when people practice honesty, respect, responsibility, and service. Many big social changes begin with small actions such as keeping promises, helping others, and protecting shared spaces. A good citizen is not only someone who knows the rules, but someone who chooses to do what supports peace and fairness.",
      reflection: "As you move on, think about how values influence actions in real life, not only in textbooks.",
      facts: [
        "Citizenship includes both rights and responsibilities.",
        "Character and community values shape national development.",
      ],
      continueLabel: "Continue with civic education",
    },
  ],
};

const generalBreathers: BreatherContent[] = [
  {
    id: "general-reset",
    title: "Mind Reset: Pause, Notice, Continue",
    intro: "You have been doing well, and a short reset can protect your focus.",
    story:
      "Strong learners do not only work hard. They also know how to pause, reflect, and return with fresh attention. A brief educational break can reduce tension, improve memory, and make the next round feel more manageable. The goal is not to stop learning. It is to make learning sustainable.",
    reflection: "Take one deep breath and enter the next level with calm focus instead of pressure.",
    facts: [
      "Short breaks can improve concentration.",
      "Reflection helps new ideas stay in memory longer.",
    ],
    continueLabel: "Continue your learning streak",
  },
];

export function getSubjectPassStreak(results: SessionResult[], subjectId: string) {
  const subjectResults = results.filter((result) => result.subjectId === subjectId);
  let streak = 0;

  for (const result of subjectResults) {
    if (result.score >= SCORE_THRESHOLD) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

export function shouldOfferBreather(results: SessionResult[], currentResult: SessionResult) {
  if (currentResult.score < SCORE_THRESHOLD) {
    return false;
  }

  const streak = getSubjectPassStreak(results, currentResult.subjectId);
  return streak >= BREATHER_INTERVAL && streak % BREATHER_INTERVAL === 0;
}

export function getBreatherContent(subjectId: string, level: number, streak: number) {
  const candidates = subjectBreathers[subjectId] ?? generalBreathers;
  const indexSeed = Math.max(level + streak - 1, 0);
  return candidates[indexSeed % candidates.length] ?? generalBreathers[0];
}

