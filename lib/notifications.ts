import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { Platform } from "react-native";
import { t } from "./i18n";
import { readAppState } from "./storage";
import { getCompetitionChallengeStatus } from "../services/ai";

const COMPETITION_REMINDER_STORAGE_KEY = "quiks_competition_reminders_v1";
const COMPETITION_REMINDER_CHANNEL_ID = "competition-reminders";
const PENDING_CHALLENGE_STORAGE_KEY = "quiks_pending_challenge_v1";

type CompetitionReminderMap = Record<string, string[]>;

interface PendingCompetitionChallenge {
  challengeId: string;
  playerId: string;
  playerLanguage: string;
  subjectId: string;
  grade: string;
  level: string;
  difficulty: string;
  focusMode: string;
  topicId?: string;
}

interface CompetitionReminderScheduleRequest {
  competitionId: string;
  subjectId: string;
  grade: string;
  level: string;
  difficulty: string;
  focusMode: string;
  topicId?: string;
  opponentName?: string;
  startAt: number;
  soonTitle: string;
  soonBody: string;
  startTitle: string;
  startBody: string;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function readCompetitionReminderMap(): Promise<CompetitionReminderMap> {
  const raw = await AsyncStorage.getItem(COMPETITION_REMINDER_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return (JSON.parse(raw) as CompetitionReminderMap) ?? {};
  } catch {
    return {};
  }
}

async function writeCompetitionReminderMap(nextState: CompetitionReminderMap) {
  await AsyncStorage.setItem(COMPETITION_REMINDER_STORAGE_KEY, JSON.stringify(nextState));
}

async function readPendingChallenge(): Promise<PendingCompetitionChallenge | null> {
  const raw = await AsyncStorage.getItem(PENDING_CHALLENGE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return (JSON.parse(raw) as PendingCompetitionChallenge) ?? null;
  } catch {
    return null;
  }
}

async function writePendingChallenge(nextState: PendingCompetitionChallenge | null) {
  if (!nextState) {
    await AsyncStorage.removeItem(PENDING_CHALLENGE_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(PENDING_CHALLENGE_STORAGE_KEY, JSON.stringify(nextState));
}

function buildSessionNotificationData(request: CompetitionReminderScheduleRequest) {
  return {
    route: "/session",
    subjectId: request.subjectId,
    grade: request.grade,
    level: request.level,
    difficulty: request.difficulty,
    focusMode: request.focusMode,
    topicId: request.topicId ?? "",
    competitionId: request.competitionId,
    competitionOpponentName: request.opponentName ?? "",
    autoStart: "1",
    mode: "quiz",
  };
}

async function ensureNotificationPermission() {
  if (Platform.OS === "web") {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(COMPETITION_REMINDER_CHANNEL_ID, {
      name: "Competition reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function cancelCompetitionReminderNotifications(competitionId: string) {
  if (Platform.OS === "web") {
    return;
  }

  const reminderMap = await readCompetitionReminderMap();
  const identifiers = reminderMap[competitionId] ?? [];

  await Promise.all(
    identifiers.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined)
    )
  );

  delete reminderMap[competitionId];
  await writeCompetitionReminderMap(reminderMap);
}

export async function trackPendingCompetitionChallenge(challenge: PendingCompetitionChallenge) {
  await writePendingChallenge(challenge);
}

export async function clearPendingCompetitionChallenge() {
  await writePendingChallenge(null);
}

export async function scheduleCompetitionReminderNotifications(
  request: CompetitionReminderScheduleRequest
) {
  if (Platform.OS === "web") {
    return false;
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return false;
  }

  await cancelCompetitionReminderNotifications(request.competitionId);

  const now = Date.now();
  const identifiers: string[] = [];
  const data = buildSessionNotificationData(request);

  if (request.startAt - 5 * 60 * 1000 > now + 5_000) {
    const soonIdentifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: request.soonTitle,
        body: request.soonBody,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(request.startAt - 5 * 60 * 1000),
        channelId: COMPETITION_REMINDER_CHANNEL_ID,
      },
    });
    identifiers.push(soonIdentifier);
  }

  if (request.startAt > now + 5_000) {
    const startIdentifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: request.startTitle,
        body: request.startBody,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        data,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(request.startAt),
        channelId: COMPETITION_REMINDER_CHANNEL_ID,
      },
    });
    identifiers.push(startIdentifier);
  }

  const reminderMap = await readCompetitionReminderMap();
  reminderMap[request.competitionId] = identifiers;
  await writeCompetitionReminderMap(reminderMap);
  return identifiers.length > 0;
}

async function presentCompetitionAcceptedNotification(params: {
  challenge: PendingCompetitionChallenge;
  competitionId: string;
  opponentName?: string;
}) {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return false;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: t(params.challenge.playerLanguage, "competitionReminderNowTitle"),
      body: t(params.challenge.playerLanguage, "competitionReminderNowBody", {
        subject: "Challenge",
        opponent: params.opponentName ?? t(params.challenge.playerLanguage, "opponent"),
      }),
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: {
        route: "/session",
        subjectId: params.challenge.subjectId,
        grade: params.challenge.grade,
        level: params.challenge.level,
        difficulty: params.challenge.difficulty,
        focusMode: params.challenge.focusMode,
        topicId: params.challenge.topicId ?? "",
        competitionId: params.competitionId,
        competitionOpponentName: params.opponentName ?? "",
        autoStart: "1",
        mode: "quiz",
      },
    },
    trigger: null,
  });

  return true;
}

function routeFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data || data.route !== "/session") {
    return null;
  }

  return {
    pathname: "/session" as const,
    params: {
      subjectId: typeof data.subjectId === "string" ? data.subjectId : "",
      grade: typeof data.grade === "string" ? data.grade : "",
      level: typeof data.level === "string" ? data.level : "",
      difficulty: typeof data.difficulty === "string" ? data.difficulty : "",
      focusMode: typeof data.focusMode === "string" ? data.focusMode : "",
      topicId: typeof data.topicId === "string" && data.topicId ? data.topicId : undefined,
      competitionId: typeof data.competitionId === "string" ? data.competitionId : "",
      competitionOpponentName:
        typeof data.competitionOpponentName === "string" && data.competitionOpponentName
          ? data.competitionOpponentName
          : undefined,
      autoStart: "1",
      mode: "quiz",
    },
  };
}

export function useNotificationNavigation() {
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    const handledResponseIds = new Set<string>();

    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) {
        return;
      }

      const identifier = response.notification.request.identifier;
      if (handledResponseIds.has(identifier)) {
        return;
      }

      handledResponseIds.add(identifier);
      const nextRoute = routeFromNotificationData(
        response.notification.request.content.data as Record<string, unknown> | undefined
      );

      if (nextRoute) {
        router.replace(nextRoute as never);
      }
    };

    void Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    return () => {
      subscription.remove();
    };
  }, []);
}

export function usePendingChallengeWatcher() {
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight) {
        return;
      }

      inFlight = true;

      try {
        const pending = await readPendingChallenge();
        if (!pending) {
          return;
        }

        const state = await readAppState();
        const activeProfile = state.profiles.find((profile) => profile.id === state.currentProfileId);
        if (!activeProfile || activeProfile.id !== pending.playerId) {
          return;
        }

        const response = await getCompetitionChallengeStatus({
          challengeId: pending.challengeId,
          playerId: pending.playerId,
        });

        if (response.status === "accepted" && response.competition) {
          await presentCompetitionAcceptedNotification({
            challenge: pending,
            competitionId: response.competition.competitionId,
            opponentName: response.competition.opponentName,
          });
          await clearPendingCompetitionChallenge();
        }
      } catch {
        // Keep polling quietly while the app is active.
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
}
