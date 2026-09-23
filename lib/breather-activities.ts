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
    puzzle: [0, 2, 0, 4, 5, 0, 4, 0, 6, 0, 0, 3, 2, 3, 0, 0, 0, 1, 5, 6, 0, 0, 3, 0, 3, 0, 0, 6, 0, 2, 0, 1, 2, 0, 4, 0],
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

function sudokuBlockDimensions(size: 4 | 6 | 9) {
  return size === 6 ? { width: 3, height: 2 } : size === 4 ? { width: 2, height: 2 } : { width: 3, height: 3 };
}

function containsEverySudokuValue(values: number[], size: number) {
  return values.length === size && new Set(values).size === size && values.every((value) => Number.isInteger(value) && value >= 1 && value <= size);
}

function isCompleteSudokuValid(size: 4 | 6 | 9, values: number[]) {
  if (values.length !== size * size) return false;
  for (let row = 0; row < size; row += 1) {
    if (!containsEverySudokuValue(values.slice(row * size, (row + 1) * size), size)) return false;
  }
  for (let column = 0; column < size; column += 1) {
    if (!containsEverySudokuValue(Array.from({ length: size }, (_, row) => values[row * size + column]), size)) return false;
  }
  const block = sudokuBlockDimensions(size);
  for (let startRow = 0; startRow < size; startRow += block.height) {
    for (let startColumn = 0; startColumn < size; startColumn += block.width) {
      const blockValues: number[] = [];
      for (let row = startRow; row < startRow + block.height; row += 1) {
        for (let column = startColumn; column < startColumn + block.width; column += 1) blockValues.push(values[row * size + column]);
      }
      if (!containsEverySudokuValue(blockValues, size)) return false;
    }
  }
  return true;
}

function countSudokuSolutions(size: 4 | 6 | 9, puzzle: number[], limit = 2) {
  const values = [...puzzle];
  const block = sudokuBlockDimensions(size);
  let solutions = 0;
  const canPlace = (index: number, value: number) => {
    const row = Math.floor(index / size);
    const column = index % size;
    for (let offset = 0; offset < size; offset += 1) {
      if (values[row * size + offset] === value || values[offset * size + column] === value) return false;
    }
    const blockRow = Math.floor(row / block.height) * block.height;
    const blockColumn = Math.floor(column / block.width) * block.width;
    for (let nextRow = blockRow; nextRow < blockRow + block.height; nextRow += 1) {
      for (let nextColumn = blockColumn; nextColumn < blockColumn + block.width; nextColumn += 1) {
        if (values[nextRow * size + nextColumn] === value) return false;
      }
    }
    return true;
  };
  const solve = () => {
    if (solutions >= limit) return;
    const emptyIndex = values.indexOf(0);
    if (emptyIndex < 0) { solutions += 1; return; }
    for (let value = 1; value <= size; value += 1) {
      if (!canPlace(emptyIndex, value)) continue;
      values[emptyIndex] = value;
      solve();
      values[emptyIndex] = 0;
    }
  };
  solve();
  return solutions;
}

export function validateBreatherActivity(activity: BreatherActivity) {
  if (activity.kind === "read") return true;
  if (activity.kind === "sudoku") {
    if (activity.puzzle.length !== activity.size * activity.size || activity.solution.length !== activity.size * activity.size) return false;
    if (!activity.puzzle.every((value) => Number.isInteger(value) && value >= 0 && value <= activity.size)) return false;
    if (!isCompleteSudokuValid(activity.size, activity.solution)) return false;
    if (!activity.puzzle.every((value, index) => value === 0 || value === activity.solution[index])) return false;
    return countSudokuSolutions(activity.size, activity.puzzle) === 1;
  }
  if (activity.kind === "memory") return activity.symbols.length >= 2 && new Set(activity.symbols).size === activity.symbols.length;
  if (activity.kind === "word") {
    const normalizeLetters = (value: string) => [...value.toUpperCase()].sort().join("");
    return Boolean(activity.answer && activity.hint && activity.scrambled !== activity.answer && normalizeLetters(activity.scrambled) === normalizeLetters(activity.answer));
  }
  if (activity.kind === "pattern") return Boolean(activity.sequence && activity.choices.length >= 2 && new Set(activity.choices).size === activity.choices.length && activity.choices.filter((choice) => choice === activity.answer).length === 1);
  if (activity.kind === "breathe") return Number.isInteger(activity.durationSeconds) && activity.durationSeconds >= 10 && activity.durationSeconds <= 300;
  return activity.steps.length >= 1 && activity.steps.every((step) => Boolean(step.trim()));
}

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
    const activity: BreatherActivity = { kind, size, ...sudokuBoards[size] };
    return validateBreatherActivity(activity) ? activity : { kind: "read" };
  }

  if (kind === "memory") {
    const symbolCount = appVariant.id === "children" ? 4 : 6;
    const activity: BreatherActivity = { kind, symbols: ["★", "●", "▲", "◆", "☀", "♫"].slice(0, symbolCount) };
    return validateBreatherActivity(activity) ? activity : { kind: "read" };
  }

  if (kind === "word") {
    const words = wordsByVariant[appVariant.id];
    const word = words[seed % words.length];
    const activity: BreatherActivity = { kind, answer: word.answer, hint: word.hint, scrambled: rotateWord(word.answer, seed) };
    return validateBreatherActivity(activity) ? activity : { kind: "read" };
  }

  if (kind === "pattern") {
    const patterns = patternsByVariant[appVariant.id];
    const activity: BreatherActivity = { kind, ...patterns[seed % patterns.length] };
    return validateBreatherActivity(activity) ? activity : { kind: "read" };
  }

  if (kind === "breathe") {
    const activity: BreatherActivity = { kind, durationSeconds: 60 };
    return validateBreatherActivity(activity) ? activity : { kind: "read" };
  }

  if (kind === "move") {
    const activity: BreatherActivity = {
      kind,
      steps: [
        "Stand up and gently roll your shoulders five times.",
        "Stretch both arms upward and take two slow breaths.",
        "Look at something far away for twenty seconds, then relax your eyes.",
      ],
    };
    return validateBreatherActivity(activity) ? activity : { kind: "read" };
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
