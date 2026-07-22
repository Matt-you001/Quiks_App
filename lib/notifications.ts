import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { t } from "./i18n";
import { readAppState } from "./storage";
import { getCompetitionChallengeStatus, registerPushToken } from "../services/ai";
import type { AppLanguage } from "../types/app";

const COMPETITION_REMINDER_STORAGE_KEY = "quiks_competition_reminders_v1";
const COMPETITION_REMINDER_CHANNEL_ID = "competition-reminders";
const PENDING_CHALLENGE_STORAGE_KEY = "quiks_pending_challenge_v1";
const REMOTE_PUSH_REGISTRATION_STORAGE_KEY = "quiks_remote_push_registration_v1";

type CompetitionReminderMap = Record<string, string[]>;

interface PendingCompetitionChallenge {
  challengeId: string;
  playerId: string;
  playerLanguage: AppLanguage;
  subjectId: string;
  grade: string;
  level: string;
  difficulty: string;
  focusMode: string;
  topicId?: string;
  acceptedNotificationShownAt?: number;
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

interface RegisteredPushState {
  profileId: string;
  token: string;
}

const COMPETITION_SOON_REMINDER_OFFSET_MS = 3_000;

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

async function readRegisteredPushState(): Promise<RegisteredPushState | null> {
  const raw = await AsyncStorage.getItem(REMOTE_PUSH_REGISTRATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return (JSON.parse(raw) as RegisteredPushState) ?? null;
  } catch {
    return null;
  }
}

async function writeRegisteredPushState(nextState: RegisteredPushState | null) {
  if (!nextState) {
    await AsyncStorage.removeItem(REMOTE_PUSH_REGISTRATION_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(REMOTE_PUSH_REGISTRATION_STORAGE_KEY, JSON.stringify(nextState));
}

export async function getPendingCompetitionChallenge() {
  return readPendingChallenge();
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

function getExpoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    (
      Constants as {
        manifest2?: {
          extra?: {
            eas?: {
              projectId?: string;
            };
          };
        };
      }
    ).manifest2?.extra?.eas?.projectId ??
    (
      Constants as {
        manifest?: {
          extra?: {
            eas?: {
              projectId?: string;
            };
          };
        };
      }
    ).manifest?.extra?.eas?.projectId ??
    null
  );
}

async function registerRemotePushTokenForActiveProfile() {
  if (Platform.OS === "web") {
    return;
  }

  const state = await readAppState();
  if (!state.isAuthenticated) {
    await writeRegisteredPushState(null);
    return;
  }

  const activeProfile =
    state.profiles.find((profile) => profile.id === state.currentProfileId) ??
    state.profiles[0] ??
    null;

  if (!activeProfile) {
    await writeRegisteredPushState(null);
    return;
  }

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return;
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;
  if (!token) {
    return;
  }

  // Re-register on every app activation. The backend may have restarted and lost an
  // in-memory token registration even though the device's Expo token did not change.
  await registerPushToken({
    playerId: activeProfile.id,
    token,
    language: activeProfile.language,
    profileName: activeProfile.name,
  });

  await writeRegisteredPushState({
    profileId: activeProfile.id,
    token,
  });
}

export async function syncRemotePushRegistration() {
  try {
    await registerRemotePushTokenForActiveProfile();
    return true;
  } catch {
    return false;
  }
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

export async function markPendingCompetitionChallengeAcceptedNotificationShown() {
  const pending = await readPendingChallenge();
  if (!pending) {
    return;
  }

  await writePendingChallenge({
    ...pending,
    acceptedNotificationShownAt: Date.now(),
  });
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

  const soonReminderAt = request.startAt - COMPETITION_SOON_REMINDER_OFFSET_MS;

  if (soonReminderAt > now + 500) {
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
        date: new Date(soonReminderAt),
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
        route: "/competition",
        challengeId: params.challenge.challengeId,
        subjectId: params.challenge.subjectId,
        grade: params.challenge.grade,
        level: params.challenge.level,
        difficulty: params.challenge.difficulty,
        focusMode: params.challenge.focusMode,
        topicId: params.challenge.topicId ?? "",
        opponentName: params.opponentName ?? "",
        notificationType: "challenge_accepted_needs_creator_confirmation",
      },
    },
    trigger: null,
  });

  return true;
}

function routeFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) {
    return null;
  }

  if (data.route === "/competition") {
    return {
      pathname: "/competition" as const,
      params: {
        challengeId: typeof data.challengeId === "string" ? data.challengeId : "",
        subjectId: typeof data.subjectId === "string" ? data.subjectId : "",
        grade: typeof data.grade === "string" ? data.grade : "",
      },
    };
  }

  if (data.route !== "/session") {
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

export function useRemotePushRegistration() {
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;

    const syncRegistration = async () => {
      try {
        if (!cancelled) {
          await syncRemotePushRegistration();
        }
      } catch {
        // Leave existing local notifications working even if remote registration fails.
      }
    };

    void syncRegistration();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncRegistration();
      }
    });

    return () => {
      cancelled = true;
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

        if (response.status === "awaiting_creator_confirmation") {
          if (!pending.acceptedNotificationShownAt) {
            await presentCompetitionAcceptedNotification({
              challenge: pending,
              opponentName: response.challenge?.acceptedByName,
            });
            await writePendingChallenge({
              ...pending,
              acceptedNotificationShownAt: Date.now(),
            });
          }
          return;
        }

        if (response.status === "accepted" && response.competition) {
          await clearPendingCompetitionChallenge();
          return;
        }

        if (
          response.status === "declined" ||
          response.status === "cancelled" ||
          response.status === "not_found"
        ) {
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
