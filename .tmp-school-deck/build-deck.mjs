import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "C:/Users/USER/Desktop/Quiks";
const TMP = `${ROOT}/.tmp-school-deck`;
const OUT_DIR = `${ROOT}/presentations`;
const OUT = `${OUT_DIR}/Quiks_School_Partnership_Presentation.pptx`;

const W = 1280;
const H = 720;
const M = 64;
const COLORS = {
  white: "#FFFFFF",
  ink: "#111827",
  navy: "#0F2130",
  teal: "#159A8C",
  tealPale: "#E7F6F3",
  purple: "#7C2BC4",
  purplePale: "#F4EAFB",
  blue: "#3D8DFF",
  bluePale: "#EAF4FF",
  gold: "#E3A62F",
  goldPale: "#FFF5DA",
  gray: "#5F6B76",
  panel: "#F0F2F4",
  line: "#CCD3D9",
};

async function bytes(filePath) {
  const data = await fs.readFile(filePath);
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}

function addText(slide, name, text, left, top, width, height, options = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: options.fontSize ?? 20,
    typeface: options.typeface ?? "Arial",
    color: options.color ?? COLORS.ink,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    alignment: options.alignment ?? "left",
    verticalAlignment: options.verticalAlignment ?? "top",
    autoFit: options.autoFit ?? "shrinkText",
    wrap: "square",
    insets: options.insets ?? { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return shape;
}

function addPanel(slide, name, left, top, width, height, fill = COLORS.panel, line = "none") {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position: { left, top, width, height },
    fill,
    line: line === "none" ? { style: "solid", fill: "none", width: 0 } : { style: "solid", fill: line, width: 1 },
  });
}

function addRule(slide, left, top, width, fill = COLORS.line, height = 2) {
  return addPanel(slide, `rule-${left}-${top}`, left, top, width, height, fill);
}

function addSlideTitle(slide, title, kicker, number) {
  addText(slide, `kicker-${number}`, kicker.toUpperCase(), M, 34, 420, 24, {
    fontSize: 14, color: COLORS.teal, bold: true,
  });
  addText(slide, `title-${number}`, title, M, 66, 1120, 74, {
    fontSize: 38, color: COLORS.navy, bold: true,
  });
  addText(slide, `page-${number}`, String(number).padStart(2, "0"), 1180, 666, 36, 18, {
    fontSize: 12, color: COLORS.gray, alignment: "right",
  });
}

function addLabel(slide, name, text, left, top, width, color = COLORS.teal) {
  addText(slide, name, text.toUpperCase(), left, top, width, 24, {
    fontSize: 14, color, bold: true,
  });
}

function addBullet(slide, name, title, body, left, top, width, accent = COLORS.teal) {
  addPanel(slide, `${name}-marker`, left, top + 7, 10, 10, accent);
  addText(slide, `${name}-title`, title, left + 25, top, width - 25, 28, {
    fontSize: 20, color: COLORS.navy, bold: true,
  });
  addText(slide, `${name}-body`, body, left + 25, top + 31, width - 25, 58, {
    fontSize: 17, color: COLORS.gray,
  });
}

async function addImage(slide, name, filePath, alt, position, fit = "contain") {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return slide.images.add({
    blob: await bytes(filePath),
    contentType,
    alt,
    fit,
    position,
  });
}

function addNotes(slide, extraSources = []) {
  const sources = [
    "C:\\Users\\USER\\Downloads\\Quiks_School_Partnership_Proposal.docx",
    ...extraSources,
  ];
  slide.speakerNotes.textFrame.setText([
    "[Sources]",
    ...sources.map((source) => `- ${source}`),
    "[/Sources]",
  ]);
}

function addStep(slide, number, title, body, left, top, width, accent) {
  slide.shapes.add({
    geometry: "ellipse",
    name: `step-${number}-number`,
    position: { left, top, width: 54, height: 54 },
    fill: accent,
    line: { style: "solid", fill: "none", width: 0 },
  });
  addText(slide, `step-${number}-number-text`, String(number), left, top + 7, 54, 34, {
    fontSize: 22, color: COLORS.white, bold: true, alignment: "center",
  });
  addText(slide, `step-${number}-title`, title, left, top + 76, width, 34, {
    fontSize: 21, color: COLORS.navy, bold: true,
  });
  addText(slide, `step-${number}-body`, body, left, top + 116, width, 88, {
    fontSize: 17, color: COLORS.gray,
  });
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(`${TMP}/renders`, { recursive: true });

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  // 1 — cover, inspired by Codex Grid slide 08.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addPanel(slide, "cover-accent-field", 772, 0, 508, 720, COLORS.tealPale);
    addPanel(slide, "cover-purple-strip", 772, 0, 20, 720, COLORS.purple);
    await addImage(slide, "tsp-logo", `${TMP}/logo-tsp.png`, "Tech Solution Providers logo", { left: 66, top: 40, width: 370, height: 107 });
    addText(slide, "cover-title", "A smarter learning partnership for your students", 66, 207, 650, 205, {
      fontSize: 54, color: COLORS.navy, bold: true,
    });
    addText(slide, "cover-subtitle", "Quiks helps schools extend structured practice, revision and teacher-guided learning beyond the classroom.", 70, 438, 604, 95, {
      fontSize: 23, color: COLORS.gray,
    });
    addText(slide, "cover-school", "PROPOSAL TO [SCHOOL NAME]", 70, 590, 540, 30, {
      fontSize: 16, color: COLORS.teal, bold: true,
    });
    addText(slide, "cover-tagline", "QUIKS  |  LEARN FAST. GROW STEADILY.", 828, 536, 385, 56, {
      fontSize: 22, color: COLORS.navy, bold: true, alignment: "center",
    });
    addText(slide, "cover-prepared", "Prepared by Tech Solution Providers Ltd", 828, 606, 385, 24, {
      fontSize: 15, color: COLORS.gray, alignment: "center",
    });
    addNotes(slide, ["C:\\Users\\USER\\Desktop\\Tech Solutions\\logo-tsp.svg"]);
  }

  // 2 — why the partnership matters.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "Learning should continue after the lesson ends", "The opportunity", 2);
    addText(slide, "why-lead", "A school builds excellence when students have the structure and motivation to keep learning between lessons.", M, 178, 740, 112, {
      fontSize: 29, color: COLORS.navy, bold: true,
    });
    addRule(slide, M, 320, 720, COLORS.teal, 4);
    addBullet(slide, "why-1", "Continuity", "Teacher-led learning can carry from the classroom into homework, revision and independent study.", M, 358, 700);
    addBullet(slide, "why-2", "Confidence", "Regular, guided practice helps learners confront difficult topics and build stronger study habits.", M, 462, 700, COLORS.purple);
    addBullet(slide, "why-3", "School-wide value", "Students progress, teachers strengthen digital practice, and parents gain a more purposeful learning option at home.", M, 566, 700, COLORS.gold);
    addPanel(slide, "why-side-panel", 864, 178, 352, 430, COLORS.navy);
    addText(slide, "why-side-quote", "Quiks is designed to complement good teaching—not replace it.", 908, 235, 265, 170, {
      fontSize: 32, color: COLORS.white, bold: true,
    });
    addText(slide, "why-side-body", "It gives students a guided route to practise, understand and progress while keeping teachers central to the learning process.", 908, 435, 265, 116, {
      fontSize: 18, color: "#DDE8EE",
    });
    addNotes(slide);
  }

  // 3 — guided learning loop.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "Quiks turns independent study into a guided learning loop", "How it works", 3);
    addRule(slide, 120, 276, 1040, COLORS.line, 2);
    const steps = [
      ["Choose the focus", "Select subject, topic, class, curriculum or target examination."],
      ["Practise", "Complete relevant questions in training, revision or challenge modes."],
      ["Understand", "Use explanations and Learn More to close knowledge gaps."],
      ["Progress", "Advance through levels, track activity and earn certificates."],
    ];
    const accents = [COLORS.teal, COLORS.blue, COLORS.purple, COLORS.gold];
    steps.forEach(([title, body], index) => addStep(slide, index + 1, title, body, 88 + index * 300, 248, 232, accents[index]));
    addPanel(slide, "loop-bottom", 64, 550, 1152, 76, COLORS.tealPale);
    addText(slide, "loop-bottom-text", "Available on mobile and web, with signed-in learner profiles designed to preserve continuity across devices within each Quiks variant.", 96, 570, 1088, 40, {
      fontSize: 18, color: COLORS.navy, alignment: "center", bold: true,
    });
    addNotes(slide);
  }

  // 4 — student experience, Codex Grid three-column silhouette.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "Students get more than questions—they get a pathway", "Student experience", 4);
    const columns = [
      ["PRACTISE", "Curriculum- and exam-aware questions support focused revision and regular independent study.", COLORS.tealPale, COLORS.teal],
      ["UNDERSTAND", "Answer explanations, Learn More and the Learning Hub turn mistakes into opportunities to learn.", COLORS.bluePale, COLORS.blue],
      ["STAY MOTIVATED", "Levels, certificates, competitions and controlled Breathers reward persistence without losing academic focus.", COLORS.purplePale, COLORS.purple],
    ];
    columns.forEach(([label, body, fill, accent], index) => {
      const left = 64 + index * 392;
      addPanel(slide, `student-panel-${index}`, left, 196, 352, 410, fill);
      addPanel(slide, `student-bar-${index}`, left, 196, 352, 12, accent);
      addText(slide, `student-label-${index}`, label, left + 30, 244, 292, 38, {
        fontSize: 19, color: accent, bold: true,
      });
      addText(slide, `student-body-${index}`, body, left + 30, 307, 292, 190, {
        fontSize: 23, color: COLORS.navy, bold: true,
      });
    });
    addNotes(slide);
  }

  // 5 — teacher digital classroom.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "Teachers gain a practical digital classroom", "Teacher value", 5);
    addText(slide, "teacher-lead", "Classroom tools help teachers organise learning beyond the physical classroom while retaining control of the academic focus.", M, 170, 1100, 70, {
      fontSize: 24, color: COLORS.gray,
    });
    const items = [
      ["01", "Create and organise classes", "Set up a class around the students and learning objective."],
      ["02", "Generate tests and assignments", "Choose the subject and topic, then create an activity for learners."],
      ["03", "Invite students securely", "Share a class code or invitation link for students to join."],
      ["04", "Review participation and results", "Use submissions and results to reinforce, reteach or extend learning."],
    ];
    items.forEach(([num, title, body], index) => {
      const top = 275 + index * 86;
      addText(slide, `teacher-num-${index}`, num, 78, top, 58, 38, { fontSize: 24, color: COLORS.teal, bold: true });
      addText(slide, `teacher-title-${index}`, title, 160, top, 430, 34, { fontSize: 21, color: COLORS.navy, bold: true });
      addText(slide, `teacher-body-${index}`, body, 615, top, 555, 42, { fontSize: 18, color: COLORS.gray });
      if (index < items.length - 1) addRule(slide, 160, top + 64, 1010, COLORS.line, 1);
    });
    addNotes(slide);
  }

  // 6 — engagement features.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "Engagement stays purposeful and academically focused", "Motivation", 6);
    addText(slide, "engagement-lead", "Quiks adds variety to practice without turning learning into unrestricted screen time.", M, 170, 1080, 56, { fontSize: 25, color: COLORS.gray });
    const rows = [
      ["Competition Arena", "One-to-one challenges make retrieval practice social and goal-oriented.", COLORS.teal],
      ["Group Competition", "A teacher or learner creates a timed challenge that multiple participants join by code or link.", COLORS.purple],
      ["Certificates", "Completing a grade in a subject creates a visible milestone that reflects excellence and speed.", COLORS.blue],
      ["Controlled Breathers", "After three successful sessions, one short text or lightweight game break helps reduce fatigue before learning resumes.", COLORS.gold],
    ];
    rows.forEach(([title, body, accent], index) => {
      const top = 260 + index * 92;
      addPanel(slide, `engagement-accent-${index}`, 72, top, 12, 66, accent);
      addText(slide, `engagement-title-${index}`, title, 112, top, 300, 34, { fontSize: 22, color: COLORS.navy, bold: true });
      addText(slide, `engagement-body-${index}`, body, 440, top, 740, 60, { fontSize: 18, color: COLORS.gray });
    });
    addNotes(slide);
  }

  // 7 — ecosystem value, three-column layout.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "One platform supports the whole school community", "Shared value", 7);
    const groups = [
      ["STUDENTS", ["Purposeful independent study", "Explanation-led revision", "Visible progress and motivation"], COLORS.tealPale, COLORS.teal],
      ["TEACHERS", ["Digital class organisation", "Faster activity creation", "Clearer follow-up on participation"], COLORS.bluePale, COLORS.blue],
      ["PARENTS", ["A productive home-learning option", "Greater continuity with schoolwork", "A clearer view of learner progress"], COLORS.goldPale, COLORS.gold],
    ];
    groups.forEach(([name, bullets, fill, accent], index) => {
      const left = 64 + index * 392;
      addPanel(slide, `group-${index}`, left, 192, 352, 420, fill);
      addText(slide, `group-name-${index}`, name, left + 28, 230, 296, 36, { fontSize: 20, color: accent, bold: true });
      bullets.forEach((text, bulletIndex) => {
        const top = 310 + bulletIndex * 88;
        addPanel(slide, `group-marker-${index}-${bulletIndex}`, left + 30, top + 8, 9, 9, accent);
        addText(slide, `group-text-${index}-${bulletIndex}`, text, left + 56, top, 258, 54, { fontSize: 20, color: COLORS.navy, bold: true });
      });
    });
    addNotes(slide);
  }

  // 8 — use cases, 2x2 layout.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "Four school routines where Quiks adds immediate value", "Use cases", 8);
    const cases = [
      ["Homework & consolidation", "Set focused practice after a taught topic, supported by explanations and Learn More."],
      ["Exam preparation", "Run regular revision around priority subjects, curricula and target examinations."],
      ["Intervention", "Give learners additional class-appropriate practice in areas where they need support."],
      ["Enrichment", "Use the Learning Hub and competitions in clubs, holiday programmes or extension work."],
    ];
    cases.forEach(([title, body], index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const left = 64 + col * 584;
      const top = 188 + row * 226;
      addPanel(slide, `case-${index}`, left, top, 536, 190, row === 0 ? COLORS.tealPale : COLORS.purplePale);
      addText(slide, `case-number-${index}`, `0${index + 1}`, left + 28, top + 26, 55, 32, { fontSize: 20, color: col === 0 ? COLORS.teal : COLORS.purple, bold: true });
      addText(slide, `case-title-${index}`, title, left + 104, top + 24, 392, 40, { fontSize: 22, color: COLORS.navy, bold: true });
      addText(slide, `case-body-${index}`, body, left + 104, top + 81, 390, 80, { fontSize: 18, color: COLORS.gray });
    });
    addNotes(slide);
  }

  // 9 — practical workflow, timeline silhouette.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "Teachers lead a simple four-step learning cycle", "School workflow", 9);
    addRule(slide, 120, 330, 1040, COLORS.navy, 3);
    const steps = [
      ["Define", "Choose the subject, topic, class or examination objective."],
      ["Create", "Set the Classroom activity and share access."],
      ["Learn", "Students practise, review explanations and explore further."],
      ["Respond", "Review results, then reinforce, reteach or extend."],
    ];
    steps.forEach(([title, body], index) => {
      const left = 90 + index * 300;
      const accent = [COLORS.teal, COLORS.blue, COLORS.purple, COLORS.gold][index];
      slide.shapes.add({ geometry: "ellipse", name: `timeline-dot-${index}`, position: { left: left + 36, top: 310, width: 42, height: 42 }, fill: accent, line: { style: "solid", fill: COLORS.white, width: 3 } });
      addText(slide, `timeline-stage-${index}`, title.toUpperCase(), left, 225, 210, 32, { fontSize: 18, color: accent, bold: true });
      addText(slide, `timeline-body-${index}`, body, left, 390, 220, 120, { fontSize: 19, color: COLORS.navy, bold: true });
    });
    addPanel(slide, "workflow-note", 64, 568, 1152, 65, COLORS.panel);
    addText(slide, "workflow-note-text", "Quiks supports the cycle; the teacher remains responsible for curriculum alignment, professional judgement and learner support.", 100, 586, 1080, 30, { fontSize: 17, color: COLORS.gray, alignment: "center" });
    addNotes(slide);
  }

  // 10 — pilot recommendation.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.white;
    addSlideTitle(slide, "Start small, learn quickly, then scale with confidence", "Pilot recommendation", 10);
    addText(slide, "pilot-lead", "A controlled pilot lets the school test curriculum fit, teacher workflow and learner engagement before making a wider recommendation.", M, 166, 1080, 72, { fontSize: 25, color: COLORS.gray });
    const phases = [
      ["1", "Orient teachers", "Introduce the Quiks features and agree how they will support existing teaching."],
      ["2", "Select the cohort", "Nominate a school representative, teacher champions and a learner group."],
      ["3", "Run the pilot", "Use agreed subjects and routines for a defined period within the school calendar."],
      ["4", "Review and decide", "Gather structured teacher and learner feedback before broader deployment."],
    ];
    phases.forEach(([num, title, body], index) => {
      const left = 64 + index * 292;
      addText(slide, `pilot-num-${index}`, num, left, 288, 50, 58, { fontSize: 44, color: index % 2 ? COLORS.purple : COLORS.teal, bold: true });
      addRule(slide, left, 365, 235, index % 2 ? COLORS.purple : COLORS.teal, 4);
      addText(slide, `pilot-title-${index}`, title, left, 396, 235, 52, { fontSize: 22, color: COLORS.navy, bold: true });
      addText(slide, `pilot-body-${index}`, body, left, 466, 235, 120, { fontSize: 17, color: COLORS.gray });
    });
    addNotes(slide);
  }

  // 11 — action close.
  {
    const slide = presentation.slides.add();
    slide.background.fill = COLORS.navy;
    addPanel(slide, "closing-logo-backing", 54, 26, 400, 138, COLORS.white);
    await addImage(slide, "closing-tsp-logo", `${TMP}/logo-tsp.png`, "Tech Solution Providers logo", { left: 70, top: 42, width: 368, height: 106 });
    addText(slide, "closing-kicker", "PROPOSED NEXT STEP", 70, 210, 440, 30, { fontSize: 16, color: "#8FE2D7", bold: true });
    addText(slide, "closing-title", "Schedule a 20-minute demonstration and scoping conversation", 70, 260, 760, 165, { fontSize: 46, color: COLORS.white, bold: true });
    addText(slide, "closing-body", "Together, we can identify the right Quiks variant, priority use case and an agreed route to teacher onboarding and school-wide recommendation.", 72, 464, 720, 95, { fontSize: 22, color: "#DCE7EC" });
    addPanel(slide, "closing-contact", 850, 198, 352, 370, COLORS.white);
    addLabel(slide, "closing-contact-label", "Contact", 890, 240, 280, COLORS.teal);
    addText(slide, "closing-name", "Engr. Onah Matthew", 890, 298, 280, 44, { fontSize: 22, color: COLORS.navy, bold: true });
    addText(slide, "closing-role", "President / CEO", 890, 346, 280, 28, { fontSize: 17, color: COLORS.gray });
    addRule(slide, 890, 396, 270, COLORS.line, 1);
    addText(slide, "closing-email", "quiks@techsolutionproviders.net", 890, 426, 280, 48, { fontSize: 15, color: COLORS.navy, bold: true });
    addText(slide, "closing-phone", "0803 216 0201", 890, 496, 280, 30, { fontSize: 18, color: COLORS.teal, bold: true });
    addText(slide, "closing-tagline", "Quiks: Learn fast. Grow steadily.", 72, 640, 620, 28, { fontSize: 18, color: "#8FE2D7", bold: true });
    addNotes(slide, ["C:\\Users\\USER\\Desktop\\Tech Solutions\\logo-tsp.svg"]);
  }

  // Render all slides and layout snapshots for QA.
  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `slide-${String(index + 1).padStart(2, "0")}`;
    const png = await presentation.export({ slide, format: "png", scale: 1 });
    await fs.writeFile(`${TMP}/renders/${stem}.png`, new Uint8Array(await png.arrayBuffer()));
    const layout = await slide.export({ format: "layout" });
    await fs.writeFile(`${TMP}/renders/${stem}.layout.json`, await layout.text());
  }
  const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
  await fs.writeFile(`${TMP}/renders/deck-montage.webp`, new Uint8Array(await montage.arrayBuffer()));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(OUT);
  console.log(OUT);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
