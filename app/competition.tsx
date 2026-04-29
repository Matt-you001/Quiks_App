import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { getDifficultyLabel, t } from "../lib/i18n";
import { calculateQuizTime, getLevelProgressForGrade } from "../lib/quiz";
import { readAppState } from "../lib/storage";
import { getSubjectById, getTopicById, grades } from "../lib/subjects";
import { palette, shadows } from "../lib/theme";
import {
  acceptCompetitionChallenge,
  createCompetitionChallenge,
  getCompetitionChallengeStatus,
  listCompetitionChallenges,
} from "../services/ai";
import type {
  CompetitionChallengeSummary,
  Difficulty,
  QuestionFocusMode,
  SessionResult,
  UserProfile,
} from "../types/app";

type CompetitionScreenMode = "menu" | "create" | "accept" | "waiting";

export default function CompetitionScreen() {
  const params = useLocalSearchParams<{ subjectId?: string; grade?: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [screenMode, setScreenMode] = useState<CompetitionScreenMode>("menu");
  const [isBusy, setIsBusy] = useState(false);
  const [challenges, setChallenges] = useState<CompetitionChallengeSummary[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<CompetitionChallengeSummary | null>(null);
  const [grade, setGrade] = useState(() =>
    typeof params.grade === "string" && grades.includes(params.grade) ? params.grade : grades[0]
  );
  const [focusMode, setFocusMode] = useState<QuestionFocusMode>("general");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>(appVariant.defaultDifficulty);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const notifiedAcceptedRef = useRef(false);
  const language = profile?.language ?? "en";
  const subject = getSubjectById(params.subjectId, language);

  useEffect(() => {
    readAppState().then((state) => {
      const current = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
      setProfile(current);
      setResults(current ? state.results[current.id] ?? [] : []);
      if (!current && params.subjectId) {
        router.replace({ pathname: "/select-profile", params: { subject: params.subjectId } });
      }
    });
  }, [params.subjectId]);

  const levelProgress = useMemo(() => {
    if (!subject) {
      return [{ level: 1, isPassed: false, isNextUnlocked: true }];
    }

    return getLevelProgressForGrade(results, subject.id, grade);
  }, [grade, results, subject]);

  useEffect(() => {
    const availableLevels = levelProgress.map((entry) => entry.level);
    if (availableLevels.length === 0) {
      setSelectedLevel(1);
      return;
    }

    setSelectedLevel((current) => {
      if (availableLevels.includes(current)) {
        return current;
      }
      return availableLevels[availableLevels.length - 1];
    });
  }, [levelProgress]);

  useEffect(() => {
    if (!subject) {
      return;
    }

    if (focusMode === "topic") {
      const hasCurrentTopic = topicId && subject.topics.some((topic) => topic.id === topicId);
      if (!hasCurrentTopic) {
        setTopicId(subject.topics[0]?.id ?? null);
      }
      return;
    }

    setTopicId(null);
    setIsTopicDropdownOpen(false);
  }, [focusMode, subject, topicId]);

  const selectedTopic = useMemo(() => getTopicById(subject, topicId ?? undefined), [subject, topicId]);

  const loadChallenges = async () => {
    if (!profile) {
      return;
    }

    const response = await listCompetitionChallenges({
      playerId: profile.id,
      subjectId: subject?.id,
    });
    setChallenges(response.challenges);
  };

  useEffect(() => {
    if (screenMode !== "accept" || !profile) {
      return;
    }

    let isCancelled = false;
    const tick = async () => {
      try {
        const response = await listCompetitionChallenges({
          playerId: profile.id,
          subjectId: subject?.id,
        });
        if (!isCancelled) {
          setChallenges(response.challenges);
        }
      } catch {
        // Keep the last fetched list.
      }
    };

    tick();
    const interval = setInterval(tick, 4000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [profile, screenMode, subject?.id]);

  useEffect(() => {
    if (screenMode !== "waiting" || !profile || !activeChallenge) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await getCompetitionChallengeStatus({
          challengeId: activeChallenge.challengeId,
          playerId: profile.id,
        });

        if (response.status === "accepted" && response.competition) {
          if (!notifiedAcceptedRef.current) {
            notifiedAcceptedRef.current = true;
            Alert.alert(t(language, "challengeAccepted"));
          }

          router.replace({
            pathname: "/session",
            params: {
              subjectId: subject?.id,
              grade: activeChallenge.grade,
              level: String(activeChallenge.level),
              difficulty: activeChallenge.difficulty,
              focusMode: activeChallenge.focusMode,
              topicId: activeChallenge.topicId,
              competitionId: response.competition.competitionId,
              competitionOpponentName: response.competition.opponentName,
              autoStart: "1",
              mode: "quiz",
            },
          });
        }
      } catch {
        // Stay on the waiting screen.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeChallenge, language, profile, screenMode, subject?.id]);

  const createChallenge = async () => {
    if (!profile || !subject) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await createCompetitionChallenge({
        subject,
        grade,
        level: selectedLevel,
        difficulty,
        focusMode,
        topicId: selectedTopic?.id,
        topicLabel: selectedTopic?.label,
        profile,
        durationSeconds: calculateQuizTime(selectedLevel),
      });
      notifiedAcceptedRef.current = false;
      setActiveChallenge(response.challenge);
      setScreenMode("waiting");
      Alert.alert(t(language, "challengeCreated"), t(language, "challengeCreatedHint"));
    } finally {
      setIsBusy(false);
    }
  };

  const acceptChallenge = async (challenge: CompetitionChallengeSummary) => {
    if (!profile) {
      return;
    }

    setIsBusy(true);
    try {
      const response = await acceptCompetitionChallenge({
        challengeId: challenge.challengeId,
        playerId: profile.id,
        profile,
      });
      router.replace({
        pathname: "/session",
        params: {
          subjectId: challenge.subjectId,
          grade: challenge.grade,
          level: String(challenge.level),
          difficulty: challenge.difficulty,
          focusMode: challenge.focusMode,
          topicId: challenge.topicId,
          competitionId: response.competition.competitionId,
          competitionOpponentName: response.competition.opponentName,
          autoStart: "1",
          mode: "quiz",
        },
      });
    } finally {
      setIsBusy(false);
    }
  };

  if (appVariant.id === "children") {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>{t(language, "competitionArena")}</Text>
          <Text style={styles.text}>{t(language, "competitionNotAvailable")}</Text>
          <PrimaryButton label={t(language, "backHome")} onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  if (!subject) {
    return (
      <AppBackground>
        <View style={styles.card}>
          <Text style={styles.title}>{t(language, appVariant.curriculumSingular === "course" ? "courseNotFound" : "subjectNotFound")}</Text>
          <PrimaryButton label={t(language, "backHome")} onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  if (screenMode === "waiting" && activeChallenge) {
    return (
      <AppBackground>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>{t(language, "challengeCreated")}</Text>
          <Text style={styles.title}>{subject.name}</Text>
          <Text style={styles.heroText}>{t(language, "waitingForAcceptance")}</Text>
          <Text style={styles.heroText}>
            {activeChallenge.grade} | {t(language, "levelLabel")} {activeChallenge.level} | {getDifficultyLabel(language, activeChallenge.difficulty)}
          </Text>
          {activeChallenge.topicLabel ? <Text style={styles.heroText}>{t(language, "topicFocusLabel", { topic: activeChallenge.topicLabel })}</Text> : null}
        </View>

        <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
      </AppBackground>
    );
  }

  if (screenMode === "accept") {
    return (
      <AppBackground>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>{t(language, "challengeBoard")}</Text>
          <Text style={styles.title}>{subject.name}</Text>
          <Text style={styles.heroText}>{t(language, "challengeBoardHint")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "openChallenges")}</Text>
          {challenges.length > 0 ? (
            <View style={styles.challengeList}>
              {challenges.map((challenge) => (
                <View key={challenge.challengeId} style={styles.challengeCard}>
                  <Text style={styles.challengeTitle}>{challenge.creatorName}</Text>
                  <Text style={styles.challengeMeta}>
                    {challenge.grade} | {t(language, "levelLabel")} {challenge.level} | {getDifficultyLabel(language, challenge.difficulty)}
                  </Text>
                  <Text style={styles.challengeMeta}>
                    {challenge.topicLabel ?? t(language, "generalMixedPractice")}
                  </Text>
                  <PrimaryButton label={t(language, "acceptChallenge")} variant="secondary" onPress={() => acceptChallenge(challenge)} />
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.text}>{t(language, "noChallengesAvailable")}</Text>
          )}
        </View>

        <View style={styles.actionColumn}>
          <PrimaryButton label={t(language, "createChallenge")} onPress={() => setScreenMode("create")} />
          <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  if (screenMode === "create") {
    return (
      <AppBackground>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>{t(language, "createChallenge")}</Text>
          <Text style={styles.title}>{subject.name}</Text>
          <Text style={styles.heroText}>{t(language, "createChallengeHint")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "grade")}</Text>
          <View style={styles.choiceWrap}>
            {grades.slice(0, 8).map((entry) => (
              <Pressable
                key={entry}
                onPress={() => setGrade(entry)}
                style={[styles.choiceChip, grade === entry ? styles.choiceChipActive : null]}
              >
                <Text style={[styles.choiceText, grade === entry ? styles.choiceTextActive : null]}>{entry}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "questionFocus")}</Text>
          <View style={styles.choiceWrap}>
            <Pressable
              onPress={() => setFocusMode("general")}
              style={[styles.choiceChip, focusMode === "general" ? styles.choiceChipActive : null]}
            >
              <Text style={[styles.choiceText, focusMode === "general" ? styles.choiceTextActive : null]}>{t(language, "general")}</Text>
            </Pressable>
            <Pressable
              onPress={() => setFocusMode("topic")}
              style={[styles.choiceChip, focusMode === "topic" ? styles.choiceChipActive : null]}
            >
              <Text style={[styles.choiceText, focusMode === "topic" ? styles.choiceTextActive : null]}>
                {appVariant.id === "uni" ? t(language, "specialized") : t(language, "topicFocus")}
              </Text>
            </Pressable>
          </View>

          {focusMode === "topic" ? (
            <>
              <Text style={styles.sectionTitle}>{t(language, "chooseTopic")}</Text>
              <Pressable
                onPress={() => setIsTopicDropdownOpen((value) => !value)}
                style={[styles.dropdownTrigger, isTopicDropdownOpen ? styles.dropdownTriggerActive : null]}
              >
                <View style={styles.dropdownTextWrap}>
                  <Text style={styles.dropdownLabel}>{selectedTopic?.label ?? t(language, "selectTopic")}</Text>
                  <Text style={styles.dropdownHint}>{t(language, "topicPickerHint")}</Text>
                </View>
                <MaterialCommunityIcons
                  name={isTopicDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={palette.navy}
                />
              </Pressable>
              {isTopicDropdownOpen ? (
                <View style={styles.dropdownMenu}>
                  <ScrollView nestedScrollEnabled style={styles.dropdownScroll} showsVerticalScrollIndicator={false}>
                    {subject.topics.map((topic) => (
                      <Pressable
                        key={topic.id}
                        onPress={() => {
                          setTopicId(topic.id);
                          setIsTopicDropdownOpen(false);
                        }}
                        style={[styles.dropdownItem, topic.id === topicId ? styles.dropdownItemActive : null]}
                      >
                        <Text style={[styles.dropdownItemTitle, topic.id === topicId ? styles.dropdownItemTitleActive : null]}>
                          {topic.label}
                        </Text>
                        <Text style={[styles.dropdownItemText, topic.id === topicId ? styles.dropdownItemTextActive : null]}>
                          {topic.description}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "unlockedLevels")}</Text>
          <View style={styles.levelList}>
            {levelProgress.map((entry) => (
              <Pressable
                key={`${grade}-challenge-level-${entry.level}`}
                onPress={() => setSelectedLevel(entry.level)}
                style={[styles.levelRow, selectedLevel === entry.level ? styles.levelRowActive : null]}
              >
                <Text style={[styles.choiceText, selectedLevel === entry.level ? styles.choiceTextActive : null]}>
                  {t(language, "levelLabel")} {entry.level}
                </Text>
                <Text style={[styles.levelBadge, selectedLevel === entry.level ? styles.levelBadgeActive : null]}>
                  {entry.isPassed ? t(language, "passedLevelBadge") : t(language, "nextLevelBadge")}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t(language, "difficulty")}</Text>
          <View style={styles.choiceWrap}>
            {(["Beginner", "Intermediate", "Advanced", "Expert"] as Difficulty[]).map((entry) => (
              <Pressable
                key={entry}
                onPress={() => setDifficulty(entry)}
                style={[styles.choiceChip, difficulty === entry ? styles.choiceChipActive : null]}
              >
                <Text style={[styles.choiceText, difficulty === entry ? styles.choiceTextActive : null]}>
                  {getDifficultyLabel(language, entry)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.actionColumn}>
          <PrimaryButton label={t(language, "createChallenge")} onPress={createChallenge} />
          <PrimaryButton label={t(language, "acceptChallenge")} variant="secondary" onPress={() => setScreenMode("accept")} />
          <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>{t(language, "competitionArena")}</Text>
        <Text style={styles.title}>{subject.name}</Text>
        <Text style={styles.heroText}>{t(language, "challengeBoardHint")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t(language, "liveScores")}</Text>
        <Text style={styles.text}>{t(language, "competitionArenaHint")}</Text>
      </View>

      <View style={styles.actionColumn}>
        <PrimaryButton label={t(language, "createChallenge")} onPress={() => setScreenMode("create")} disabled={isBusy} />
        <PrimaryButton
          label={t(language, "acceptChallenge")}
          variant="secondary"
          onPress={async () => {
            setScreenMode("accept");
            await loadChallenges();
          }}
          disabled={isBusy}
        />
        <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    borderRadius: 30,
    padding: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  eyebrow: {
    color: "#D5F0FB",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    marginTop: 10,
    color: palette.white,
    fontSize: 30,
    fontWeight: "900",
  },
  heroText: {
    marginTop: 10,
    color: "#EAF6FC",
    lineHeight: 22,
  },
  card: {
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 18,
    ...shadows.card,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  text: {
    color: palette.slate,
    lineHeight: 22,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choiceChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F2F5F8",
  },
  choiceChipActive: {
    backgroundColor: palette.navy,
  },
  choiceText: {
    color: palette.navy,
    fontWeight: "700",
  },
  choiceTextActive: {
    color: palette.white,
  },
  dropdownTrigger: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dropdownTriggerActive: {
    borderColor: palette.navy,
  },
  dropdownTextWrap: {
    flex: 1,
  },
  dropdownLabel: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  dropdownHint: {
    color: palette.slate,
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  dropdownMenu: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: palette.white,
    overflow: "hidden",
  },
  dropdownScroll: {
    maxHeight: 260,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F7",
  },
  dropdownItemActive: {
    backgroundColor: "#EAF7FD",
  },
  dropdownItemTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  dropdownItemTitleActive: {
    color: palette.navy,
  },
  dropdownItemText: {
    color: palette.slate,
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  dropdownItemTextActive: {
    color: palette.navy,
  },
  levelList: {
    gap: 10,
  },
  levelRow: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F4F8FB",
    borderWidth: 1,
    borderColor: "#DCE6EE",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelRowActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  levelBadge: {
    color: "#0A7D58",
    fontSize: 12,
    fontWeight: "800",
  },
  levelBadgeActive: {
    color: "#DDF7EA",
  },
  challengeList: {
    gap: 12,
  },
  challengeCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#F7FBFD",
    borderWidth: 1,
    borderColor: "#DFE8F0",
    gap: 8,
  },
  challengeTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  challengeMeta: {
    color: palette.slate,
    lineHeight: 20,
  },
  actionColumn: {
    gap: 12,
    marginTop: 18,
  },
});
