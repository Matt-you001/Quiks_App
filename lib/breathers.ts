import { appVariant } from "./app-variant";
import { SCORE_THRESHOLD } from "./subjects";
import type { AppLanguage, BreatherContent, SessionResult } from "../types/app";

const BREATHER_INTERVAL = 3;

const childrenSubjectBreathers: Record<string, BreatherContent[]> = {
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

const teenGeneralBreathers: BreatherContent[] = [
  {
    id: "teens-exam-reset",
    title: "Revision Reset: Breathe and Reframe",
    intro: "A short reset can help you return sharper for the next test round.",
    formatLabel: "Revision note",
    story:
      "Strong secondary-school learners do not only keep answering questions nonstop. They pause, reframe the topic, and return with better focus. A short revision break can help you connect facts, methods, and meaning before the next set begins.",
    teachingTitle: "What this is teaching",
    teachingPoint: "This breather teaches that deliberate pauses can improve retention, exam control, and confidence under pressure.",
    reflection: "Before the next round starts, ask yourself what idea the last level was really testing.",
    facts: [
      "Short revision pauses can improve concentration.",
      "Understanding the idea behind a question is often more useful than memorizing one answer.",
    ],
    continueLabel: "Continue revision",
  },
  {
    id: "teens-concept-link",
    title: "Concept Link: Learn Beyond the Mark",
    intro: "This break is here to connect the topic to stronger exam understanding.",
    formatLabel: "Exam insight",
    story:
      "In serious school study, one topic often supports another. A learner who understands the concept behind a question can handle unfamiliar wording much better than one who memorizes isolated facts. Good revision turns separate points into connected understanding.",
    teachingTitle: "What this is teaching",
    teachingPoint: "This breather teaches transfer of understanding, which is essential for stronger exam performance.",
    reflection: "As you continue, look for the rule, principle, or pattern that can help in more than one question.",
    facts: [
      "Connected understanding supports better problem solving.",
      "Exam success often depends on applying ideas in new forms.",
    ],
    continueLabel: "Back to the test",
  },
];

const uniGeneralBreathers: BreatherContent[] = [
  {
    id: "uni-academic-pause",
    title: "Academic Pause: Consolidate the Concept",
    intro: "A short academic pause can improve recall and conceptual control.",
    formatLabel: "Study reflection",
    story:
      "University-level learning is not only about finishing questions. It is also about consolidating ideas, clarifying definitions, and recognizing how concepts connect across a course. A brief pause like this helps convert activity into understanding.",
    teachingTitle: "What this is teaching",
    teachingPoint: "This breather teaches that higher learning improves when students pause to organize knowledge rather than rushing through tasks mechanically.",
    reflection: "Before continuing, summarize the main idea from the last level in one precise sentence.",
    facts: [
      "Conceptual consolidation improves long-term retention.",
      "Clear definitions and relationships matter in tertiary study.",
    ],
    continueLabel: "Continue study session",
  },
  {
    id: "uni-application-pause",
    title: "Application Pause: From Theory to Use",
    intro: "This breather keeps the mind active while lowering the pressure for a moment.",
    formatLabel: "Applied note",
    story:
      "At university level, strong answers often depend on more than remembering a term. They depend on applying a concept carefully to a problem, case, system, or example. A useful break is one that reminds you to think with the idea, not only about it.",
    teachingTitle: "What this is teaching",
    teachingPoint: "This breather teaches applied reasoning, which is central to coursework, assessments, and professional preparation.",
    reflection: "When the next question appears, ask how the concept should be used, not only how it should be defined.",
    facts: [
      "Application is a key marker of tertiary-level mastery.",
      "Higher-level questions often test judgment, structure, and relevance.",
    ],
    continueLabel: "Return to your course",
  },
];

const teenSubjectBreathers: Record<string, BreatherContent[]> = {
  arithmetic: [
    {
      id: "teens-math-method",
      title: "Mathematics Break: Method Before Speed",
      intro: "A strong math learner improves fastest when method becomes clear.",
      formatLabel: "Revision strategy",
      story:
        "Many secondary-school mathematics questions become easier once you identify the method first. Is the question testing algebraic manipulation, number reasoning, ratio, or geometry? When you classify the question early, your chances of choosing the right path improve.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches learners to recognize question type before attempting a solution, a strong exam skill.",
      reflection: "As you continue, pause briefly at each question and name the method it is likely testing.",
      facts: [
        "Correct method selection reduces careless mistakes.",
        "Good mathematics revision is not only about speed but also about structure.",
      ],
      continueLabel: "Continue mathematics",
    },
  ],
  english: [
    {
      id: "teens-english-precision",
      title: "English Break: Read the Writer Carefully",
      intro: "A short reading pause can sharpen interpretation for the next set.",
      formatLabel: "Language insight",
      story:
        "In secondary-school English, strong answers often depend on noticing tone, purpose, grammar, and implied meaning. A passage or sentence may seem simple at first, yet the best answer usually belongs to the learner who reads carefully rather than quickly.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches close reading, which supports comprehension, summary, and interpretation.",
      reflection: "In the next English question, ask what the writer is doing with the language, not only what the words say on the surface.",
      facts: [
        "Close reading improves comprehension and inference.",
        "Accuracy in English often comes from paying attention to detail.",
      ],
      continueLabel: "Continue English",
    },
  ],
  physics: [
    {
      id: "teens-physics-model",
      title: "Physics Break: Model the Situation",
      intro: "A quick concept pause can make the next physics question clearer.",
      formatLabel: "Science method",
      story:
        "Secondary-school physics becomes easier when you translate a situation into a simple model. Ask what is moving, what force is acting, what quantity is changing, and what law or relationship fits the case. Physics improves when description becomes structure.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches modeling, a major skill in school physics problem solving.",
      reflection: "As you continue, reduce the next problem to its main quantities, forces, or relationships before choosing an answer.",
      facts: [
        "Physics questions often become simpler after careful modeling.",
        "Strong learners move from story wording to scientific structure quickly.",
      ],
      continueLabel: "Continue physics",
    },
  ],
  commerce: [
    {
      id: "teens-commerce-practice",
      title: "Commerce Break: Business in Real Life",
      intro: "A practical breather can still strengthen your revision.",
      formatLabel: "Business note",
      story:
        "Commerce becomes easier to understand when you connect it to everyday trade. Shops, receipts, banks, transport systems, advertising, and insurance are not isolated terms. They are part of how goods and services move through economic life.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This teaches learners to connect textbook terms to practical business activity.",
      reflection: "When the next commerce question appears, picture the real transaction or business situation behind it.",
      facts: [
        "Commerce is easier when linked to actual business practice.",
        "Real-life context improves recall of commercial terms.",
      ],
      continueLabel: "Continue commerce",
    },
  ],
  "literature-in-english": [
    {
      id: "teens-literature-reading",
      title: "Literature Break: Look Beyond the Plot",
      intro: "This breather shifts your attention from events to meaning.",
      formatLabel: "Literary insight",
      story:
        "In literature, a strong answer rarely stops at retelling the story. It asks what the writer is showing through character, conflict, imagery, tone, or theme. The more you read for meaning, the more confident your interpretation becomes.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches interpretive reading, which is central to literature study.",
      reflection: "As you continue, ask what idea or effect the writer is building, not only what happened next.",
      facts: [
        "Literature questions often reward insight more than simple recall.",
        "Theme and technique usually matter as much as plot.",
      ],
      continueLabel: "Continue literature",
    },
  ],
};

const uniSubjectBreathers: Record<string, BreatherContent[]> = {
  arithmetic: [
    {
      id: "uni-math-abstraction",
      title: "Mathematics Pause: Structure Matters",
      intro: "A short pause can help you return to the next problem with more structure.",
      formatLabel: "Concept reflection",
      story:
        "University mathematics is not only about computing an answer. It is about recognizing structure, notation, assumptions, and relationships between ideas. A learner who sees the form of a problem clearly is usually in a stronger position than one who rushes straight into manipulation.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches mathematical maturity: looking for structure, conditions, and relationships before performing steps.",
      reflection: "Before the next mathematics question, identify what the problem is really about: algebraic structure, function behavior, proof logic, or quantitative relationship.",
      facts: [
        "Tertiary mathematics rewards structure as much as calculation.",
        "Good notation and careful assumptions often prevent major errors.",
      ],
      continueLabel: "Continue mathematics",
    },
  ],
  law: [
    {
      id: "uni-law-reasoning",
      title: "Law Pause: Issue, Rule, Application",
      intro: "A short legal breather can sharpen your reasoning for the next set.",
      formatLabel: "Legal method",
      story:
        "Law questions become clearer when you separate the issue, identify the governing rule, and apply that rule carefully to the facts. Strong legal reasoning is rarely about memory alone. It is about disciplined analysis and controlled application.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches the core movement of legal analysis from issue to rule to application.",
      reflection: "As you continue, ask what the real legal issue is before you focus on the answer choices.",
      facts: [
        "Legal study depends heavily on analysis of facts and principles.",
        "A clear method often improves both speed and accuracy in law questions.",
      ],
      continueLabel: "Return to law",
    },
  ],
  engineering: [
    {
      id: "uni-engineering-systems",
      title: "Engineering Pause: Think in Systems",
      intro: "A brief systems view can improve the way you approach the next problem.",
      formatLabel: "Applied thinking",
      story:
        "Engineering questions often test more than one idea at once. A structure, circuit, process, or mechanism usually works as a system with inputs, constraints, behavior, and output. Tertiary engineering becomes stronger when you see interaction rather than isolated facts.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches systems thinking, which supports design, diagnosis, and applied problem solving.",
      reflection: "In the next question, identify the system, the main variables, and the constraint shaping the result.",
      facts: [
        "Engineering decisions are often constrained by safety, efficiency, and design limits.",
        "System thinking improves both technical reasoning and practical judgment.",
      ],
      continueLabel: "Continue engineering",
    },
  ],
  medicine: [
    {
      id: "uni-medicine-clinical",
      title: "Medicine Pause: Link Function to Meaning",
      intro: "A short pause can help you connect facts to clinical understanding.",
      formatLabel: "Clinical note",
      story:
        "Medical learning becomes deeper when facts are linked to function, dysfunction, and patient meaning. Anatomy matters because it shapes physiology, and physiology matters because it helps explain disease, signs, symptoms, and treatment logic. Good medical reasoning connects rather than memorizes in isolation.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches integrated medical thinking across normal function, pathology, and clinical interpretation.",
      reflection: "As you continue, ask how the concept in the next question would matter in understanding a real patient or clinical scenario.",
      facts: [
        "Medical understanding improves when structure, function, and disease are studied together.",
        "Clinical reasoning often begins with careful interpretation of signs and mechanisms.",
      ],
      continueLabel: "Continue medicine",
    },
  ],
  "management-studies": [
    {
      id: "uni-management-decision",
      title: "Management Pause: Decision Before Action",
      intro: "This break keeps the mind engaged while easing the pace.",
      formatLabel: "Management insight",
      story:
        "Management questions often ask what a sound decision should look like under real constraints. Planning, staffing, operations, leadership, and strategy all involve choosing among imperfect options. Strong management thinking weighs goals, people, resources, and consequences together.",
      teachingTitle: "What this is teaching",
      teachingPoint: "This breather teaches decision framing, a central skill in management study.",
      reflection: "In the next management question, ask what the manager is trying to achieve and what trade-off is shaping the decision.",
      facts: [
        "Management problems often involve trade-offs rather than perfect choices.",
        "Clear objectives improve analysis in business and organizational questions.",
      ],
      continueLabel: "Return to management studies",
    },
  ],
};

const childrenGeneralBreathers: BreatherContent[] = [
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

const localizedBreatherOverrides: Partial<Record<AppLanguage, Record<string, Partial<BreatherContent>>>> = {
  fr: {
    "general-reset": {
      title: "Pause d'apprentissage : lire, respirer, continuer",
      intro: "Une courte pause peut t'aider a revenir avec plus d'attention.",
      formatLabel: "Pause d'etude",
      story:
        "Les bons apprenants ne travaillent pas seulement dur. Ils savent aussi faire une pause utile. Une respiration d'apprentissage donne au cerveau le temps de se recentrer tout en restant connecte au travail scolaire.",
      teachingTitle: "Ce que cela enseigne",
      teachingPoint: "Cela montre que le repos et la reflexion font partie de bonnes habitudes d'etude.",
      reflection: "Respire calmement puis reviens au prochain exercice avec un esprit plus frais.",
      facts: [
        "De courtes pauses peuvent ameliorer la concentration.",
        "La reflexion aide les connaissances a durer plus longtemps.",
      ],
      continueLabel: "Continuer l'apprentissage",
    },
    "arith-patterns": {
      title: "Pause maths : repere le motif",
      intro: "Cette pause donne a ton cerveau un autre type de defi mathematique.",
      formatLabel: "Note sur les motifs",
      story:
        "2, 4, 8, 16... un motif comme celui-ci grandit en doublant a chaque etape. En arithmetique, les motifs aident l'apprenant a predire la suite sans recommencer tout le raisonnement.",
      teachingTitle: "Ce que cela enseigne",
      teachingPoint: "Cette note montre que l'arithmetique ne se limite pas au calcul. Elle demande aussi de voir la structure et les regles qui se repetent.",
      reflection: "Avant la prochaine question, demande-toi s'il existe un raccourci ou un motif cache.",
      facts: [
        "Les motifs aident en multiplication, en division et en calcul mental.",
        "Un bon apprenant cherche d'abord la structure.",
      ],
      continueLabel: "Continuer l'arithmetique",
    },
    "eng-poem-rain": {
      title: "Pause anglais : un court poeme",
      intro: "Prends une petite pause de lecture avec ce poeme.",
      formatLabel: "Poeme",
      story:
        "La pluie frappe doucement le toit,\nGoutte apres goutte sans grand bruit.\nLes nuages cachent parfois le soleil,\nMais toute tempete finit son reveil.",
      teachingTitle: "Ce que ce poeme enseigne",
      teachingPoint: "Ce poeme aide l'apprenant a remarquer le rythme, la rime et l'ambiance en poesie.",
      reflection: "Quand tu reviens aux questions d'anglais, observe comment les mots creent le sens et le son.",
      facts: [
        "Les poemes utilisent souvent rythme et rime pour mieux faire retenir les idees.",
        "Un court poeme peut enseigner le vocabulaire et l'atmosphere en meme temps.",
      ],
      continueLabel: "Continuer l'anglais",
    },
    "hist-timeline": {
      title: "Pause histoire : pourquoi la chronologie compte",
      intro: "Prends une courte pause avec cette competence d'histoire.",
      formatLabel: "Competence d'histoire",
      story:
        "Quand les evenements sont places dans le bon ordre, l'histoire devient plus claire. Une chronologie aide a voir ce qui est arrive d'abord, ce qui a suivi et comment un evenement a influence un autre.",
      teachingTitle: "Ce que cela enseigne",
      teachingPoint: "Cette pause enseigne la chronologie, une competence centrale de la pensee historique.",
      reflection: "Dans la prochaine question, pense a l'ordre, a la cause et a l'effet.",
      facts: [
        "La chronologie aide a comprendre le changement dans le temps.",
        "L'histoire devient plus claire quand les evenements sont bien ordonnes.",
      ],
      continueLabel: "Continuer l'histoire",
    },
    "teens-exam-reset": {
      title: "Pause revision : respire et recadre",
      intro: "Une courte pause peut t'aider a revenir plus net pour le prochain test.",
      formatLabel: "Note de revision",
      story:
        "Les apprenants solides du secondaire ne repondent pas sans arret aux questions. Ils s'arretent, recadrent le sujet puis reviennent avec une meilleure concentration.",
      teachingTitle: "Ce que cela enseigne",
      teachingPoint: "Cette pause montre qu'un arret volontaire peut ameliorer la retention et la maitrise en examen.",
      reflection: "Avant la reprise, demande-toi quelle idee principale le dernier niveau testait vraiment.",
      facts: [
        "De courtes pauses de revision peuvent ameliorer l'attention.",
        "Comprendre l'idee derriere une question vaut souvent plus qu'apprendre une seule reponse.",
      ],
      continueLabel: "Continuer la revision",
    },
    "uni-academic-pause": {
      title: "Pause academique : consolider le concept",
      intro: "Une courte pause academique peut ameliorer la memorisation et la maitrise conceptuelle.",
      formatLabel: "Reflexion d'etude",
      story:
        "L'apprentissage universitaire ne consiste pas seulement a terminer des questions. Il faut aussi consolider les idees, clarifier les definitions et voir comment les concepts se relient dans un cours.",
      teachingTitle: "Ce que cela enseigne",
      teachingPoint: "Cette pause montre que l'enseignement superieur devient plus fort quand l'etudiant organise le savoir au lieu d'accumuler des reponses.",
      reflection: "Avant de continuer, resume l'idee principale du dernier niveau en une phrase precise.",
      facts: [
        "La consolidation conceptuelle favorise la memorisation durable.",
        "Les definitions claires et les relations entre idees sont essentielles a l'universite.",
      ],
      continueLabel: "Continuer la session d'etude",
    },
    "uni-law-reasoning": {
      title: "Pause droit : question, regle, application",
      intro: "Une courte pause juridique peut affiner ton raisonnement avant la suite.",
      formatLabel: "Methode juridique",
      story:
        "Les questions de droit deviennent plus claires quand on separe la question juridique, la regle applicable et son application aux faits. Le raisonnement juridique solide ne depend pas seulement de la memoire.",
      teachingTitle: "Ce que cela enseigne",
      teachingPoint: "Cette pause enseigne le mouvement essentiel du raisonnement juridique : question, regle et application.",
      reflection: "Pour la prochaine question, identifie d'abord le vrai probleme juridique.",
      facts: [
        "L'etude du droit repose sur l'analyse des faits et des principes.",
        "Une methode claire ameliore souvent la vitesse et la precision.",
      ],
      continueLabel: "Retour au droit",
    },
  },
  es: {
    "general-reset": {
      title: "Pausa de aprendizaje: leer, respirar y continuar",
      intro: "Una pausa corta puede ayudarte a volver con mejor atencion.",
      formatLabel: "Pausa de estudio",
      story:
        "Los buenos estudiantes no solo trabajan duro. Tambien saben hacer una pausa con sentido. Un descanso guiado da tiempo al cerebro para reiniciarse sin desconectarse del aprendizaje.",
      teachingTitle: "Lo que esto ensena",
      teachingPoint: "Esto muestra que el descanso y la reflexion forman parte de los buenos habitos de estudio.",
      reflection: "Respira con calma y vuelve al siguiente reto con una mente mas fresca.",
      facts: [
        "Las pausas cortas pueden mejorar la concentracion.",
        "La reflexion ayuda a que la informacion dure mas en la memoria.",
      ],
      continueLabel: "Continuar aprendiendo",
    },
    "arith-patterns": {
      title: "Pausa de matematicas: descubre el patron",
      intro: "Este descanso le da a tu mente otro tipo de reto matematico.",
      formatLabel: "Nota sobre patrones",
      story:
        "2, 4, 8, 16... un patron como este crece duplicandose cada vez. En aritmetica, los patrones ayudan al estudiante a predecir lo que sigue sin resolver todo desde el principio.",
      teachingTitle: "Lo que esto ensena",
      teachingPoint: "Esta nota muestra que la aritmetica no es solo calcular. Tambien implica ver estructura y reglas repetidas.",
      reflection: "Antes de la siguiente pregunta, piensa si hay un atajo o un patron escondido.",
      facts: [
        "Los patrones ayudan con multiplicacion, division y calculo mental.",
        "Un buen estudiante busca primero la estructura.",
      ],
      continueLabel: "Continuar con aritmetica",
    },
    "eng-poem-rain": {
      title: "Descanso de ingles: un poema corto",
      intro: "Toma una breve pausa de lectura con este poema.",
      formatLabel: "Poema",
      story:
        "La lluvia toca suave el tejado,\nGota a gota con ritmo marcado.\nLas nubes pueden tapar el sol,\nPero toda tormenta encuentra control.",
      teachingTitle: "Lo que ensena este poema",
      teachingPoint: "Este poema ayuda al estudiante a notar ritmo, rima y ambiente en la poesia.",
      reflection: "Cuando vuelvas a las preguntas de ingles, observa como las palabras crean significado y sonido.",
      facts: [
        "Los poemas suelen usar ritmo y rima para hacer memorables las ideas.",
        "Un poema corto puede ensenar vocabulario y tono a la vez.",
      ],
      continueLabel: "Continuar con ingles",
    },
    "hist-timeline": {
      title: "Pausa de historia: por que importa la linea del tiempo",
      intro: "Haz una pausa corta con esta habilidad de historia.",
      formatLabel: "Habilidad historica",
      story:
        "Cuando los hechos se colocan en el orden correcto, la historia se entiende mejor. Una linea del tiempo ayuda a ver que ocurrio primero, que vino despues y como un hecho influyo en otro.",
      teachingTitle: "Lo que esto ensena",
      teachingPoint: "Este descanso ensena cronologia, una habilidad central del pensamiento historico.",
      reflection: "En la siguiente pregunta, piensa en secuencia, causa y efecto.",
      facts: [
        "La cronologia ayuda a comprender el cambio a lo largo del tiempo.",
        "La historia se vuelve mas clara cuando los hechos estan bien ordenados.",
      ],
      continueLabel: "Continuar con historia",
    },
    "teens-exam-reset": {
      title: "Pausa de repaso: respira y reenfoca",
      intro: "Una pausa breve puede ayudarte a volver con mas claridad para la siguiente prueba.",
      formatLabel: "Nota de repaso",
      story:
        "Los estudiantes fuertes de secundaria no responden preguntas sin parar. Se detienen, replantean el tema y vuelven con mejor concentracion.",
      teachingTitle: "Lo que esto ensena",
      teachingPoint: "Este descanso muestra que una pausa intencional puede mejorar la retencion y el control en examen.",
      reflection: "Antes de continuar, piensa que idea principal estaba evaluando el ultimo nivel.",
      facts: [
        "Las pausas cortas de repaso pueden mejorar la atencion.",
        "Entender la idea detras de una pregunta suele valer mas que memorizar una sola respuesta.",
      ],
      continueLabel: "Continuar el repaso",
    },
    "uni-academic-pause": {
      title: "Pausa academica: consolidar el concepto",
      intro: "Una pausa academica breve puede mejorar el recuerdo y el control conceptual.",
      formatLabel: "Reflexion de estudio",
      story:
        "El aprendizaje universitario no consiste solo en terminar preguntas. Tambien requiere consolidar ideas, aclarar definiciones y ver como los conceptos se conectan dentro de un curso.",
      teachingTitle: "Lo que esto ensena",
      teachingPoint: "Esta pausa muestra que el estudio superior mejora cuando el estudiante organiza el conocimiento en lugar de acumular respuestas.",
      reflection: "Antes de seguir, resume la idea principal del ultimo nivel en una frase precisa.",
      facts: [
        "La consolidacion conceptual mejora la retencion a largo plazo.",
        "Las definiciones claras y las relaciones importan en el estudio universitario.",
      ],
      continueLabel: "Continuar la sesion de estudio",
    },
    "uni-law-reasoning": {
      title: "Pausa de derecho: asunto, regla y aplicacion",
      intro: "Una breve pausa juridica puede afinar tu razonamiento antes del siguiente bloque.",
      formatLabel: "Metodo juridico",
      story:
        "Las preguntas de derecho se vuelven mas claras cuando separas el asunto juridico, identificas la regla aplicable y la aplicas con cuidado a los hechos. El razonamiento juridico solido no depende solo de la memoria.",
      teachingTitle: "Lo que esto ensena",
      teachingPoint: "Esta pausa ensena el movimiento central del analisis juridico: asunto, regla y aplicacion.",
      reflection: "En la siguiente pregunta, identifica primero el verdadero problema juridico.",
      facts: [
        "El estudio del derecho depende del analisis de hechos y principios.",
        "Un metodo claro suele mejorar la rapidez y la precision.",
      ],
      continueLabel: "Volver a derecho",
    },
  },
  pt: {
    "general-reset": {
      title: "Pausa de aprendizagem: ler, respirar e continuar",
      intro: "Uma pausa curta pode ajudar-te a voltar com mais foco.",
      formatLabel: "Pausa de estudo",
      story:
        "Bons estudantes nao apenas trabalham muito. Tambem sabem pausar com sabedoria. Uma pausa guiada da ao cerebro tempo para se reorganizar sem se desligar da aprendizagem.",
      teachingTitle: "O que isto ensina",
      teachingPoint: "Isto mostra que descanso e reflexao fazem parte de bons habitos de estudo.",
      reflection: "Respira com calma e volta ao proximo desafio com a mente mais fresca.",
      facts: [
        "Pausas curtas podem melhorar a concentracao.",
        "A reflexao ajuda a manter a informacao por mais tempo na memoria.",
      ],
      continueLabel: "Continuar a aprender",
    },
    "arith-patterns": {
      title: "Pausa de matematica: encontra o padrao",
      intro: "Esta pausa da ao teu cerebro outro tipo de desafio matematico.",
      formatLabel: "Nota sobre padroes",
      story:
        "2, 4, 8, 16... um padrao como este cresce ao dobrar em cada passo. Na aritmetica, os padroes ajudam o estudante a prever o que vem a seguir sem recomecar todo o raciocinio.",
      teachingTitle: "O que isto ensina",
      teachingPoint: "Esta nota mostra que a aritmetica nao e apenas calculo. Ela tambem envolve ver estrutura e regras repetidas.",
      reflection: "Antes da proxima pergunta, pensa se existe um atalho ou um padrao escondido.",
      facts: [
        "Os padroes ajudam na multiplicacao, divisao e calculo mental.",
        "Um bom estudante procura primeiro a estrutura.",
      ],
      continueLabel: "Continuar com aritmetica",
    },
    "eng-poem-rain": {
      title: "Pausa de ingles: um poema curto",
      intro: "Faz uma curta pausa de leitura com este poema.",
      formatLabel: "Poema",
      story:
        "A chuva toca o telhado devagar,\nGota a gota sem parar.\nAs nuvens podem o sol esconder,\nMas toda tempestade vai ceder.",
      teachingTitle: "O que este poema ensina",
      teachingPoint: "Este poema ajuda o estudante a notar ritmo, rima e ambiente na poesia.",
      reflection: "Quando voltares as perguntas de ingles, observa como as palavras criam sentido e som.",
      facts: [
        "Poemas usam ritmo e rima para tornar ideias memoraveis.",
        "Um poema curto pode ensinar vocabulario e atmosfera ao mesmo tempo.",
      ],
      continueLabel: "Continuar com ingles",
    },
    "hist-timeline": {
      title: "Pausa de historia: por que a linha do tempo importa",
      intro: "Faz uma curta pausa com esta habilidade de historia.",
      formatLabel: "Habilidade historica",
      story:
        "Quando os acontecimentos sao colocados na ordem certa, a historia torna-se mais facil de entender. Uma linha do tempo ajuda a ver o que aconteceu primeiro, o que veio depois e como um acontecimento influenciou outro.",
      teachingTitle: "O que isto ensina",
      teachingPoint: "Esta pausa ensina cronologia, uma habilidade central do pensamento historico.",
      reflection: "Na proxima pergunta, pensa em sequencia, causa e efeito.",
      facts: [
        "A cronologia ajuda a compreender a mudanca ao longo do tempo.",
        "A historia torna-se mais clara quando os acontecimentos sao bem organizados.",
      ],
      continueLabel: "Continuar com historia",
    },
    "teens-exam-reset": {
      title: "Pausa de revisao: respira e reenquadra",
      intro: "Uma pausa breve pode ajudar-te a voltar com mais clareza para o proximo teste.",
      formatLabel: "Nota de revisao",
      story:
        "Os estudantes fortes do ensino secundario nao respondem a perguntas sem parar. Eles param, reenquadram o tema e regressam com melhor concentracao.",
      teachingTitle: "O que isto ensina",
      teachingPoint: "Esta pausa mostra que uma interrupcao intencional pode melhorar a retencao e o controlo em exame.",
      reflection: "Antes de continuares, pensa qual era a ideia principal avaliada no ultimo nivel.",
      facts: [
        "Pausas curtas de revisao podem melhorar a atencao.",
        "Compreender a ideia por tras da pergunta vale muitas vezes mais do que memorizar uma unica resposta.",
      ],
      continueLabel: "Continuar a revisao",
    },
    "uni-academic-pause": {
      title: "Pausa academica: consolidar o conceito",
      intro: "Uma curta pausa academica pode melhorar a recordacao e o controlo conceptual.",
      formatLabel: "Reflexao de estudo",
      story:
        "A aprendizagem universitaria nao consiste apenas em terminar perguntas. Tambem exige consolidar ideias, clarificar definicoes e ver como os conceitos se ligam num curso.",
      teachingTitle: "O que isto ensina",
      teachingPoint: "Esta pausa mostra que o ensino superior melhora quando o estudante organiza o conhecimento em vez de acumular respostas.",
      reflection: "Antes de continuar, resume a ideia principal do ultimo nivel numa frase precisa.",
      facts: [
        "A consolidacao conceptual melhora a retencao a longo prazo.",
        "Definicoes claras e relacoes entre ideias sao importantes no ensino superior.",
      ],
      continueLabel: "Continuar a sessao de estudo",
    },
    "uni-law-reasoning": {
      title: "Pausa de direito: questao, regra e aplicacao",
      intro: "Uma breve pausa juridica pode afinar o teu raciocinio antes da proxima serie.",
      formatLabel: "Metodo juridico",
      story:
        "As perguntas de direito ficam mais claras quando separas a questao juridica, identificas a regra aplicavel e a aplicas com cuidado aos factos. O raciocinio juridico solido nao depende apenas da memoria.",
      teachingTitle: "O que isto ensina",
      teachingPoint: "Esta pausa ensina o movimento central da analise juridica: questao, regra e aplicacao.",
      reflection: "Na proxima pergunta, identifica primeiro qual e o verdadeiro problema juridico.",
      facts: [
        "O estudo do direito depende da analise de factos e principios.",
        "Um metodo claro melhora muitas vezes a rapidez e a precisao.",
      ],
      continueLabel: "Voltar ao direito",
    },
  },
  sw: {
    "general-reset": {
      title: "Mapumziko ya kujifunza: soma, pumua, endelea",
      intro: "Mapumziko mafupi yanaweza kukusaidia kurudi ukiwa makini zaidi.",
      formatLabel: "Mapumziko ya kusoma",
      story:
        "Wanafunzi wazuri hawafanyi kazi kwa bidii tu. Pia wanajua kupumzika kwa busara. Mapumziko haya huipa akili nafasi ya kujipanga upya bila kuacha mwelekeo wa kujifunza.",
      teachingTitle: "Hiki kinafundisha nini",
      teachingPoint: "Hii inaonyesha kuwa kupumzika na kutafakari ni sehemu ya tabia nzuri za kusoma.",
      reflection: "Pumua kwa utulivu kisha rudi kwenye changamoto inayofuata ukiwa mwepesi zaidi kiakili.",
      facts: [
        "Mapumziko mafupi yanaweza kuboresha umakini.",
        "Kutafakari husaidia taarifa kukaa kwa muda mrefu kwenye kumbukumbu.",
      ],
      continueLabel: "Endelea kujifunza",
    },
    "arith-patterns": {
      title: "Pumziko la hesabu: tambua muundo",
      intro: "Pumziko hili linaipa akili yako aina nyingine ya changamoto ya hesabu.",
      formatLabel: "Dokezo la muundo",
      story:
        "2, 4, 8, 16... muundo kama huu hukua kwa kuongezeka maradufu kila hatua. Katika hesabu, miundo humsaidia mwanafunzi kutabiri kinachofuata bila kuanza upya kila mara.",
      teachingTitle: "Hiki kinafundisha nini",
      teachingPoint: "Dokezo hili linaonyesha kuwa hesabu si kufanya mahesabu tu. Pia inahusisha kuona mpangilio na kanuni zinazorudiwa.",
      reflection: "Kabla ya swali linalofuata, jiulize kama kuna njia ya mkato au muundo uliojificha.",
      facts: [
        "Miundo husaidia katika kuzidisha, kugawa na hesabu za haraka.",
        "Mwanafunzi mzuri hutafuta mpangilio kwanza.",
      ],
      continueLabel: "Endelea na hesabu",
    },
    "eng-poem-rain": {
      title: "Pumziko la Kiingereza: shairi fupi",
      intro: "Chukua mapumziko mafupi ya usomaji kwa shairi hili.",
      formatLabel: "Shairi",
      story:
        "Mvua yapiga paa taratibu,\nTone kwa tone kwa sauti hafifu.\nMawingu yaweza jua kuficha,\nLakini dhoruba nayo huisha.",
      teachingTitle: "Shairi hili linafundisha nini",
      teachingPoint: "Shairi hili humsaidia mwanafunzi kuona mpigo, vina na hali ya kishairi.",
      reflection: "Ukirudi kwenye maswali ya Kiingereza, angalia jinsi maneno yanavyounda maana na sauti.",
      facts: [
        "Mashairi hutumia mpigo na vina kufanya mawazo yakumbukike.",
        "Shairi fupi linaweza kufundisha msamiati na hisia kwa wakati mmoja.",
      ],
      continueLabel: "Endelea na Kiingereza",
    },
    "hist-timeline": {
      title: "Pumziko la historia: kwa nini mfuatano wa wakati ni muhimu",
      intro: "Pumzika kidogo kwa stadi hii ya historia.",
      formatLabel: "Stadi ya historia",
      story:
        "Matukio yanapowekwa katika mpangilio sahihi, historia huwa rahisi kuelewa. Mfuatano wa wakati humsaidia mwanafunzi kuona nini kilitokea kwanza, kilichofuata na jinsi tukio moja lilivyoathiri jingine.",
      teachingTitle: "Hiki kinafundisha nini",
      teachingPoint: "Mapumziko haya yanafundisha kronolojia, mojawapo ya stadi kuu za kufikiri kihistoria.",
      reflection: "Katika swali linalofuata, fikiria mpangilio, sababu na matokeo.",
      facts: [
        "Kronolojia husaidia kuelewa mabadiliko kwa muda.",
        "Historia huwa wazi zaidi matukio yanapopangwa vizuri.",
      ],
      continueLabel: "Endelea na historia",
    },
    "teens-exam-reset": {
      title: "Pumziko la marudio: pumua na panga upya",
      intro: "Mapumziko mafupi yanaweza kukusaidia kurudi ukiwa wazi zaidi kwa jaribio linalofuata.",
      formatLabel: "Dokezo la marudio",
      story:
        "Wanafunzi imara wa sekondari hawajibu maswali mfululizo bila kusimama. Wanasimama kidogo, wanapanga upya mada, kisha wanarudi wakiwa makini zaidi.",
      teachingTitle: "Hiki kinafundisha nini",
      teachingPoint: "Mapumziko haya yanaonyesha kuwa kusimama kwa makusudi kunaweza kuboresha kumbukumbu na udhibiti wa mtihani.",
      reflection: "Kabla ya kuendelea, jiulize wazo kuu lililokuwa linajaribiwa kwenye ngazi iliyopita.",
      facts: [
        "Mapumziko mafupi ya marudio yanaweza kuongeza umakini.",
        "Kuelewa wazo lililo nyuma ya swali ni bora kuliko kukariri jibu moja tu.",
      ],
      continueLabel: "Endelea na marudio",
    },
    "uni-academic-pause": {
      title: "Pumziko la kitaaluma: imarisha dhana",
      intro: "Pumziko fupi la kitaaluma linaweza kuboresha ukumbukaji na umiliki wa dhana.",
      formatLabel: "Tafakari ya masomo",
      story:
        "Masomo ya chuo kikuu si kumaliza maswali tu. Yanahitaji kuimarisha mawazo, kufafanua maana na kuona jinsi dhana zinavyoungana ndani ya kozi.",
      teachingTitle: "Hiki kinafundisha nini",
      teachingPoint: "Mapumziko haya yanaonyesha kuwa elimu ya juu huwa imara zaidi mwanafunzi anapopanga maarifa badala ya kukusanya majibu tu.",
      reflection: "Kabla ya kuendelea, fupisha wazo kuu la ngazi iliyopita katika sentensi moja sahihi.",
      facts: [
        "Kuimarisha dhana huongeza kumbukumbu ya muda mrefu.",
        "Maana wazi na uhusiano wa mawazo ni muhimu katika masomo ya juu.",
      ],
      continueLabel: "Endelea na kipindi cha kusoma",
    },
    "uni-law-reasoning": {
      title: "Pumziko la sheria: suala, kanuni na matumizi",
      intro: "Mapumziko mafupi ya kisheria yanaweza kunoa hoja zako kabla ya seti inayofuata.",
      formatLabel: "Mbinu ya kisheria",
      story:
        "Maswali ya sheria huwa wazi zaidi unapobainisha suala la kisheria, kanuni inayotumika na namna ya kuitumia kwa uangalifu kwenye ukweli wa kesi. Hoja nzuri ya sheria haitokani na kukariri pekee.",
      teachingTitle: "Hiki kinafundisha nini",
      teachingPoint: "Mapumziko haya yanafundisha hatua kuu ya uchambuzi wa sheria: suala, kanuni na matumizi.",
      reflection: "Katika swali linalofuata, tambua kwanza tatizo halisi la kisheria.",
      facts: [
        "Masomo ya sheria hutegemea uchambuzi wa ukweli na misingi.",
        "Mbinu iliyo wazi huongeza kasi na usahihi.",
      ],
      continueLabel: "Rudi kwenye sheria",
    },
  },
};

function localizeBreatherContent(content: BreatherContent, language: AppLanguage): BreatherContent {
  const localized = localizedBreatherOverrides[language]?.[content.id];
  if (!localized) {
    return content;
  }

  return {
    ...content,
    ...localized,
    facts: localized.facts ?? content.facts,
  };
}

function getVariantSubjectBreathers() {
  if (appVariant.id === "teens") {
    return teenSubjectBreathers;
  }

  if (appVariant.id === "uni") {
    return uniSubjectBreathers;
  }

  return childrenSubjectBreathers;
}

function getVariantGeneralBreathers() {
  if (appVariant.id === "teens") {
    return teenGeneralBreathers;
  }

  if (appVariant.id === "uni") {
    return uniGeneralBreathers;
  }

  return childrenGeneralBreathers;
}

export function getSubjectSuccessfulSessionCount(results: SessionResult[], subjectId: string) {
  return results.filter(
    (result) => result.subjectId === subjectId && result.score >= SCORE_THRESHOLD
  ).length;
}

export function shouldOfferBreather(results: SessionResult[], currentResult: SessionResult) {
  if (currentResult.score < SCORE_THRESHOLD) {
    return false;
  }

  const successfulSessionCount = getSubjectSuccessfulSessionCount(results, currentResult.subjectId);
  return successfulSessionCount >= BREATHER_INTERVAL && successfulSessionCount % BREATHER_INTERVAL === 0;
}

export function getBreatherContent(subjectId: string, level: number, successfulSessionCount: number, language: AppLanguage = "en") {
  const subjectBreathers = getVariantSubjectBreathers();
  const generalBreathers = getVariantGeneralBreathers();
  const candidates = subjectBreathers[subjectId] ?? generalBreathers;
  const indexSeed = Math.max(level * 2 + successfulSessionCount - 1, 0);
  const chosen = candidates[indexSeed % candidates.length] ?? generalBreathers[0];
  return localizeBreatherContent(chosen, language);
}
