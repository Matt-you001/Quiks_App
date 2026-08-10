import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { DemoAdBanner } from "../components/DemoAdBanner";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { canShowAds } from "../lib/ads";
import { createMemoryDeck, getBreatherActivity } from "../lib/breather-activities";
import { getBreatherContent } from "../lib/breathers";
import { t } from "../lib/i18n";
import { GRADE_LEVEL_COUNT } from "../lib/quiz";
import { readAppState } from "../lib/storage";
import { getSubjectById } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import { generateBreather } from "../services/ai";
import type { AppLanguage, BreatherContent, Difficulty, SubscriptionTier, TestMode, UserProfile } from "../types/app";

const allowedDifficulties: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

export default function BreatherScreen() {
  const params = useLocalSearchParams<{
    subjectId?: string;
    subjectName?: string;
    level?: string;
    grade?: string;
    mode?: TestMode;
    difficulty?: Difficulty;
    nextDifficulty?: string;
    successfulSessionCount?: string;
    streak?: string;
    focusMode?: "general" | "topic";
    topicId?: string;
    topicLabel?: string;
  }>();
  const { width } = useWindowDimensions();
  const level = Number(params.level ?? 1);
  const successfulSessionCount = Number(params.successfulSessionCount ?? params.streak ?? 0);
  const mode: TestMode = params.mode === "training" ? "training" : "quiz";
  const difficulty = params.difficulty && allowedDifficulties.includes(params.difficulty) ? params.difficulty : "Beginner";
  const nextDifficulty =
    params.nextDifficulty && !Array.isArray(params.nextDifficulty) && allowedDifficulties.includes(params.nextDifficulty as Difficulty)
      ? (params.nextDifficulty as Difficulty)
      : difficulty;
  const activity = useMemo(
    () => getBreatherActivity(level, successfulSessionCount),
    [level, successfulSessionCount]
  );
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("free");
  const [content, setContent] = useState<BreatherContent | null>(null);
  const [activityMessage, setActivityMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [sudokuValues, setSudokuValues] = useState<number[]>(activity.kind === "sudoku" ? [...activity.puzzle] : []);
  const [openCards, setOpenCards] = useState<number[]>([]);
  const [matchedSymbols, setMatchedSymbols] = useState<string[]>([]);
  const [wordAnswer, setWordAnswer] = useState("");
  const [breathingStarted, setBreathingStarted] = useState(false);
  const [breathingRemaining, setBreathingRemaining] = useState(activity.kind === "breathe" ? activity.durationSeconds : 0);

  const resolvedSubject = useMemo(() => getSubjectById(params.subjectId, language), [language, params.subjectId]);
  const subject = resolvedSubject ?? (params.subjectName ? { name: params.subjectName } : null);
  const fallbackContent = useMemo(
    () => getBreatherContent(params.subjectId ?? "", level, successfulSessionCount, language),
    [language, level, params.subjectId, successfulSessionCount]
  );
  const memoryDeck = useMemo(
    () => activity.kind === "memory" ? createMemoryDeck(activity.symbols, level * 31 + successfulSessionCount) : [],
    [activity, level, successfulSessionCount]
  );
  const sudokuBoardWidth = Math.min(width - 72, 430);

  useEffect(() => {
    readAppState().then((state) => {
      const activeProfile = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
      setLanguage(activeProfile?.language ?? "en");
      setProfile(activeProfile);
      setSubscriptionTier(state.subscriptionTier);
    });
  }, []);

  useEffect(() => {
    if (activity.kind !== "read") {
      setContent(null);
      return;
    }

    if (!params.subjectId || !resolvedSubject || !profile) {
      setContent(fallbackContent);
      return;
    }

    let cancelled = false;
    setContent(fallbackContent);
    generateBreather({
      subject: resolvedSubject,
      grade: typeof params.grade === "string" ? params.grade : "Unknown",
      level,
      successfulSessionCount,
      mode,
      difficulty,
      focusMode: params.focusMode === "topic" ? "topic" : "general",
      topicId: typeof params.topicId === "string" ? params.topicId : undefined,
      topicLabel: typeof params.topicLabel === "string" ? params.topicLabel : undefined,
      profile,
    })
      .then((nextContent) => {
        if (!cancelled) setContent(nextContent);
      })
      .catch(() => {
        if (!cancelled) setContent(fallbackContent);
      });

    return () => {
      cancelled = true;
    };
  }, [activity.kind, difficulty, fallbackContent, level, mode, params.focusMode, params.grade, params.subjectId, params.topicId, params.topicLabel, profile, resolvedSubject, successfulSessionCount]);

  useEffect(() => {
    if (activity.kind !== "memory" || openCards.length !== 2) return;

    const [firstIndex, secondIndex] = openCards;
    const first = memoryDeck[firstIndex];
    const second = memoryDeck[secondIndex];
    const matched = Boolean(first && second && first.symbol === second.symbol);
    const timeout = setTimeout(() => {
      if (matched && first) {
        setMatchedSymbols((current) => {
          const next = current.includes(first.symbol) ? current : [...current, first.symbol];
          if (next.length === activity.symbols.length) {
            setCompleted(true);
            setActivityMessage(t(language, "wellDone"));
          }
          return next;
        });
      } else {
        setActivityMessage(t(language, "tryAgain"));
      }
      setOpenCards([]);
    }, matched ? 350 : 700);

    return () => clearTimeout(timeout);
  }, [activity, language, memoryDeck, openCards]);

  useEffect(() => {
    if (activity.kind !== "breathe" || !breathingStarted || breathingRemaining <= 0) return;
    const timer = setInterval(() => {
      setBreathingRemaining((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setCompleted(true);
          setActivityMessage(t(language, "wellDone"));
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activity.kind, breathingRemaining, breathingStarted, language]);

  const heroEyebrow =
    appVariant.id === "uni" ? t(language, "studyBreather") : appVariant.id === "teens" ? t(language, "revisionBreather") : t(language, "learningBreather");

  const continueLearning = () => {
    if (level >= GRADE_LEVEL_COUNT) {
      router.replace({ pathname: "/subject/[slug]", params: { slug: params.subjectId } } as never);
      return;
    }
    router.replace({
      pathname: "/session",
      params: {
        subjectId: params.subjectId,
        mode,
        level: String(level + 1),
        grade: params.grade,
        difficulty: nextDifficulty,
        focusMode: params.focusMode,
        topicId: params.topicId,
        autoStart: "1",
      },
    });
  };

  const selectMemoryCard = (index: number) => {
    const card = memoryDeck[index];
    if (!card || openCards.includes(index) || matchedSymbols.includes(card.symbol) || openCards.length >= 2) return;
    setActivityMessage("");
    setOpenCards((current) => [...current, index]);
  };

  const enterSudokuValue = (value: number) => {
    if (activity.kind !== "sudoku" || selectedCell === null || activity.puzzle[selectedCell] !== 0) return;
    setSudokuValues((current) => current.map((entry, index) => index === selectedCell ? value : entry));
    setActivityMessage("");
  };

  const checkSudoku = () => {
    if (activity.kind !== "sudoku") return;
    const correct = activity.solution.every((value, index) => sudokuValues[index] === value);
    setCompleted(correct);
    setActivityMessage(t(language, correct ? "wellDone" : "tryAgain"));
  };

  const checkWord = () => {
    if (activity.kind !== "word") return;
    const correct = wordAnswer.trim().toUpperCase() === activity.answer;
    setCompleted(correct);
    setActivityMessage(t(language, correct ? "wellDone" : "tryAgain"));
  };

  const checkPattern = (choice: string) => {
    if (activity.kind !== "pattern") return;
    const correct = choice === activity.answer;
    setCompleted(correct);
    setActivityMessage(t(language, correct ? "wellDone" : "tryAgain"));
  };

  const breathingPhase = (() => {
    if (activity.kind !== "breathe" || !breathingStarted) return t(language, "startBreathing");
    const elapsed = activity.durationSeconds - breathingRemaining;
    const phase = elapsed % 12;
    return phase < 4 ? t(language, "breatheIn") : phase < 6 ? t(language, "holdBreath") : t(language, "breatheOut");
  })();

  if (!params.subjectId || !subject) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>{t(language, "breatherNotAvailable")}</Text>
          <PrimaryButton label={t(language, "backHome")} onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  const activityHeading = activity.kind === "read"
    ? content?.title ?? heroEyebrow
    : activity.kind === "sudoku"
      ? t(language, "sudokuTitle")
      : activity.kind === "memory"
        ? t(language, "memoryMatchTitle")
        : activity.kind === "word"
          ? t(language, "wordBuilderTitle")
          : activity.kind === "pattern"
            ? t(language, "patternDetectiveTitle")
            : activity.kind === "breathe"
              ? t(language, "breathingResetTitle")
              : t(language, "movementBreakTitle");
  const category = activity.kind === "read"
    ? t(language, "breatherRead")
    : activity.kind === "move"
      ? t(language, "breatherMove")
      : activity.kind === "breathe"
        ? t(language, "breatherRelax")
        : t(language, "breatherPlay");

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>{heroEyebrow} · {category}</Text>
        <Text style={styles.heroTitle}>{activityHeading}</Text>
        <Text style={styles.heroText}>{subject.name} | {t(language, "levelLabel")} {level} {t(language, "completedLabel")}</Text>
        {activity.kind === "read" && content ? <Text style={styles.heroText}>{content.intro}</Text> : null}
      </View>

      {activity.kind === "read" ? (
        content ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{content.formatLabel ?? t(language, "storyLabel")}</Text>
              <Text style={styles.bodyText}>{content.story}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t(language, "quickTakeaways")}</Text>
              {content.facts.map((item) => <Text key={item} style={styles.factLine}>- {item}</Text>)}
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{content.teachingTitle ?? t(language, "whatThisTeaches")}</Text>
              <Text style={styles.bodyText}>{content.teachingPoint ?? content.reflection}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{t(language, "reflection")}</Text>
              <Text style={styles.bodyText}>{content.reflection}</Text>
            </View>
          </>
        ) : (
          <View style={styles.card}><Text style={styles.bodyText}>{t(language, "preparingSession")}</Text></View>
        )
      ) : null}

      {activity.kind === "sudoku" ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>{t(language, "sudokuHint")}</Text>
          <View style={[styles.sudokuBoard, { width: sudokuBoardWidth }]}>
            {sudokuValues.map((value, index) => {
              const row = Math.floor(index / activity.size);
              const column = index % activity.size;
              const blockWidth = activity.size === 6 ? 3 : activity.size === 4 ? 2 : 3;
              const blockHeight = activity.size === 6 ? 2 : activity.size === 4 ? 2 : 3;
              const fixed = activity.puzzle[index] !== 0;
              return (
                <Pressable
                  key={index}
                  disabled={fixed || completed}
                  onPress={() => setSelectedCell(index)}
                  style={[
                    styles.sudokuCell,
                    { width: sudokuBoardWidth / activity.size, height: sudokuBoardWidth / activity.size },
                    column % blockWidth === 0 && styles.sudokuBlockLeft,
                    row % blockHeight === 0 && styles.sudokuBlockTop,
                    selectedCell === index && styles.sudokuCellSelected,
                    fixed && styles.sudokuCellFixed,
                  ]}
                >
                  <Text style={[styles.sudokuValue, activity.size === 9 && styles.sudokuValueSmall, fixed && styles.sudokuValueFixed]}>{value || ""}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.numberRow}>
            {Array.from({ length: activity.size }, (_, index) => index + 1).map((value) => (
              <Pressable key={value} onPress={() => enterSudokuValue(value)} style={styles.numberKey}><Text style={styles.numberKeyText}>{value}</Text></Pressable>
            ))}
          </View>
          <PrimaryButton label={t(language, "checkAnswer")} onPress={checkSudoku} disabled={completed} style={styles.activityButton} />
        </View>
      ) : null}

      {activity.kind === "memory" ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>{t(language, "memoryMatchHint")}</Text>
          <View style={styles.memoryGrid}>
            {memoryDeck.map((card, index) => {
              const visible = openCards.includes(index) || matchedSymbols.includes(card.symbol);
              return (
                <Pressable key={card.id} onPress={() => selectMemoryCard(index)} style={[styles.memoryCard, visible && styles.memoryCardOpen]}>
                  <Text style={styles.memorySymbol}>{visible ? card.symbol : "?"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {activity.kind === "word" ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>{t(language, "wordBuilderHint")}</Text>
          <Text style={styles.puzzlePrompt}>{activity.scrambled}</Text>
          <Text style={styles.hintText}>{activity.hint}</Text>
          <TextInput value={wordAnswer} onChangeText={(value) => { setWordAnswer(value); setActivityMessage(""); }} autoCapitalize="characters" editable={!completed} style={styles.input} />
          <PrimaryButton label={t(language, "checkAnswer")} onPress={checkWord} disabled={completed} style={styles.activityButton} />
        </View>
      ) : null}

      {activity.kind === "pattern" ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>{t(language, "patternDetectiveHint")}</Text>
          <Text style={styles.puzzlePrompt}>{activity.sequence}</Text>
          <View style={styles.choiceRow}>
            {activity.choices.map((choice) => (
              <Pressable key={choice} disabled={completed} onPress={() => checkPattern(choice)} style={styles.choiceButton}><Text style={styles.choiceText}>{choice}</Text></Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {activity.kind === "breathe" ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>{t(language, "breathingResetHint")}</Text>
          <View style={[styles.breathingCircle, breathingStarted && !completed && styles.breathingCircleActive]}>
            <Text style={styles.breathingPhase}>{breathingPhase}</Text>
            <Text style={styles.breathingTime}>{breathingRemaining}s</Text>
          </View>
          {!breathingStarted ? <PrimaryButton label={t(language, "startBreathing")} onPress={() => setBreathingStarted(true)} style={styles.activityButton} /> : null}
        </View>
      ) : null}

      {activity.kind === "move" ? (
        <View style={styles.card}>
          <Text style={styles.bodyText}>{t(language, "movementBreakHint")}</Text>
          {activity.steps.map((step, index) => <Text key={step} style={styles.movementStep}>{index + 1}. {step}</Text>)}
          <PrimaryButton label={t(language, "movementComplete")} onPress={() => { setCompleted(true); setActivityMessage(t(language, "wellDone")); }} disabled={completed} style={styles.activityButton} />
        </View>
      ) : null}

      {activityMessage ? <View style={[styles.messageCard, completed && styles.messageCardSuccess]}><Text style={styles.messageText}>{activityMessage}</Text></View> : null}
      {canShowAds(subscriptionTier) ? <DemoAdBanner language={language} format="banner" /> : null}

      <View style={styles.actionColumn}>
        <PrimaryButton label={t(language, "continueLearning")} onPress={continueLearning} />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: { marginTop: 12, borderRadius: 30, padding: 24, backgroundColor: "rgba(255,255,255,0.12)" },
  heroEyebrow: { color: "#D5F0FB", textTransform: "uppercase", letterSpacing: 1.2, fontSize: 12, fontWeight: "800" },
  heroTitle: { color: palette.white, fontSize: 32, fontWeight: "900", marginTop: 10, lineHeight: 38 },
  heroText: { color: "#EAF6FC", marginTop: 10, lineHeight: 22 },
  card: { marginTop: 18, backgroundColor: palette.white, borderRadius: 24, padding: 18, ...shadows.card },
  title: { color: palette.ink, fontSize: 28, fontWeight: "800" },
  sectionTitle: { color: palette.ink, fontSize: 20, fontWeight: "800", marginBottom: 10 },
  bodyText: { color: palette.slate, lineHeight: 24, fontSize: 16 },
  factLine: { color: palette.slate, lineHeight: 24, marginBottom: 8 },
  sudokuBoard: { alignSelf: "center", marginTop: 18, flexDirection: "row", flexWrap: "wrap", borderRightWidth: 2, borderBottomWidth: 2, borderColor: palette.navy },
  sudokuCell: { alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderLeftWidth: 1, borderColor: "#AAB8C5", backgroundColor: palette.white },
  sudokuBlockLeft: { borderLeftWidth: 2, borderLeftColor: palette.navy },
  sudokuBlockTop: { borderTopWidth: 2, borderTopColor: palette.navy },
  sudokuCellSelected: { backgroundColor: "#DDF5FB" },
  sudokuCellFixed: { backgroundColor: "#EEF3F7" },
  sudokuValue: { color: palette.navy, fontSize: 20, fontWeight: "800" },
  sudokuValueSmall: { fontSize: 15 },
  sudokuValueFixed: { color: palette.ink },
  numberRow: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  numberKey: { minWidth: 38, minHeight: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.navy },
  numberKeyText: { color: palette.white, fontWeight: "900" },
  memoryGrid: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  memoryCard: { width: 72, height: 82, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.navy },
  memoryCardOpen: { backgroundColor: "#DDF5FB", borderWidth: 2, borderColor: palette.navy },
  memorySymbol: { color: palette.ink, fontSize: 28, fontWeight: "900" },
  puzzlePrompt: { marginTop: 22, color: palette.navy, fontSize: 30, lineHeight: 38, letterSpacing: 3, textAlign: "center", fontWeight: "900" },
  hintText: { marginTop: 12, color: palette.slate, lineHeight: 22, textAlign: "center" },
  input: { minHeight: 52, marginTop: 16, borderWidth: 1, borderColor: "#C8D5E0", borderRadius: 16, paddingHorizontal: 14, color: palette.ink, fontSize: 18, textAlign: "center", backgroundColor: "#F9FBFD" },
  choiceRow: { marginTop: 18, flexDirection: "row", justifyContent: "center", gap: 10 },
  choiceButton: { minWidth: 76, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, alignItems: "center", backgroundColor: "#EAF7FD", borderWidth: 1, borderColor: "#A7D7E7" },
  choiceText: { color: palette.navy, fontSize: 18, fontWeight: "900" },
  breathingCircle: { width: 210, height: 210, alignSelf: "center", marginTop: 22, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#DDF5FB", borderWidth: 8, borderColor: "#A7D7E7" },
  breathingCircleActive: { backgroundColor: "#E8F8EF", borderColor: "#82C9A2" },
  breathingPhase: { color: palette.navy, fontSize: 22, fontWeight: "900" },
  breathingTime: { color: palette.slate, marginTop: 8, fontSize: 18 },
  movementStep: { marginTop: 16, color: palette.ink, lineHeight: 24, fontSize: 16, fontWeight: "600" },
  activityButton: { marginTop: 18 },
  messageCard: { marginTop: 14, borderRadius: 18, padding: 14, backgroundColor: "#FFF1E8" },
  messageCardSuccess: { backgroundColor: "#E8F8EF" },
  messageText: { color: palette.ink, textAlign: "center", fontWeight: "800" },
  actionColumn: { marginTop: 18 },
});
