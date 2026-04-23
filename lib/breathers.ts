import { SCORE_THRESHOLD } from "./subjects";
import type { BreatherContent, SessionResult } from "../types/app";

const BREATHER_INTERVAL = 3;

const subjectBreathers: Record<string, BreatherContent[]> = {
  arithmetic: [
    {
      id: "arith-patterns",
      title: "Math Pause: Spot the Pattern",
      intro: "This breather gives your brain a different kind of math task.",
      formatLabel: "Pattern note",
      story:
        "2, 4, 8, 16... a pattern like this grows by doubling each time. In arithmetic, patterns help learners predict what comes next without solving every step from the beginning. When you notice a number pattern, you begin to think like a stronger problem solver.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This short note teaches that arithmetic is not only about calculation. It also involves seeing structure and repeated rules.",
      reflection: "Before your next question, ask yourself whether there is a shortcut, pattern, or repeated step hiding inside it.",
      facts: [
        "Patterns help with multiplication, division, and mental math.",
        "A good arithmetic learner looks for structure before rushing.",
      ],
      continueLabel: "Continue with arithmetic",
    },
    {
      id: "arith-riddle",
      title: "Math Break: A Market Riddle",
      intro: "Try this short arithmetic riddle before the next level.",
      formatLabel: "Quick riddle",
      story:
        "A fruit seller packs oranges into bags of 5. If she has 25 oranges, how many full bags can she make? The answer is 5 bags. Questions like this train you to connect division to real life.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches students to connect numbers to practical situations like buying, sharing, grouping, and counting.",
      reflection: "When the next problem appears, picture the numbers in a real-life setting instead of treating them as symbols only.",
      facts: [
        "Grouping is one of the easiest ways to understand division.",
        "Arithmetic grows stronger when linked to everyday activities.",
      ],
      continueLabel: "Back to problem solving",
    },
    {
      id: "arith-mental",
      title: "Math Pause: Mental Strategies",
      intro: "Here is a skill tip many strong learners use.",
      formatLabel: "Strategy tip",
      story:
        "To add 19 + 7 quickly, some learners think 20 + 7 = 27, then subtract 1 to get 26. This is called a mental strategy. Arithmetic gets easier when you break a hard question into a simpler one first.",
      teachingTitle: "What this is teaching",
      teachingPoint: "It teaches flexibility in thinking. Students do not always have to solve a question in one rigid way.",
      reflection: "Try to simplify the next arithmetic question in your mind before you answer it.",
      facts: [
        "Mental math is often about changing a problem into an easier version.",
        "Flexible thinking improves both speed and confidence.",
      ],
      continueLabel: "Keep practicing",
    },
  ],
  english: [
    {
      id: "eng-poem-rain",
      title: "English Breather: A Short Poem",
      intro: "Take a short reading break with a poem.",
      formatLabel: "Poem",
      story:
        "Rain taps softly on the roof,\nDrop by drop in steady proof.\nClouds may hide the shining sun,\nYet every storm will one day run.",
      teachingTitle: "What this poem teaches",
      teachingPoint: "This poem shows rhyme through words like roof and proof, and sun and run. It helps the learner notice sound patterns and mood in poetry.",
      reflection: "When you return to your English questions, look closely at how words create both meaning and sound.",
      facts: [
        "Poems often use rhythm and rhyme to make ideas memorable.",
        "A short poem can teach vocabulary, mood, and sound patterns at once.",
      ],
      continueLabel: "Continue with English",
    },
    {
      id: "eng-comprehension",
      title: "English Breather: Mini Comprehension",
      intro: "Read this short passage and enjoy a lighter learning moment.",
      formatLabel: "Reading passage",
      story:
        "Amaka watered the school garden every afternoon. At first, the plants looked small and weak. After some weeks, green leaves spread across the bed, and bright flowers appeared. Her teacher smiled and said, 'Care and patience help living things grow.'",
      teachingTitle: "What this passage teaches",
      teachingPoint: "This passage teaches comprehension through sequence and message. It also shows that a story can carry a lesson beyond the basic events.",
      reflection: "In your next English question, pay attention to what a passage is saying directly and what it is teaching indirectly.",
      facts: [
        "Comprehension involves understanding both events and meaning.",
        "Stories often contain a message or moral beyond the surface details.",
      ],
      continueLabel: "Continue reading",
    },
    {
      id: "eng-figure",
      title: "English Breather: Figure of Speech",
      intro: "Here is a quick language lesson before the next round.",
      formatLabel: "Language note",
      story:
        "When someone says, 'Time is a thief,' they do not mean time literally steals things. This is a metaphor. A metaphor compares two things to make meaning stronger and more vivid.",
      teachingTitle: "What this teaches",
      teachingPoint: "This breather teaches metaphor, one of the common figures of speech in English. It helps learners understand how writers create vivid expression.",
      reflection: "As you continue, watch for words that suggest more than their plain meaning.",
      facts: [
        "A metaphor compares without using 'like' or 'as'.",
        "Figures of speech make language more expressive and memorable.",
      ],
      continueLabel: "Back to English practice",
    },
  ],
  physics: [
    {
      id: "phy-balance",
      title: "Physics Break: Why Balance Matters",
      intro: "This short concept break helps you see physics in daily life.",
      formatLabel: "Concept note",
      story:
        "When a cyclist keeps moving, tiny adjustments help the bicycle stay balanced. Physics explains this through forces, motion, and control. Many things that seem natural become easier to understand when you ask which forces are acting and how they interact.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches that physics is not distant from life. It explains motion and stability in ordinary activities.",
      reflection: "In the next physics question, ask what force or motion idea is hidden in the situation.",
      facts: [
        "Physics explains common events such as motion, balance, and change.",
        "Good physics thinking often begins with observation.",
      ],
      continueLabel: "Continue with physics",
    },
    {
      id: "phy-sound",
      title: "Physics Break: A Note on Sound",
      intro: "Take a short pause with this science idea.",
      formatLabel: "Science note",
      story:
        "Sound travels in waves. When a drum is struck, the surface vibrates and pushes nearby air. That movement spreads outward until it reaches the ear. Physics helps learners understand that many invisible things, like sound and light, still follow rules.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This introduces sound as vibration and wave motion, showing that physics describes things we hear but cannot see directly.",
      reflection: "Think about the next science question as a hidden process waiting to be explained.",
      facts: [
        "Vibration is the source of many sounds.",
        "Waves transfer energy from one place to another.",
      ],
      continueLabel: "Return to science",
    },
    {
      id: "phy-history",
      title: "Physics Break: Curiosity Before Invention",
      intro: "A quick reading break can still sharpen your science mind.",
      formatLabel: "Discovery note",
      story:
        "Before people built powerful machines, they first asked careful questions. Why does a stone fall? Why does a boat float? Why does light reflect? Physics grew from curiosity like this. Strong learners do not only memorize answers. They learn to frame good questions.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches that scientific progress begins with observation and thoughtful questioning.",
      reflection: "As you move on, try to ask 'why' before choosing an answer.",
      facts: [
        "Questions are a major tool of scientific learning.",
        "Physics often begins with everyday observations.",
      ],
      continueLabel: "Continue discovering",
    },
  ],
  chemistry: [
    {
      id: "chem-change",
      title: "Chemistry Break: Kinds of Change",
      intro: "Pause with a quick lesson on how matter changes.",
      formatLabel: "Chemistry note",
      story:
        "When ice melts, it changes form but remains water. When paper burns, new substances are formed. Chemistry teaches learners to notice the difference between physical changes and chemical changes.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches that not every change in matter is the same. Some changes only affect form, while others create something new.",
      reflection: "In your next chemistry question, ask what kind of change is happening.",
      facts: [
        "Melting is a physical change.",
        "Burning is usually a chemical change.",
      ],
      continueLabel: "Continue with chemistry",
    },
    {
      id: "chem-mixture",
      title: "Chemistry Break: Mixture or Pure Substance?",
      intro: "Here is a short concept break before the next level.",
      formatLabel: "Concept check",
      story:
        "A glass of salt water is a mixture because salt and water are combined without becoming a new substance. Chemistry helps learners separate ideas like element, compound, and mixture so the world of matter becomes more organized.",
      teachingTitle: "What this is teaching",
      teachingPoint: "It teaches classification in chemistry, especially how substances are grouped and understood.",
      reflection: "As you return, think about how scientists classify the materials around them.",
      facts: [
        "A mixture contains substances combined physically.",
        "Classification makes chemistry easier to understand.",
      ],
      continueLabel: "Continue learning chemistry",
    },
  ],
  biology: [
    {
      id: "bio-seed",
      title: "Biology Break: A Seed's Quiet Work",
      intro: "Take a short nature break with this reading piece.",
      formatLabel: "Nature reading",
      story:
        "A seed looks still from the outside, yet inside it holds stored food and the beginning of a new plant. With water, air, and warmth, it starts to grow. Biology helps us understand that living things often change slowly before the results become visible.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches germination and reminds learners that growth can be a process hidden from immediate view.",
      reflection: "In the next biology question, think about processes as sequences rather than single moments.",
      facts: [
        "Seeds need the right conditions to germinate.",
        "Many biological changes happen step by step.",
      ],
      continueLabel: "Continue with biology",
    },
    {
      id: "bio-ecosystem",
      title: "Biology Break: Life Works Together",
      intro: "This breather focuses on connection in living systems.",
      formatLabel: "Ecosystem note",
      story:
        "In a healthy environment, plants, animals, soil, water, and sunlight are linked. If one part changes too much, other parts are affected too. Biology teaches learners to see living things not as separate pieces, but as systems of connection.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches the idea of ecosystems and interdependence among living things and their environment.",
      reflection: "As you continue, look for relationships between organisms and their environment.",
      facts: [
        "Living things depend on both one another and their surroundings.",
        "Biology often makes the most sense when studied as a system.",
      ],
      continueLabel: "Back to biology",
    },
  ],
  computer: [
    {
      id: "comp-algorithm",
      title: "Computer Break: What Is an Algorithm?",
      intro: "A short digital-thinking pause can still teach a lot.",
      formatLabel: "Tech concept",
      story:
        "An algorithm is a clear set of steps for solving a problem. A recipe is one kind of algorithm in daily life. In computing, algorithms help people and machines complete tasks in the correct order.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches that computer studies are deeply connected to logic and sequencing, not just devices.",
      reflection: "In the next question, think about order, sequence, and clear steps.",
      facts: [
        "Algorithms are used in both everyday tasks and computer systems.",
        "Good instructions are clear, ordered, and repeatable.",
      ],
      continueLabel: "Continue with computing",
    },
    {
      id: "comp-safety",
      title: "Computer Break: Staying Safe Online",
      intro: "This breather mixes learning with digital responsibility.",
      formatLabel: "Safety note",
      story:
        "A strong password is one of the simplest ways to protect an online account. Safe digital behavior also includes not sharing personal information carelessly and thinking before clicking unknown links. Computer learning is not complete without digital safety.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches responsible digital citizenship and basic account protection.",
      reflection: "As you continue, remember that smart computer use includes safety, not only skill.",
      facts: [
        "A good password protects important information.",
        "Digital responsibility is part of computer education.",
      ],
      continueLabel: "Continue with computer studies",
    },
  ],
  history: [
    {
      id: "hist-timeline",
      title: "History Break: Why Timelines Matter",
      intro: "Take a short pause with this history skill note.",
      formatLabel: "History skill",
      story:
        "When events are placed in the right order, history becomes easier to understand. A timeline helps learners see what happened first, what followed, and how one event may have influenced another.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches chronology, one of the core skills in historical thinking.",
      reflection: "In the next history question, think about sequence, cause, and effect.",
      facts: [
        "Chronology helps learners understand change over time.",
        "History often becomes clearer when events are ordered properly.",
      ],
      continueLabel: "Continue with history",
    },
    {
      id: "hist-leaders",
      title: "History Break: Leadership and Legacy",
      intro: "A short reading can still deepen your historical understanding.",
      formatLabel: "Mini lesson",
      story:
        "Some leaders are remembered not only because they held power, but because of what changed during their time. Good history asks what a leader did, why it mattered, and how people were affected.",
      teachingTitle: "What this is teaching",
      teachingPoint: "It teaches historical significance by linking people to actions and long-term effects.",
      reflection: "As you continue, think about which actions make a historical figure important.",
      facts: [
        "History studies both events and their significance.",
        "Leadership is best understood through impact, not title alone.",
      ],
      continueLabel: "Return to history",
    },
  ],
  economics: [
    {
      id: "econ-needs",
      title: "Economics Break: Needs and Wants",
      intro: "Pause with a simple but important economics idea.",
      formatLabel: "Concept break",
      story:
        "Food, shelter, and water are needs because people depend on them for life and well-being. A new toy or fashionable item may be a want. Economics teaches learners how choices become clearer when they understand the difference.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches the basic distinction between needs and wants, a foundation for economic thinking.",
      reflection: "As you continue, ask whether a choice solves a need or only satisfies a want.",
      facts: [
        "Not every desire has the same level of importance.",
        "Economics often begins by ranking priorities.",
      ],
      continueLabel: "Continue with economics",
    },
    {
      id: "econ-saving",
      title: "Economics Break: Why Saving Matters",
      intro: "Here is a short life-based lesson before the next session.",
      formatLabel: "Practical note",
      story:
        "Saving means keeping part of your money for future use instead of spending all of it now. It helps people prepare for school needs, emergencies, or larger goals. Economics becomes more meaningful when learners connect ideas to real decisions.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches delayed choice, planning, and the value of managing limited resources wisely.",
      reflection: "Think of your next economics question as a real-life choice someone has to make carefully.",
      facts: [
        "Saving supports planning and stability.",
        "Economic choices often involve trade-offs between now and later.",
      ],
      continueLabel: "Continue with economics",
    },
  ],
  geography: [
    {
      id: "geo-map",
      title: "Geography Break: Reading a Map",
      intro: "A short map skill break can sharpen your thinking.",
      formatLabel: "Map skill",
      story:
        "A map does not only show places. It also uses symbols, direction, distance, and labels to tell a story about space. Geography grows easier when learners know how to read these clues carefully.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches map literacy and helps students treat maps as tools for meaning, not only pictures.",
      reflection: "As you continue, look for clues about direction, location, and human activity.",
      facts: [
        "A map key helps explain symbols.",
        "Direction and scale are important map features.",
      ],
      continueLabel: "Continue with geography",
    },
    {
      id: "geo-weather",
      title: "Geography Break: Weather and Climate",
      intro: "Here is a quick note before the next level.",
      formatLabel: "Climate note",
      story:
        "Weather describes short-term conditions like rain, heat, or wind on a given day. Climate describes the usual weather pattern of a place over a long time. Geography helps learners tell the difference so they can understand regions more accurately.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches one of the most common geography distinctions: weather versus climate.",
      reflection: "In your next geography question, ask whether it is about a daily condition or a long-term pattern.",
      facts: [
        "Weather changes quickly; climate describes a pattern over time.",
        "Geography connects environment to human life.",
      ],
      continueLabel: "Back to geography",
    },
  ],
  government: [
    {
      id: "gov-arms",
      title: "Government Break: Why Government Has Branches",
      intro: "Take a short civic pause before the next level.",
      formatLabel: "Civics note",
      story:
        "Many governments divide power into branches so that one part does not control everything alone. The legislature makes laws, the executive carries them out, and the judiciary interprets them. This structure supports balance and accountability.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches the basic idea of separation of powers.",
      reflection: "In your next question, think about which branch is responsible for which role.",
      facts: [
        "Government structure is meant to organize responsibility.",
        "Sharing power can reduce abuse of authority.",
      ],
      continueLabel: "Continue with government",
    },
    {
      id: "gov-citizen",
      title: "Government Break: Citizens and Participation",
      intro: "A short reading can still strengthen public understanding.",
      formatLabel: "Participation note",
      story:
        "Government is not only about leaders. It also depends on informed citizens who vote, ask questions, obey laws, and care about public life. A strong government system works better when citizens participate wisely.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches that public life involves both institutions and citizen responsibility.",
      reflection: "As you return to your questions, think about the place of the citizen in a functioning state.",
      facts: [
        "Citizens help shape public life through participation.",
        "Good government depends on both structure and civic awareness.",
      ],
      continueLabel: "Return to government",
    },
  ],
  "civic-education": [
    {
      id: "civic-values",
      title: "Civic Breather: Values in Action",
      intro: "Take a short break with this character lesson.",
      formatLabel: "Values note",
      story:
        "Respect, honesty, responsibility, and cooperation are not just words to memorize. They guide real actions in families, schools, and communities. Civic education becomes powerful when values move from discussion into daily behavior.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches that civic learning is practical. It is meant to shape behavior, not only test answers.",
      reflection: "As you continue, think about how values appear in real decisions and actions.",
      facts: [
        "Civic values help communities function peacefully.",
        "Good character is part of education, not separate from it.",
      ],
      continueLabel: "Continue with civic education",
    },
    {
      id: "civic-service",
      title: "Civic Breather: Service Builds Community",
      intro: "A short reading can still carry a strong lesson.",
      formatLabel: "Community note",
      story:
        "Community service is one way people show responsibility beyond themselves. Cleaning a shared space, helping others, and protecting public property are all examples of civic-minded action. Strong societies grow when people care for the common good.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches students that citizenship includes service and care for shared life.",
      reflection: "In the next civic question, think about what supports the common good rather than private gain alone.",
      facts: [
        "Citizenship includes service and responsibility.",
        "Communities grow stronger when shared spaces are protected.",
      ],
      continueLabel: "Continue learning",
    },
  ],
};

const generalBreathers: BreatherContent[] = [
  {
    id: "general-reset",
    title: "Learning Reset: Read, Breathe, Continue",
    intro: "A short learning break can help your focus return stronger.",
    formatLabel: "Study break",
    story:
      "Good learners do not only work hard. They also pause wisely. A breather gives the brain time to reset while still staying connected to learning. That is why this moment is not empty rest. It is guided rest with purpose.",
    teachingTitle: "What this is teaching",
    teachingPoint: "This teaches that recovery and reflection are part of effective study habits.",
    reflection: "Take a calm breath and return to the next challenge with a fresher mind.",
    facts: [
      "Short breaks can support better concentration.",
      "Reflection helps information stay longer in memory.",
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
  const indexSeed = Math.max(level * 2 + streak - 1, 0);
  return candidates[indexSeed % candidates.length] ?? generalBreathers[0];
}
