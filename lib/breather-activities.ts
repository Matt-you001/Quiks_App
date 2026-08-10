import { appVariant } from "./app-variant";

export type BreatherActivity =
  | { kind: "read" }
  | { kind: "sudoku"; size: 4 | 6 | 9; puzzle: number[]; solution: number[] }
  | { kind: "memory"; symbols: string[] }
  | { kind: "word"; scrambled: string; answer: string; hint: string }
  | { kind: "pattern"; sequence: string; choices: readonly string[]; answer: string }
  | { kind: "breathe"; durationSeconds: number }
  | { kind: "move"; steps: string[] };

const sudokuBoards: Record<4 | 6 | 9, { puzzle: number[]; solution: number[] }> = {
  4: {
    puzzle: [1, 0, 3, 0, 0, 4, 0, 2, 2, 0, 4, 0, 0, 3, 0, 1],
    solution: [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1],
  },
  6: {
    puzzle: [1, 0, 3, 0, 5, 0, 0, 5, 0, 1, 0, 3, 2, 0, 4, 0, 6, 0, 0, 6, 0, 2, 0, 4, 3, 0, 5, 0, 1, 0, 0, 1, 0, 3, 0, 5],
    solution: [1, 2, 3, 4, 5, 6, 4, 5, 6, 1, 2, 3, 2, 3, 4, 5, 6, 1, 5, 6, 1, 2, 3, 4, 3, 4, 5, 6, 1, 2, 6, 1, 2, 3, 4, 5],
  },
  9: {
    puzzle: [5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6, 0, 8, 0, 0, 0, 6, 0, 0, 0, 3, 4, 0, 0, 8, 0, 3, 0, 0, 1, 7, 0, 0, 0, 2, 0, 0, 0, 6, 0, 6, 0, 0, 0, 0, 2, 8, 0, 0, 0, 0, 4, 1, 9, 0, 0, 5, 0, 0, 0, 0, 8, 0, 0, 7, 9],
    solution: [5, 3, 4, 6, 7, 8, 9, 1, 2, 6, 7, 2, 1, 9, 5, 3, 4, 8, 1, 9, 8, 3, 4, 2, 5, 6, 7, 8, 5, 9, 7, 6, 1, 4, 2, 3, 4, 2, 6, 8, 5, 3, 7, 9, 1, 7, 1, 3, 9, 2, 4, 8, 5, 6, 9, 6, 1, 5, 3, 7, 2, 8, 4, 2, 8, 7, 4, 1, 9, 6, 3, 5, 3, 4, 5, 2, 8, 6, 1, 7, 9],
  },
};

const wordsByVariant = {
  children: [
    { answer: "PLANET", hint: "A world that travels around a star." },
    { answer: "PUZZLE", hint: "A problem designed to test your thinking." },
  ],
  teens: [
    { answer: "ENERGY", hint: "The capacity to do work." },
    { answer: "LOGICAL", hint: "Based on clear and sound reasoning." },
  ],
  uni: [
    { answer: "ANALYSIS", hint: "A detailed examination of information." },
    { answer: "CONCEPT", hint: "An abstract idea or general notion." },
  ],
} as const;

const patternsByVariant = {
  children: [
    { sequence: "2, 4, 6, 8, ?", choices: ["9", "10", "12"], answer: "10" },
    { sequence: "1, 2, 4, 8, ?", choices: ["10", "12", "16"], answer: "16" },
  ],
  teens: [
    { sequence: "3, 6, 12, 24, ?", choices: ["30", "36", "48"], answer: "48" },
    { sequence: "2, 5, 10, 17, ?", choices: ["24", "26", "28"], answer: "26" },
  ],
  uni: [
    { sequence: "1, 4, 9, 16, 25, ?", choices: ["30", "36", "49"], answer: "36" },
    { sequence: "2, 3, 5, 8, 12, ?", choices: ["15", "17", "20"], answer: "17" },
  ],
} as const;

function rotateWord(value: string, seed: number) {
  const offset = (Math.abs(seed) % Math.max(value.length - 1, 1)) + 1;
  return `${value.slice(offset)}${value.slice(0, offset)}`;
}

export function getBreatherActivity(level: number, successfulSessionCount: number): BreatherActivity {
  const seed = Math.max(level + Math.floor(successfulSessionCount / 3), 0);
  const activityKinds = ["read", "sudoku", "memory", "word", "pattern", "breathe", "move"] as const;
  const kind = activityKinds[seed % activityKinds.length];

  if (kind === "sudoku") {
    const size = appVariant.id === "children" ? 4 : appVariant.id === "teens" ? 6 : 9;
    return { kind, size, ...sudokuBoards[size] };
  }

  if (kind === "memory") {
    const symbolCount = appVariant.id === "children" ? 4 : 6;
    return { kind, symbols: ["★", "●", "▲", "◆", "☀", "♫"].slice(0, symbolCount) };
  }

  if (kind === "word") {
    const words = wordsByVariant[appVariant.id];
    const word = words[seed % words.length];
    return { kind, answer: word.answer, hint: word.hint, scrambled: rotateWord(word.answer, seed) };
  }

  if (kind === "pattern") {
    const patterns = patternsByVariant[appVariant.id];
    return { kind, ...patterns[seed % patterns.length] };
  }

  if (kind === "breathe") {
    return { kind, durationSeconds: 60 };
  }

  if (kind === "move") {
    return {
      kind,
      steps: [
        "Stand up and gently roll your shoulders five times.",
        "Stretch both arms upward and take two slow breaths.",
        "Look at something far away for twenty seconds, then relax your eyes.",
      ],
    };
  }

  return { kind: "read" };
}

export function createMemoryDeck(symbols: string[], seed: number) {
  const deck = [...symbols, ...symbols].map((symbol, index) => ({ id: `${symbol}-${index}`, symbol }));
  let state = Math.max(seed, 1);

  for (let index = deck.length - 1; index > 0; index -= 1) {
    state = (state * 9301 + 49297) % 233280;
    const swapIndex = state % (index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }

  return deck;
}
