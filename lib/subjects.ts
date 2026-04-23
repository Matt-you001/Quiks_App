import type { Difficulty, Subject, SubjectTopic } from "../types/app";

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

const arithmeticTopics: SubjectTopic[] = [
  { id: "addition-subtraction", label: "Addition and Subtraction", description: "Practice basic operations, number bonds, and mental sums.", keywords: ["addition", "subtraction", "sum", "difference", "add", "subtract", "plus", "minus"] },
  { id: "multiplication-division", label: "Multiplication and Division", description: "Build fluency with times tables, sharing, and grouping.", keywords: ["multiplication", "division", "multiply", "divide", "times", "product", "quotient", "shared equally"] },
  { id: "fractions-decimals-percentages", label: "Fractions, Decimals and Percentages", description: "Learn parts of a whole, place value, and percent ideas.", keywords: ["fraction", "fractions", "decimal", "decimals", "percentage", "percent", "half", "quarter", "tenths"] },
  { id: "measurement-money-time", label: "Measurement, Money and Time", description: "Work on units, clocks, calendars, and money problems.", keywords: ["measurement", "length", "weight", "money", "coin", "naira", "time", "clock", "calendar", "perimeter"] },
  { id: "patterns-sequences", label: "Patterns and Sequence", description: "Find number rules, missing terms, and simple algebraic thinking.", keywords: ["pattern", "patterns", "sequence", "sequence", "next number", "comes before", "comes after", "odd", "even"] },
];

const englishTopics: SubjectTopic[] = [
  { id: "grammar", label: "Grammar", description: "Focus on parts of speech, tense, agreement, and correct usage.", keywords: ["grammar", "tense", "verb", "noun", "pronoun", "adjective", "adverb", "plural", "subject verb agreement"] },
  { id: "vocabulary", label: "Vocabulary", description: "Grow word meaning, synonyms, antonyms, and spelling.", keywords: ["vocabulary", "word meaning", "synonym", "antonym", "spelling", "opposite", "means the same", "choose the correct spelling"] },
  { id: "reading-comprehension", label: "Reading Comprehension", description: "Understand passages, main ideas, and supporting details.", keywords: ["reading comprehension", "passage", "main idea", "detail", "author", "comprehension", "reading"] },
  { id: "writing-sentence-structure", label: "Writing and Sentence Structure", description: "Practice punctuation, capitalization, and sentence building.", keywords: ["sentence", "punctuation", "capital letter", "full stop", "question mark", "writing", "complete the sentence"] },
  { id: "figures-of-speech-literature", label: "Figures of Speech and Literature", description: "Meet imagery, rhyme, figurative meaning, and simple literary devices.", keywords: ["figure of speech", "simile", "metaphor", "personification", "poem", "rhyme", "literature"] },
];

const physicsTopics: SubjectTopic[] = [
  { id: "motion-forces", label: "Motion and Forces", description: "Study movement, pushes, pulls, speed, and gravity.", keywords: ["motion", "force", "gravity", "speed", "friction", "push", "pull", "move"] },
  { id: "energy-work-power", label: "Energy, Work and Power", description: "Understand forms of energy and how work is done.", keywords: ["energy", "work", "power", "heat", "chemical energy", "solar", "source of energy"] },
  { id: "light-sound", label: "Light and Sound", description: "Explore shadows, reflection, vision, and sound.", keywords: ["light", "shadow", "sound", "hear", "reflection", "lens", "see"] },
  { id: "electricity-magnetism", label: "Electricity and Magnetism", description: "Learn circuits, conductors, magnets, and electric safety.", keywords: ["electricity", "electric", "current", "circuit", "battery", "magnet", "conductor"] },
  { id: "matter-heat", label: "Matter and Heat", description: "Look at states of matter, temperature, and thermal change.", keywords: ["matter", "solid", "liquid", "gas", "temperature", "heat", "melting", "boiling"] },
];

const chemistryTopics: SubjectTopic[] = [
  { id: "matter-materials", label: "Matter and Materials", description: "Identify solids, liquids, gases, and common materials.", keywords: ["matter", "material", "solid", "liquid", "gas", "property", "states of matter"] },
  { id: "atoms-elements-compounds", label: "Atoms, Elements and Compounds", description: "Build foundation knowledge of substances and particles.", keywords: ["atom", "atoms", "element", "compound", "molecule", "periodic table", "symbol"] },
  { id: "mixtures-separation", label: "Mixtures and Separation", description: "Separate substances using simple techniques.", keywords: ["mixture", "solution", "separate", "filtration", "evaporation", "sieving", "distillation"] },
  { id: "acids-bases-salts", label: "Acids, Bases and Salts", description: "Recognize basic chemical groups and indicators.", keywords: ["acid", "base", "alkali", "salt", "indicator", "litmus", "neutralization"] },
  { id: "chemical-reactions", label: "Chemical Reactions", description: "Understand change, products, reactants, and evidence of reaction.", keywords: ["reaction", "reactant", "product", "rusting", "burning", "chemical change"] },
];

const biologyTopics: SubjectTopic[] = [
  { id: "living-things-classification", label: "Living Things and Classification", description: "Group organisms and learn their characteristics.", keywords: ["living things", "classification", "organism", "vertebrate", "invertebrate", "mammal", "animal"] },
  { id: "cells-body-systems", label: "Cells and Body Systems", description: "Explore cells, organs, and how systems work together.", keywords: ["cell", "cells", "organ", "system", "body system", "respiratory", "circulatory", "digestive"] },
  { id: "plants", label: "Plants", description: "Study plant parts, photosynthesis, and growth.", keywords: ["plant", "plants", "root", "stem", "leaf", "flower", "photosynthesis", "germination"] },
  { id: "human-health", label: "Human Health", description: "Learn nutrition, hygiene, disease prevention, and healthy living.", keywords: ["health", "nutrition", "hygiene", "disease", "balanced diet", "vitamin", "sanitation"] },
  { id: "ecosystems-heredity", label: "Ecosystems and Heredity", description: "Understand habitats, food chains, and inherited traits.", keywords: ["ecosystem", "habitat", "food chain", "environment", "inheritance", "trait", "heredity"] },
];

const computerTopics: SubjectTopic[] = [
  { id: "computer-parts", label: "Computer Parts", description: "Recognize hardware and what each part does.", keywords: ["hardware", "keyboard", "monitor", "mouse", "cpu", "printer", "computer parts"] },
  { id: "software-operating-systems", label: "Software and Operating Systems", description: "Understand programs, apps, and system basics.", keywords: ["software", "operating system", "application", "program", "file", "folder"] },
  { id: "internet-digital-safety", label: "Internet and Digital Safety", description: "Practice responsible online behavior and safe browsing.", keywords: ["internet", "browser", "email", "digital safety", "password", "cyber", "online"] },
  { id: "algorithms-coding-logic", label: "Algorithms, Coding and Logic", description: "Follow step-by-step thinking and problem-solving patterns.", keywords: ["algorithm", "coding", "logic", "sequence", "flowchart", "programming", "debug"] },
  { id: "data-handling", label: "Data Handling", description: "Learn about information, storage, and simple data representation.", keywords: ["data", "information", "storage", "database", "spreadsheet", "chart"] },
];

const historyTopics: SubjectTopic[] = [
  { id: "ancient-civilizations", label: "Ancient Civilizations", description: "Learn about early societies, kingdoms, and empires.", keywords: ["ancient", "civilization", "empire", "kingdom", "pharaoh", "olden days"] },
  { id: "colonialism-independence", label: "Colonialism and Independence", description: "Study colonial rule, resistance, and independence movements.", keywords: ["colonialism", "colonial", "independence", "freedom", "nationalist", "self rule"] },
  { id: "leaders-reformers", label: "Leaders and Reformers", description: "Meet important people who shaped history.", keywords: ["leader", "reformer", "hero", "heroine", "activist", "statesman"] },
  { id: "world-events-wars", label: "World Events and Wars", description: "Explore major global turning points and their effects.", keywords: ["war", "world war", "battle", "treaty", "revolution", "global event"] },
  { id: "culture-heritage-timelines", label: "Culture, Heritage and Timelines", description: "Understand chronology, tradition, and historical records.", keywords: ["timeline", "century", "before", "after", "heritage", "culture", "tradition"] },
];

const economicsTopics: SubjectTopic[] = [
  { id: "needs-wants-scarcity", label: "Needs, Wants and Scarcity", description: "Understand limited resources and everyday choices.", keywords: ["need", "want", "scarcity", "choice", "opportunity cost", "resource"] },
  { id: "money-banking-saving", label: "Money, Banking and Saving", description: "Practice spending, saving, and the role of banks.", keywords: ["money", "bank", "saving", "savings", "currency", "interest"] },
  { id: "demand-supply-pricing", label: "Demand, Supply and Pricing", description: "See how buyers and sellers affect prices.", keywords: ["demand", "supply", "price", "pricing", "market price"] },
  { id: "production-trade-markets", label: "Production, Trade and Markets", description: "Follow how goods and services are produced and exchanged.", keywords: ["production", "producer", "trade", "market", "goods", "services", "consumer"] },
  { id: "budgeting-income-profit", label: "Budgeting, Income and Profit", description: "Manage money plans, earnings, and business gain.", keywords: ["budget", "income", "profit", "expense", "revenue", "wages"] },
];

const geographyTopics: SubjectTopic[] = [
  { id: "maps-directions", label: "Maps and Directions", description: "Use symbols, keys, compass points, and location tools.", keywords: ["map", "direction", "compass", "east", "west", "north", "south", "legend", "key"] },
  { id: "weather-climate", label: "Weather and Climate", description: "Compare daily weather with long-term climate patterns.", keywords: ["weather", "climate", "rain", "temperature", "forecast", "sunny"] },
  { id: "landforms-water-bodies", label: "Landforms and Water Bodies", description: "Identify hills, rivers, oceans, deserts, and valleys.", keywords: ["landform", "hill", "mountain", "river", "lake", "ocean", "desert", "valley"] },
  { id: "environment-resources", label: "Environment and Resources", description: "Learn about natural resources and environmental care.", keywords: ["environment", "resource", "renewable", "pollution", "erosion", "forest"] },
  { id: "population-settlement", label: "Population and Settlement", description: "Understand why people live where they do.", keywords: ["population", "settlement", "village", "town", "city", "migration"] },
];

const governmentTopics: SubjectTopic[] = [
  { id: "arms-of-government", label: "Arms of Government", description: "Learn the roles of the executive, legislature, and judiciary.", keywords: ["executive", "legislature", "judiciary", "arm of government", "separation of powers"] },
  { id: "constitution-law", label: "Constitution and Law", description: "Understand rules, constitutions, and legal order.", keywords: ["constitution", "law", "rule of law", "legal", "amendment"] },
  { id: "elections-democracy", label: "Elections and Democracy", description: "Study voting, representation, and democratic systems.", keywords: ["election", "vote", "democracy", "ballot", "candidate", "political party"] },
  { id: "citizenship-rights", label: "Citizenship and Rights", description: "Know civic rights, duties, and public participation.", keywords: ["citizenship", "rights", "duties", "responsibility", "citizen"] },
  { id: "public-institutions", label: "Public Institutions", description: "Recognize agencies and structures that support society.", keywords: ["institution", "public service", "ministry", "court", "parliament", "agency"] },
];

const civicEducationTopics: SubjectTopic[] = [
  { id: "values-character", label: "Values and Character", description: "Build honesty, respect, discipline, and integrity.", keywords: ["honesty", "respect", "discipline", "integrity", "character", "value"] },
  { id: "community-service", label: "Community Service", description: "Learn how helpful action improves society.", keywords: ["community service", "service", "helping others", "volunteer", "community"] },
  { id: "peace-conflict-resolution", label: "Peace and Conflict Resolution", description: "Practice calm problem-solving and peaceful living.", keywords: ["peace", "conflict", "resolution", "tolerance", "settle disagreements"] },
  { id: "rights-responsibilities", label: "Rights and Responsibilities", description: "Balance freedom with duty at home, school, and society.", keywords: ["rights", "responsibilities", "duty", "citizen", "obeying laws"] },
  { id: "national-identity-unity", label: "National Identity and Unity", description: "Promote patriotism, unity, and shared purpose.", keywords: ["patriotism", "unity", "national identity", "nation", "flag", "togetherness"] },
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
    topics: arithmeticTopics,
  },
  {
    id: "english",
    name: "English",
    tagline: "Vocabulary, grammar, and reading",
    icon: "book-open-page-variant-outline",
    accent: ["#1F8A70", "#5DD39E"],
    description: "Grow comprehension, sentence structure, and word power.",
    aiPromptHint: "Focus on grammar, reading comprehension, and vocabulary usage.",
    topics: englishTopics,
  },
  {
    id: "physics",
    name: "Physics",
    tagline: "Forces, energy, and motion",
    icon: "atom-variant",
    accent: ["#7755DD", "#A38BFF"],
    description: "Explore the laws that shape movement, light, and matter.",
    aiPromptHint: "Include real-life physical situations and conceptual reasoning.",
    topics: physicsTopics,
  },
  {
    id: "chemistry",
    name: "Chemistry",
    tagline: "Elements, reactions, and formulas",
    icon: "flask-outline",
    accent: ["#E56B6F", "#FFB4A2"],
    description: "Learn atoms, compounds, mixtures, and chemical change.",
    aiPromptHint: "Use chemistry terms carefully and avoid unsafe experiment prompts.",
    topics: chemistryTopics,
  },
  {
    id: "biology",
    name: "Biology",
    tagline: "Life systems and living things",
    icon: "leaf-circle-outline",
    accent: ["#2A9D8F", "#8FD694"],
    description: "Study organisms, cells, ecosystems, and body systems.",
    aiPromptHint: "Explain biological ideas with age-appropriate examples.",
    topics: biologyTopics,
  },
  {
    id: "computer",
    name: "Computer",
    tagline: "Digital literacy and logic",
    icon: "laptop",
    accent: ["#2D6CDF", "#6FA8FF"],
    description: "Build confidence in computing concepts, devices, and algorithms.",
    aiPromptHint: "Blend computer basics with problem-solving scenarios.",
    topics: computerTopics,
  },
  {
    id: "history",
    name: "History",
    tagline: "People, timelines, and turning points",
    icon: "bank-outline",
    accent: ["#A65E2E", "#E6A15C"],
    description: "Study key events, leaders, empires, and lessons from the past.",
    aiPromptHint: "Use clear timelines, important figures, and cause-and-effect thinking.",
    topics: historyTopics,
  },
  {
    id: "economics",
    name: "Economics",
    tagline: "Choices, markets, and money",
    icon: "chart-line",
    accent: ["#1E9B7A", "#7BD8AE"],
    description: "Learn needs and wants, trade, saving, prices, and production.",
    aiPromptHint: "Connect economic ideas to everyday family, school, and market decisions.",
    topics: economicsTopics,
  },
  {
    id: "geography",
    name: "Geography",
    tagline: "Maps, places, and environments",
    icon: "earth",
    accent: ["#2D8AC7", "#78D1F2"],
    description: "Explore landforms, weather, resources, regions, and human settlement.",
    aiPromptHint: "Use map skills, location clues, and real-world environmental examples.",
    topics: geographyTopics,
  },
  {
    id: "government",
    name: "Government",
    tagline: "Leadership, institutions, and public life",
    icon: "account-group-outline",
    accent: ["#4C63D2", "#8EA2FF"],
    description: "Understand branches of government, constitutions, elections, and civic order.",
    aiPromptHint: "Explain government structures, rights, responsibilities, and public institutions.",
    topics: governmentTopics,
  },
  {
    id: "civic-education",
    name: "Civic Education",
    tagline: "Citizenship, values, and community",
    icon: "hand-heart-outline",
    accent: ["#D96C57", "#F6AF8D"],
    description: "Build character, social responsibility, national values, and peaceful living.",
    aiPromptHint: "Focus on citizenship, values, community service, and responsible behavior.",
    topics: civicEducationTopics,
  },
];

export const QUESTIONS_PER_LEVEL = 10;
export const SCORE_THRESHOLD = 50;
export const BASE_QUIZ_TIME_SECONDS = 120;
export const TIME_INCREMENT_PER_LEVEL = 5;

export function getSubjectById(id?: string | string[]) {
  if (!id || Array.isArray(id)) {
    return undefined;
  }

  return subjects.find((subject) => subject.id === id);
}

export function getTopicById(subject: Subject | undefined, topicId?: string | string[]) {
  if (!subject || !topicId || Array.isArray(topicId)) {
    return undefined;
  }

  return subject.topics.find((topic) => topic.id === topicId);
}
