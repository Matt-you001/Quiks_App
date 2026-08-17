import { useFocusEffect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { AppBackground } from "../components/AppBackground";
import { BackIconButton } from "../components/BackIconButton";
import { PrimaryButton } from "../components/PrimaryButton";
import { MathText } from "../components/MathText";
import { PremiumFeatureDialog } from "../components/PremiumFeatureDialog";
import { appVariant } from "../lib/app-variant";
import { createClassroomInvitationLink, createClassroomInvitationMessage } from "../lib/classroom-invite";
import { getDifficultyLabel, t } from "../lib/i18n";
import { canUseClassroom } from "../lib/subscription";
import { readAppState } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import {
  createClassroomAssignment,
  createClassroomClass,
  duplicateClassroomActivity,
  generateClassroomQuestionCandidates,
  getClassroomActivityDetails,
  getClassroomDetails,
  inviteStudentToClassroom,
  listClassroomActivities,
  listClassroomClasses,
  removeClassroomMember,
  requestJoinClassroom,
  respondToClassroomMembership,
  syncClassroomProfile,
  updateClassroomActivity,
} from "../services/ai";
import { getLocalizedSubjects, getSubjectDisplayName, validateTopicInput } from "../lib/subjects";
import type {
  ClassroomActivitySummary,
  ClassroomActivityType,
  ClassroomClassDetailsResponse,
  ClassroomMemberSummary,
  ClassroomQuestionOrderMode,
  ClassroomResultVisibility,
  ClassroomSummary,
  Difficulty,
  Question,
  QuestionFocusMode,
  Subject,
  UserProfile,
} from "../types/app";

const difficultyOptions: Difficulty[] = ["Beginner", "Intermediate", "Advanced", "Expert"];

function toSubjectId(value: string) {
  return `custom-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "subject"}`;
}

function parseCustomTopicLabels(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[,;\n]+/)
    .map((topic) => topic.trim())
    .filter((topic) => {
      if (!topic) return false;
      const key = topic.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function parseDateTimeInput(dateText: string, timeText: string) {
  if (!dateText.trim() || !timeText.trim()) {
    return null;
  }

  const candidate = new Date(`${dateText.trim()}T${timeText.trim()}:00`);
  return Number.isNaN(candidate.getTime()) ? null : candidate.getTime();
}

function formatLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function canEditScheduledActivity(activity: ClassroomActivitySummary) {
  if (activity.type !== "test") {
    return true;
  }

  return activity.startAt - Date.now() > 5 * 60 * 1000;
}

export default function ClassroomScreen() {
  const params = useLocalSearchParams<{ joinCode?: string }>();
  const hydratingActivityRef = useRef(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [classes, setClasses] = useState<ClassroomSummary[]>([]);
  const [activities, setActivities] = useState<ClassroomActivitySummary[]>([]);
  const [selectedClassDetails, setSelectedClassDetails] = useState<ClassroomClassDetailsResponse | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [inviteStudentId, setInviteStudentId] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityType, setActivityType] = useState<ClassroomActivityType>("assignment");
  const [grade, setGrade] = useState(appVariant.allowedGrades[0] ?? "Grade 6");
  const [level, setLevel] = useState("1");
  const [difficulty, setDifficulty] = useState<Difficulty>(appVariant.defaultDifficulty);
  const [focusMode, setFocusMode] = useState<QuestionFocusMode>("general");
  const [subjectId, setSubjectId] = useState(appVariant.allowedSubjectIds[0] ?? "");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [useCustomSubject, setUseCustomSubject] = useState(false);
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customTopicLabel, setCustomTopicLabel] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [durationSeconds, setDurationSeconds] = useState("600");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [resultVisibility, setResultVisibility] = useState<ClassroomResultVisibility>("private");
  const [questionOrderMode, setQuestionOrderMode] = useState<ClassroomQuestionOrderMode>("same");
  const [candidateQuestions, setCandidateQuestions] = useState<Question[]>([]);
  const [acceptedQuestions, setAcceptedQuestions] = useState<Question[]>([]);
  const [isReviewingQuestions, setIsReviewingQuestions] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);
  const [showCustomQuestionForm, setShowCustomQuestionForm] = useState(false);
  const [customQuestionPrompt, setCustomQuestionPrompt] = useState("");
  const [customQuestionOptions, setCustomQuestionOptions] = useState(["", "", "", ""]);
  const [customQuestionAnswerIndex, setCustomQuestionAnswerIndex] = useState<number | null>(null);
  const [customQuestionExplanation, setCustomQuestionExplanation] = useState("");
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [hasStartedQuestionSelection, setHasStartedQuestionSelection] = useState(false);
  const [publishingAssignment, setPublishingAssignment] = useState(false);
  const [classActionLoading, setClassActionLoading] = useState(false);
  const [openPicker, setOpenPicker] = useState<"startDate" | "startTime" | "deadlineDate" | "deadlineTime" | null>(null);
  const [pickerMonth, setPickerMonth] = useState(() => getMonthStart(new Date()));
  const [pickerHour, setPickerHour] = useState("00");
  const [pickerMinute, setPickerMinute] = useState("00");
  const [managementExpanded, setManagementExpanded] = useState(true);
  const [activityExpanded, setActivityExpanded] = useState(true);
  const [activityDetailsExpanded, setActivityDetailsExpanded] = useState(true);
  const [premiumBlocked, setPremiumBlocked] = useState(false);
  const [showInviteLinkOptions, setShowInviteLinkOptions] = useState(false);

  const language = profile?.language ?? "en";
  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")), []);
  const quarterHourOptions = useMemo(
    () =>
      Array.from({ length: 24 * 4 }, (_, index) => {
        const hour = String(Math.floor(index / 4)).padStart(2, "0");
        const minute = String((index % 4) * 15).padStart(2, "0");
        return `${hour}:${minute}`;
      }),
    []
  );
  const localizedSubjects = useMemo(() => getLocalizedSubjects(language), [language]);
  const selectedSubject = useMemo(
    () => localizedSubjects.find((subject) => subject.id === subjectId) ?? localizedSubjects[0] ?? null,
    [localizedSubjects, subjectId]
  );
  const isUsingCustomTopic = focusMode === "topic" && (useCustomSubject || useCustomTopic);
  const resolvedActivitySubject = useMemo((): Subject | null => {
    if (useCustomSubject) {
      const name = customSubjectName.trim();
      if (!name) {
        return null;
      }

      return {
        id: toSubjectId(name),
        name,
        tagline: "Custom subject",
        icon: "book-open-variant",
        accent: ["#0E5C63", "#7EE2D9"],
        description: "Teacher-defined subject",
        aiPromptHint: `Treat ${name} as a teacher-defined subject or course. Keep the questions aligned to the teacher's chosen grade, level, difficulty, and topic focus.`,
        topics: parseCustomTopicLabels(customTopicLabel).map((topicLabel) => ({
          id: `custom-topic-${toSubjectId(topicLabel)}`,
          label: topicLabel,
          description: "Teacher-defined topic",
          keywords: [topicLabel.toLowerCase()],
        })),
      };
    }

    return selectedSubject;
  }, [customSubjectName, customTopicLabel, selectedSubject, useCustomSubject]);
  const selectedClass = useMemo(
    () => classes.find((entry) => entry.classId === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId]
  );
  const pendingTeacherApprovals = useMemo(
    () => selectedClassDetails?.classroom.pendingTeacherApprovals ?? selectedClass?.pendingTeacherApprovals ?? [],
    [selectedClassDetails, selectedClass]
  );
  const pendingStudentInvites = useMemo(() => {
    if (!profile) {
      return [];
    }

    return classes.flatMap((entry) =>
      entry.pendingStudentApprovals
        .filter((membership) => membership.profileId === profile.id)
        .map((membership) => ({ classroom: entry, membership }))
    );
  }, [classes, profile]);
  const desiredQuestionCount = Math.max(1, Number(questionCount) || 5);
  const currentCandidateQuestion = candidateQuestions[0] ?? null;
  const reviewQuestions = acceptedQuestions.slice(reviewPage * 5, reviewPage * 5 + 5);
  const reviewPageCount = Math.max(1, Math.ceil(acceptedQuestions.length / 5));
  const activeMembers = useMemo(
    () => (selectedClassDetails?.members ?? []).filter((member) => member.status === "active"),
    [selectedClassDetails]
  );
  const computedTestDurationMinutes = useMemo(() => {
    if (activityType !== "test") {
      return 0;
    }

    const seconds = Math.max(0, Number(durationSeconds) || 0);
    if (seconds <= 0) {
      return 0;
    }

    return Math.max(1, Math.ceil(seconds / 60));
  }, [activityType, durationSeconds]);
  const computedTestEndAt = useMemo(() => {
    if (activityType !== "test") {
      return null;
    }

    const parsedStart = parseDateTimeInput(startDate, startTime);
    const seconds = Math.max(0, Number(durationSeconds) || 0);
    if (!parsedStart || seconds <= 0) {
      return null;
    }

    return parsedStart + seconds * 1000;
  }, [activityType, durationSeconds, startDate, startTime]);
  const computedTestEndTimeLabel = useMemo(() => {
    if (!computedTestEndAt) {
      return "Set start time and duration";
    }

    const endDate = new Date(computedTestEndAt);
    const hours = String(endDate.getHours()).padStart(2, "0");
    const minutes = String(endDate.getMinutes()).padStart(2, "0");
    const seconds = String(endDate.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [computedTestEndAt]);
  const calendarDays = useMemo(() => {
    const monthStart = getMonthStart(pickerMonth);
    const firstWeekday = monthStart.getDay();
    const firstCell = new Date(monthStart);
    firstCell.setDate(monthStart.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstCell);
      date.setDate(firstCell.getDate() + index);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
        date,
        value: formatLocalDateValue(date),
        inMonth: date.getMonth() === monthStart.getMonth(),
      };
    });
  }, [pickerMonth]);
  const minimumCalendarMonth = useMemo(() => getMonthStart(new Date()), []);
  const canGoToPreviousMonth = pickerMonth.getTime() > minimumCalendarMonth.getTime();
  const visibleActivities = useMemo(() => {
    if (profile?.role === "teacher" && selectedClass) {
      return activities.filter((activity) => activity.classId === selectedClass.classId);
    }

    return activities;
  }, [activities, profile?.role, selectedClass]);

  useEffect(() => {
    if (hydratingActivityRef.current) {
      hydratingActivityRef.current = false;
      return;
    }

    setCandidateQuestions([]);
    setAcceptedQuestions([]);
    setIsReviewingQuestions(false);
    setReviewPage(0);
    setHasStartedQuestionSelection(false);
  }, [activityType, customSubjectName, customTopicLabel, difficulty, focusMode, grade, level, questionCount, questionOrderMode, resultVisibility, subjectId, topicIds, useCustomSubject, useCustomTopic]);

  useEffect(() => {
    if (activityType !== "test") {
      return;
    }

    if (!startDate) {
      const today = formatLocalDateValue(new Date());
      setStartDate(today);
    }
  }, [activityType, startDate]);

  useEffect(() => {
    if (!hasStartedQuestionSelection || candidateLoading || acceptedQuestions.length >= desiredQuestionCount) {
      return;
    }

    if (candidateQuestions.length > 0) {
      return;
    }

    void generateCandidates();
  }, [acceptedQuestions.length, candidateLoading, candidateQuestions.length, desiredQuestionCount, hasStartedQuestionSelection]);

  useEffect(() => {
    if (!profile || !selectedClassId) {
      setSelectedClassDetails(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const details = await getClassroomDetails({
          profile,
          classId: selectedClassId,
        });
        if (!cancelled) {
          setSelectedClassDetails(details);
        }
      } catch {
        if (!cancelled) {
          setSelectedClassDetails(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, selectedClassId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [])
  );

  useEffect(() => {
    if (typeof params.joinCode === "string" && params.joinCode.trim()) {
      setJoinCode(params.joinCode.trim().toUpperCase());
    }
  }, [params.joinCode]);

  const loadData = async () => {
    setLoading(true);
    const state = await readAppState();
    if (!state.isAuthenticated) {
      router.replace({ pathname: "/signup" } as never);
      return;
    }

    const activeProfile = state.profiles.find((entry) => entry.id === state.currentProfileId) ?? null;
    setProfile(activeProfile);

    if (!canUseClassroom(state.subscriptionTier)) {
      setPremiumBlocked(true);
      setLoading(false);
      return;
    }
    setPremiumBlocked(false);

    if (!activeProfile) {
      setLoading(false);
      return;
    }

    try {
      await syncClassroomProfile({ profile: activeProfile });
      const [nextClasses, nextActivities] = await Promise.all([
        listClassroomClasses({ profile: activeProfile }),
        listClassroomActivities({ profile: activeProfile }),
      ]);
      setClasses(nextClasses.classes);
      setActivities(nextActivities.activities);
      setSelectedClassId((current) =>
        nextClasses.classes.some((entry) => entry.classId === current) ? current : nextClasses.classes[0]?.classId ?? null
      );
    } catch (error) {
      Alert.alert(t(language, "classroomTitle"), error instanceof Error ? error.message : "Unable to load classroom data.");
    } finally {
      setLoading(false);
    }
  };

  const refreshClassroomData = async () => {
    if (!profile) {
      return;
    }

    const [nextClasses, nextActivities] = await Promise.all([
      listClassroomClasses({ profile }),
      listClassroomActivities({ profile }),
    ]);
    setClasses(nextClasses.classes);
    setActivities(nextActivities.activities);
    const nextSelectedClassId = nextClasses.classes.some((entry) => entry.classId === selectedClassId)
      ? selectedClassId
      : nextClasses.classes[0]?.classId ?? null;
    setSelectedClassId(nextSelectedClassId);

    if (nextSelectedClassId) {
      const details = await getClassroomDetails({
        profile,
        classId: nextSelectedClassId,
      });
      setSelectedClassDetails(details);
    } else {
      setSelectedClassDetails(null);
    }
  };

  const openDatePicker = (picker: "startDate" | "deadlineDate") => {
    const currentValue =
      picker === "startDate" ? startDate : deadlineDate;
    const parsed = currentValue ? parseLocalDateValue(currentValue) : null;
    setPickerMonth(getMonthStart(parsed ?? new Date()));
    setOpenPicker(picker);
  };

  const selectDateValue = (value: string) => {
    if (openPicker === "startDate") {
      setStartDate(value);
    } else if (openPicker === "deadlineDate") {
      setDeadlineDate(value);
    }

    setOpenPicker(null);
  };

  const resetActivityBuilder = () => {
    setEditingActivityId(null);
    setAssignmentTitle("");
    setAcceptedQuestions([]);
    setCandidateQuestions([]);
    setIsReviewingQuestions(false);
    setReviewPage(0);
    setDeadlineDate("");
    setDeadlineTime("");
    setStartDate("");
    setStartTime("");
    setDurationSeconds("600");
    setCustomSubjectName("");
    setCustomTopicLabel("");
    setUseCustomSubject(false);
    setUseCustomTopic(false);
    setTopicIds([]);
    setShowCustomQuestionForm(false);
    setHasStartedQuestionSelection(false);
    setOpenPicker(null);
    setCustomQuestionAnswerIndex(null);
    setCustomQuestionPrompt("");
    setCustomQuestionOptions(["", "", "", ""]);
    setCustomQuestionExplanation("");
  };

  const copyClassCode = async (classCode: string) => {
    try {
      await Clipboard.setStringAsync(classCode);
      Alert.alert(t(language, "classroomTitle"), t(language, "copyClassCodeSuccess"));
    } catch {
      Alert.alert(t(language, "classroomTitle"), t(language, "copyClassCodeFailure"));
    }
  };

  const shareClassInvitation = async (
    channel: "whatsapp" | "email" | "telegram" | "sms" | "more" | "copy"
  ) => {
    if (!selectedClass) {
      return;
    }

    const link = createClassroomInvitationLink(selectedClass.classCode, selectedClass.className);
    const message = createClassroomInvitationMessage(selectedClass.className, selectedClass.classCode);

    try {
      if (channel === "copy") {
        await Clipboard.setStringAsync(link);
        Alert.alert(t(language, "classroomTitle"), t(language, "inviteLinkCopied"));
        return;
      }

      if (channel === "more") {
        await Share.share({ title: t(language, "shareClassInvite"), message, url: link });
        return;
      }

      const encodedMessage = encodeURIComponent(message);
      const encodedLink = encodeURIComponent(link);
      const target =
        channel === "whatsapp"
          ? `https://wa.me/?text=${encodedMessage}`
          : channel === "telegram"
            ? `https://t.me/share/url?url=${encodedLink}&text=${encodeURIComponent(`Join ${selectedClass.className} on ${appVariant.appName}. Class code: ${selectedClass.classCode}`)}`
            : channel === "email"
              ? `mailto:?subject=${encodeURIComponent(`Join ${selectedClass.className} on ${appVariant.appName}`)}&body=${encodedMessage}`
              : `${Platform.OS === "ios" ? "sms:&body=" : "sms:?body="}${encodedMessage}`;
      await Linking.openURL(target);
    } catch {
      await Share.share({ title: t(language, "shareClassInvite"), message, url: link }).catch(() => undefined);
    }
  };

  const copyQuiksId = async () => {
    if (!profile?.quiksId) {
      return;
    }

    try {
      await Clipboard.setStringAsync(profile.quiksId);
      Alert.alert(t(language, "classroomTitle"), `${t(language, "quiksIdLabel")} copied.`);
    } catch {
      Alert.alert(t(language, "classroomTitle"), `Unable to copy ${t(language, "quiksIdLabel")}.`);
    }
  };

  const openTimePicker = (picker: "startTime" | "deadlineTime") => {
    const currentValue = picker === "startTime" ? startTime : deadlineTime;
    const [hour = "00", minute = "00"] = currentValue ? currentValue.split(":") : ["00", "00"];
    setPickerHour(hour);
    setPickerMinute(minute);
    setOpenPicker(picker);
  };

  const confirmTimeValue = () => {
    const value = `${pickerHour}:${pickerMinute}`;
    if (openPicker === "startTime") {
      setStartTime(value);
    } else if (openPicker === "deadlineTime") {
      setDeadlineTime(value);
    }
    setOpenPicker(null);
  };

  const createClass = async () => {
    if (!profile || !newClassName.trim()) {
      Alert.alert(t(language, "classroomTitle"), t(language, "enterClassNameFirst"));
      return;
    }

    setSaving(true);
    try {
      await createClassroomClass({
        teacherProfile: profile,
        className: newClassName.trim(),
      });
      setNewClassName("");
      await refreshClassroomData();
    } catch (error) {
      Alert.alert(t(language, "classroomTitle"), error instanceof Error ? error.message : t(language, "unableCreateClass"));
    } finally {
      setSaving(false);
    }
  };

  const requestJoin = async () => {
    if (!profile || !joinCode.trim()) {
      Alert.alert(t(language, "classroomTitle"), t(language, "enterClassCodeFirst"));
      return;
    }

    setSaving(true);
    try {
      const response = await requestJoinClassroom({
        studentProfile: profile,
        classCode: joinCode.trim(),
      });
      Alert.alert(t(language, "joinRequestSent"), response.message);
      setJoinCode("");
      await refreshClassroomData();
    } catch (error) {
      Alert.alert(t(language, "classroomTitle"), error instanceof Error ? error.message : t(language, "unableSendJoinRequest"));
    } finally {
      setSaving(false);
    }
  };

  const inviteStudent = async () => {
    if (!profile || !selectedClass || !inviteStudentId.trim()) {
      Alert.alert(t(language, "classroomTitle"), t(language, "selectClassAndStudentFirst"));
      return;
    }

    setSaving(true);
    try {
      const response = await inviteStudentToClassroom({
        teacherProfile: profile,
        classId: selectedClass.classId,
        studentQuiksId: inviteStudentId.trim(),
      });
      Alert.alert(t(language, "inviteSent"), response.message);
      setInviteStudentId("");
      await refreshClassroomData();
    } catch (error) {
      Alert.alert(t(language, "classroomTitle"), error instanceof Error ? error.message : t(language, "unableInviteStudent"));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (membership: ClassroomMemberSummary) => {
    if (!profile || !selectedClass) {
      return;
    }

    setClassActionLoading(true);
    try {
      await removeClassroomMember({
        teacherProfile: profile,
        classId: selectedClass.classId,
        membershipId: membership.membershipId,
      });
      await refreshClassroomData();
    } catch (error) {
      Alert.alert(t(language, "classroomTitle"), error instanceof Error ? error.message : t(language, "unableRemoveMember"));
    } finally {
      setClassActionLoading(false);
    }
  };

  const respondToMembership = async (
    classroom: ClassroomSummary,
    membership: ClassroomMemberSummary,
    decision: "approve" | "reject"
  ) => {
    if (!profile) {
      return;
    }

    setSaving(true);
    try {
      await respondToClassroomMembership({
        actorProfile: profile,
        classId: classroom.classId,
        membershipId: membership.membershipId,
        decision,
      });
      await refreshClassroomData();
    } catch (error) {
      Alert.alert(t(language, "classroomTitle"), error instanceof Error ? error.message : t(language, "unableUpdateRequest"));
    } finally {
      setSaving(false);
    }
  };

  const resolveActivityTopicSelection = (alertTitle: string) => {
    if (focusMode !== "topic") {
      return { topicIds: [] as string[], topicLabels: [] as string[] };
    }

    if (!resolvedActivitySubject) return null;

    const customTopicLabels = parseCustomTopicLabels(customTopicLabel);

    if (useCustomSubject) {
      if (customTopicLabels.length === 0) {
        Alert.alert(alertTitle, t(language, "enterCustomTopicFirst"));
        return null;
      }
      return { topicIds: [] as string[], topicLabels: customTopicLabels };
    }

    const resolvedTopicIds = [...topicIds];
    const resolvedTopicLabels = topicIds
      .map((topicId) => selectedSubject?.topics.find((topic) => topic.id === topicId)?.label)
      .filter((label): label is string => Boolean(label));

    if (useCustomTopic) {
      if (customTopicLabels.length === 0) {
        Alert.alert(alertTitle, t(language, "enterCustomTopicFirst"));
        return null;
      }

      for (const customLabel of customTopicLabels) {
        const freshTopicValidation = validateTopicInput(resolvedActivitySubject, customLabel, language);
        if (freshTopicValidation.status === "wrong-subject") {
          Alert.alert(
            alertTitle,
            t(language, "customTopicWrongSubject", {
              topic: freshTopicValidation.input,
              subject: resolvedActivitySubject.name,
              matchedSubject: freshTopicValidation.matchedSubjectName ?? "another subject",
            })
          );
          return null;
        }

        if (freshTopicValidation.status === "valid") {
          if (freshTopicValidation.matchedTopicId && !resolvedTopicIds.includes(freshTopicValidation.matchedTopicId)) {
            resolvedTopicIds.push(freshTopicValidation.matchedTopicId);
          }
          if (
            freshTopicValidation.matchedTopicLabel &&
            !resolvedTopicLabels.some(
              (label) => label.toLowerCase() === freshTopicValidation.matchedTopicLabel?.toLowerCase()
            )
          ) {
            resolvedTopicLabels.push(freshTopicValidation.matchedTopicLabel);
          }
        } else if (!resolvedTopicLabels.some((label) => label.toLowerCase() === customLabel.toLowerCase())) {
          resolvedTopicLabels.push(customLabel);
        }
      }
    }

    if (resolvedTopicIds.length === 0 && resolvedTopicLabels.length === 0) {
      Alert.alert(alertTitle, t(language, "selectAtLeastOneTopic"));
      return null;
    }

    return { topicIds: resolvedTopicIds, topicLabels: resolvedTopicLabels };
  };

  const generateCandidates = async () => {
    if (!profile || !selectedClass || !resolvedActivitySubject) {
      return;
    }

    const topicSelection = resolveActivityTopicSelection(t(language, "questionSelectionTitle"));
    if (!topicSelection) return;
    const requestTopicIds = topicSelection.topicIds;
    const requestTopicLabels = topicSelection.topicLabels;

    setCandidateLoading(true);
    setHasStartedQuestionSelection(true);
    try {
      const remainingCount = Math.max(1, desiredQuestionCount - acceptedQuestions.length);
      const response = await generateClassroomQuestionCandidates({
        teacherProfile: profile,
        classId: selectedClass.classId,
        subject: resolvedActivitySubject,
        grade,
        level: Math.max(1, Number(level) || 1),
        difficulty,
        focusMode,
        topicId: focusMode === "topic" ? requestTopicIds[0] : undefined,
        topicLabel: focusMode === "topic" ? requestTopicLabels.join(", ") : undefined,
        topicIds: focusMode === "topic" ? requestTopicIds : undefined,
        topicLabels: focusMode === "topic" ? requestTopicLabels : undefined,
        questionCount: desiredQuestionCount,
        batchCount: Math.min(10, remainingCount),
      });
      setCandidateQuestions((current) => [
        ...current,
        ...response.questions.map((question, index) => ({
          ...question,
          id: `${question.id}-${Date.now()}-${current.length + index}`,
        })),
      ]);
    } catch (error) {
      Alert.alert(t(language, "questionSelectionTitle"), error instanceof Error ? error.message : t(language, "unableLoadCandidateQuestions"));
    } finally {
      setCandidateLoading(false);
    }
  };

  const acceptCandidate = (question: Question) => {
    setAcceptedQuestions((current) => {
      if (current.some((entry) => entry.id === question.id) || current.length >= desiredQuestionCount) {
        return current;
      }

      return [...current, question];
    });
    setCandidateQuestions((current) => current.filter((entry) => entry.id !== question.id));
    setIsReviewingQuestions(false);
  };

  const skipCandidate = () => {
    setCandidateQuestions((current) => current.slice(1));
  };

  const removeAcceptedQuestion = (questionId: string) => {
    setAcceptedQuestions((current) => current.filter((entry) => entry.id !== questionId));
    setIsReviewingQuestions(false);
    setReviewPage(0);
  };

  const addCustomQuestion = () => {
    if (!customQuestionPrompt.trim()) {
      Alert.alert(t(language, "customQuestionTitle"), t(language, "enterQuestionPrompt"));
      return;
    }

    if (customQuestionOptions.some((option) => !option.trim())) {
      Alert.alert(t(language, "customQuestionTitle"), t(language, "fillAllFourAnswerOptions"));
      return;
    }

    if (customQuestionAnswerIndex === null) {
      Alert.alert(t(language, "customQuestionTitle"), t(language, "chooseCorrectAnswer"));
      return;
    }

    const answer = customQuestionOptions[customQuestionAnswerIndex]?.trim();
    if (!answer) {
      Alert.alert(t(language, "customQuestionTitle"), t(language, "markedCorrectOptionEmpty"));
      return;
    }

    if (acceptedQuestions.length >= desiredQuestionCount) {
      Alert.alert(t(language, "customQuestionTitle"), t(language, "questionCountAlreadyComplete"));
      return;
    }

    const customQuestion: Question = {
      id: `custom-${Date.now()}-${acceptedQuestions.length + 1}`,
      prompt: customQuestionPrompt.trim(),
      options: customQuestionOptions.map((option) => option.trim()),
      answer,
      explanation: customQuestionExplanation.trim() || t(language, "teacherAuthoredQuestion"),
    };

    setAcceptedQuestions((current) => [...current, customQuestion]);
    setCustomQuestionPrompt("");
    setCustomQuestionOptions(["", "", "", ""]);
    setCustomQuestionAnswerIndex(null);
    setCustomQuestionExplanation("");
    setShowCustomQuestionForm(false);
  };

  const publishAssignment = async () => {
    if (!profile || !selectedClass || !resolvedActivitySubject) {
      return;
    }

    if (acceptedQuestions.length < desiredQuestionCount) {
      Alert.alert(t(language, "publishAssignmentTitle"), t(language, "acceptQuestionsBeforePublishing", { count: desiredQuestionCount }));
      return;
    }

    if (!assignmentTitle.trim()) {
      Alert.alert(t(language, "publishAssignmentTitle"), t(language, "enterAssignmentTitleFirst"));
      return;
    }

    const topicSelection = resolveActivityTopicSelection(t(language, "publishAssignmentTitle"));
    if (!topicSelection) return;
    const requestTopicIds = topicSelection.topicIds;
    const requestTopicLabels = topicSelection.topicLabels;

    const parsedStartAt = activityType === "test" ? parseDateTimeInput(startDate, startTime) : null;
    const parsedEndAt = activityType === "test" ? computedTestEndAt : null;
    const parsedDeadline = activityType === "assignment" ? parseDateTimeInput(deadlineDate, deadlineTime) : null;

    if (activityType === "test" && !parsedStartAt) {
      Alert.alert(t(language, "publishTestTitle"), t(language, "enterValidTestStart"));
      return;
    }

    if (activityType === "test" && !parsedEndAt) {
      Alert.alert(t(language, "publishTestTitle"), t(language, "enterValidDurationSeconds"));
      return;
    }

    if (activityType === "test" && parsedStartAt && parsedEndAt && parsedEndAt <= parsedStartAt) {
      Alert.alert(t(language, "publishTestTitle"), t(language, "endTimeLaterThanStart"));
      return;
    }

    if (activityType === "test" && parsedStartAt && parsedEndAt) {
      const startDateValue = formatLocalDateValue(new Date(parsedStartAt));
      const endDateValue = formatLocalDateValue(new Date(parsedEndAt));
      if (startDateValue !== endDateValue) {
        Alert.alert(t(language, "publishTestTitle"), t(language, "testEndSameDay"));
        return;
      }
    }

    if (activityType === "assignment" && !parsedDeadline) {
      Alert.alert(t(language, "publishAssignmentTitle"), t(language, "enterValidDeadline"));
      return;
    }

    if (activityType === "assignment" && parsedDeadline && parsedDeadline <= Date.now()) {
      Alert.alert(t(language, "publishAssignmentTitle"), t(language, "deadlineMustBeFuture"));
      return;
    }

    setPublishingAssignment(true);
    try {
      const payload = {
        teacherProfile: profile,
        classId: selectedClass.classId,
        type: activityType,
        title: assignmentTitle.trim(),
        subject: resolvedActivitySubject,
        usesCustomSubject: useCustomSubject,
        usesCustomTopic: Boolean(isUsingCustomTopic && customTopicLabel.trim()),
        grade,
        level: Math.max(1, Number(level) || 1),
        difficulty,
        focusMode,
        topicId: focusMode === "topic" ? requestTopicIds[0] : undefined,
        topicLabel: focusMode === "topic" ? requestTopicLabels.join(", ") : undefined,
        topicIds: focusMode === "topic" ? requestTopicIds : undefined,
        topicLabels: focusMode === "topic" ? requestTopicLabels : undefined,
        customTopicLabel:
          focusMode === "topic" && isUsingCustomTopic && customTopicLabel.trim()
            ? parseCustomTopicLabels(customTopicLabel).join(", ")
            : undefined,
        customTopicLabels:
          focusMode === "topic" && isUsingCustomTopic
            ? parseCustomTopicLabels(customTopicLabel)
            : undefined,
        durationMinutes:
          activityType === "test"
            ? Math.max(1, computedTestDurationMinutes)
            : Math.max(5, Math.ceil(((parsedDeadline ?? Date.now()) - Date.now()) / 60000)),
        availabilityHours: 24,
        startAt: parsedStartAt ?? undefined,
        endAt:
          activityType === "test"
            ? parsedEndAt ?? undefined
            : parsedDeadline ?? undefined,
        resultVisibility,
        questionOrderMode,
        questions: acceptedQuestions.slice(0, desiredQuestionCount),
      };

      if (editingActivityId) {
        await updateClassroomActivity({
          ...payload,
          activityId: editingActivityId,
        });
      } else {
        await createClassroomAssignment(payload);
      }
      resetActivityBuilder();
      await refreshClassroomData();
      Alert.alert(
        editingActivityId ? t(language, "activityUpdatedTitle") : activityType === "test" ? t(language, "testPublishedTitle") : t(language, "assignmentPublishedTitle"),
        editingActivityId
          ? t(language, "activityChangesSaved")
          : activityType === "test"
            ? t(language, "testReadyForClass")
            : t(language, "assignmentReadyForClass")
      );
    } catch (error) {
      Alert.alert(t(language, "publishAssignmentTitle"), error instanceof Error ? error.message : t(language, "unablePublishActivity"));
    } finally {
      setPublishingAssignment(false);
    }
  };

  const duplicateActivity = async (activity: ClassroomActivitySummary) => {
    if (!profile) {
      return;
    }

    setClassActionLoading(true);
    try {
      await duplicateClassroomActivity({
        teacherProfile: profile,
        activityId: activity.activityId,
      });
      await refreshClassroomData();
    } catch (error) {
      Alert.alert(t(language, "classroomTitle"), error instanceof Error ? error.message : t(language, "unableDuplicateActivity"));
    } finally {
      setClassActionLoading(false);
    }
  };

  const editActivity = async (activity: ClassroomActivitySummary) => {
    if (!profile) {
      return;
    }

    if (!canEditScheduledActivity(activity)) {
      Alert.alert(t(language, "classroomTitle"), t(language, "testEditLocked"));
      return;
    }

    setClassActionLoading(true);
    try {
      const details = await getClassroomActivityDetails({
        profile,
        activityId: activity.activityId,
      });
      hydratingActivityRef.current = true;
      setSelectedClassId(activity.classId);
      setEditingActivityId(activity.activityId);
      setActivityExpanded(true);
      setActivityDetailsExpanded(true);
      setAssignmentTitle(activity.title);
      setActivityType(activity.type);
      setGrade(activity.grade);
      setLevel(String(activity.level));
      setDifficulty(activity.difficulty);
      setFocusMode(activity.focusMode);
      setQuestionCount(String(activity.questionCount));
      setResultVisibility(activity.resultVisibility);
      setQuestionOrderMode(activity.questionOrderMode);
      setAcceptedQuestions(details.questions);
      setCandidateQuestions([]);
      setIsReviewingQuestions(false);
      setReviewPage(0);
      setShowCustomQuestionForm(false);
      setHasStartedQuestionSelection(true);
      setOpenPicker(null);
      setCustomQuestionAnswerIndex(null);
      setCustomQuestionPrompt("");
      setCustomQuestionOptions(["", "", "", ""]);
      setCustomQuestionExplanation("");

      if (activity.usesCustomSubject) {
        setUseCustomSubject(true);
        setUseCustomTopic(false);
        setCustomSubjectName(activity.subjectName);
      } else {
        setUseCustomSubject(false);
        setSubjectId(activity.subjectId);
      }

      if (activity.focusMode === "topic") {
        if (activity.usesCustomTopic) {
          setUseCustomTopic(!activity.usesCustomSubject);
          setTopicIds(activity.topicIds?.length ? activity.topicIds : activity.topicId ? [activity.topicId] : []);
          setCustomTopicLabel(
            activity.customTopicLabels?.length
              ? activity.customTopicLabels.join(", ")
              : activity.customTopicLabel ??
              activity.topicLabels?.[Math.max(0, activity.topicLabels.length - 1)] ??
              activity.topicLabel ??
              ""
          );
        } else {
          setUseCustomTopic(false);
          setTopicIds(activity.topicIds?.length ? activity.topicIds : activity.topicId ? [activity.topicId] : []);
          setCustomTopicLabel("");
        }
      } else {
        setUseCustomTopic(false);
        setTopicIds(activity.topicIds?.length ? activity.topicIds : activity.topicId ? [activity.topicId] : []);
        setCustomTopicLabel("");
      }

      if (activity.type === "test") {
        const start = new Date(activity.startAt);
        setStartDate(formatLocalDateValue(start));
        setStartTime(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
        setDurationSeconds(String(Math.max(1, Math.round((activity.endAt - activity.startAt) / 1000))));
        setDeadlineDate("");
        setDeadlineTime("");
      } else {
        const deadline = new Date(activity.endAt);
        setDeadlineDate(formatLocalDateValue(deadline));
        setDeadlineTime(`${String(deadline.getHours()).padStart(2, "0")}:${String(deadline.getMinutes()).padStart(2, "0")}`);
        setStartDate("");
        setStartTime("");
        setDurationSeconds("600");
      }
    } catch (error) {
      Alert.alert(t(language, "classroomTitle"), error instanceof Error ? error.message : t(language, "unableLoadActivityForEditing"));
    } finally {
      setClassActionLoading(false);
    }
  };

  const openActivity = (activity: ClassroomActivitySummary) => {
    router.push({
      pathname: "/session",
      params: {
        subjectId: activity.subjectId,
        grade: activity.grade,
        level: String(activity.level),
        difficulty: activity.difficulty,
        focusMode: activity.focusMode,
        topicId: activity.topicId,
        mode: "quiz",
        autoStart: "1",
        classroomActivityId: activity.activityId,
      },
    });
  };

  const openActivityDashboard = (activity: ClassroomActivitySummary) => {
    router.push({
      pathname: "/classroom-activity",
      params: {
        activityId: activity.activityId,
      },
    });
  };

  const openStudentResult = (activity: ClassroomActivitySummary) => {
    router.push({
      pathname: "/classroom-result" as never,
      params: {
        activityId: activity.activityId,
      },
    } as never);
  };

  if (loading) {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>{t(language, "loadingClassroom")}</Text>
        </View>
      </AppBackground>
    );
  }

  if (premiumBlocked) {
    return (
      <AppBackground>
        <PremiumFeatureDialog
          visible
          title={t(language, "classroomTitle")}
          message={t(language, "classroomProRequired")}
          upgradeLabel={t(language, "upgradeToPro")}
          cancelLabel={t(language, "cancel")}
          onClose={() => router.replace("/")}
          onUpgrade={() => router.replace({ pathname: "/subscription", params: { source: "classroom" } } as never)}
        />
      </AppBackground>
    );
  }

  if (!profile) {
    return (
      <AppBackground>
        <View style={styles.centerCard}>
          <Text style={styles.centerTitle}>{t(language, "chooseProfileBeforeClassroom")}</Text>
          <PrimaryButton label="Go Home" onPress={() => router.replace("/")} />
        </View>
      </AppBackground>
    );
  }
  return (
    <AppBackground>
      <BackIconButton fallbackHref="/" />
      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>{t(language, "classroomTitle")}</Text>
        <View style={styles.identityRow}>
          <View style={styles.identityChip}>
            <Text style={styles.identityLabel}>{t(language, "roleLabel")}</Text>
            <Text style={styles.identityValue}>{profile.role === "teacher" ? t(language, "teacherRole") : t(language, "studentRole")}</Text>
          </View>
          <Pressable style={styles.identityChip} onPress={copyQuiksId}>
            <Text style={styles.identityLabel}>{t(language, "quiksIdLabel")}</Text>
            <Text style={styles.identityValue}>{profile.quiksId}</Text>
            <Text style={styles.identityCopyHint}>Tap to copy</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {profile.role === "teacher" ? (
          <>
            <View style={styles.card}>
              <Pressable style={styles.sectionToggle} onPress={() => setManagementExpanded((current) => !current)}>
                <Text style={styles.cardTitle}>{t(language, "classManagement")}</Text>
                <Text style={styles.sectionToggleIcon}>{managementExpanded ? "-" : "+"}</Text>
              </Pressable>
              {managementExpanded ? (
                <>
                  <TextInput
                    value={newClassName}
                    onChangeText={setNewClassName}
                    placeholder={t(language, "className")}
                    placeholderTextColor="#8092A7"
                    style={styles.input}
                  />
                  <PrimaryButton label={t(language, "createClassAction")} onPress={createClass} loading={saving} />

                  <Text style={styles.sectionLabel}>{t(language, "yourClasses")}</Text>
                  {classes.length === 0 ? (
                    <Text style={styles.helperText}>{t(language, "noClassesYet")}</Text>
                  ) : (
                    classes.map((entry) => (
                      <Pressable
                        key={entry.classId}
                        onPress={() => setSelectedClassId(entry.classId)}
                        style={[styles.classCard, entry.classId === selectedClass?.classId ? styles.classCardActive : null]}
                      >
                        <Text style={styles.classTitle}>{entry.className}</Text>
                        <View style={styles.codeRow}>
                          <Text style={styles.classMeta}>{t(language, "classCode")}: {entry.classCode}</Text>
                          <Pressable onPress={() => copyClassCode(entry.classCode)} style={styles.copyButton}>
                            <MaterialIcons name="content-copy" size={16} color={palette.navy} />
                          </Pressable>
                        </View>
                        <Text style={styles.classMeta}>{t(language, "membersLabel")}: {entry.memberCount}</Text>
                      </Pressable>
                    ))
                  )}

                  {selectedClass ? (
                    <>
                      <Text style={styles.sectionLabel}>{t(language, "roster")}</Text>
                      {activeMembers.length === 0 ? (
                        <Text style={styles.helperText}>{t(language, "noMembers")}</Text>
                      ) : (
                        activeMembers.map((membership) => (
                          <View key={membership.membershipId} style={styles.memberRow}>
                            <View style={styles.memberMeta}>
                              <Text style={styles.requestTitle}>{membership.name}</Text>
                              <Text style={styles.classMeta}>
                                {membership.role === "teacher" ? t(language, "teacherLabel") : membership.quiksId}
                              </Text>
                            </View>
                            {membership.role === "student" ? (
                              <PrimaryButton
                                label={t(language, "remove")}
                                variant="secondary"
                                onPress={() => removeMember(membership)}
                                style={styles.memberAction}
                              />
                            ) : null}
                          </View>
                        ))
                      )}

                      <Text style={styles.sectionLabel}>{t(language, "inviteStudentById")}</Text>
                      <TextInput
                        value={inviteStudentId}
                        onChangeText={setInviteStudentId}
                        placeholder={t(language, "studentQuiksId")}
                        placeholderTextColor="#8092A7"
                        style={styles.input}
                      />
                      <PrimaryButton label={t(language, "sendInvite")} onPress={inviteStudent} loading={saving} />
                      <PrimaryButton
                        label={t(language, "inviteStudentsByLink")}
                        variant="secondary"
                        onPress={() => setShowInviteLinkOptions(true)}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </View>

            {selectedClass ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{t(language, "pendingStudentRequests")}</Text>
                  {pendingTeacherApprovals.length === 0 ? (
                    <Text style={styles.helperText}>{t(language, "noRequests")}</Text>
                  ) : (
                    pendingTeacherApprovals.map((membership) => (
                      <View key={membership.membershipId} style={styles.requestCard}>
                        <Text style={styles.requestTitle}>{membership.name}</Text>
                        <Text style={styles.classMeta}>{membership.quiksId}</Text>
                        <View style={styles.inlineActions}>
                          <PrimaryButton
                            label={t(language, "approve")}
                            onPress={() => respondToMembership(selectedClass, membership, "approve")}
                            style={styles.inlineButton}
                          />
                          <PrimaryButton
                            label={t(language, "reject")}
                            variant="secondary"
                            onPress={() => respondToMembership(selectedClass, membership, "reject")}
                            style={styles.inlineButton}
                          />
                        </View>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.card}>
                  <Pressable style={styles.sectionToggle} onPress={() => setActivityExpanded((current) => !current)}>
                    <Text style={styles.cardTitle}>{t(language, "createActivity")}</Text>
                    <Text style={styles.sectionToggleIcon}>{activityExpanded ? "-" : "+"}</Text>
                  </Pressable>
                  {activityExpanded ? (
                    <>
                  <Text style={styles.helperText}>
                    Selected class: {selectedClass.className}. Create as many tests and assignments as you want inside this class.
                  </Text>
                  <Text style={styles.sectionLabel}>{t(language, "activityType")}</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton label={t(language, "assignmentType")} onPress={() => setActivityType("assignment")} variant={activityType === "assignment" ? "primary" : "secondary"} style={styles.inlineButton} />
                    <PrimaryButton label={t(language, "testType")} onPress={() => setActivityType("test")} variant={activityType === "test" ? "primary" : "secondary"} style={styles.inlineButton} />
                  </View>

                  <TextInput value={assignmentTitle} onChangeText={setAssignmentTitle} placeholder={activityType === "test" ? t(language, "testTitle") : t(language, "assignmentTitle")} placeholderTextColor="#8092A7" style={styles.input} />

                  <Text style={styles.sectionLabel}>{t(language, "formLabel")}</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton
                      label={t(language, "preset")}
                      onPress={() => {
                        setUseCustomSubject(false);
                        setUseCustomTopic(false);
                      }}
                      variant={useCustomSubject ? "secondary" : "primary"}
                      style={styles.inlineButton}
                    />
                    <PrimaryButton
                      label={t(language, "custom")}
                      onPress={() => {
                        setUseCustomSubject(true);
                        setUseCustomTopic(false);
                      }}
                      variant={useCustomSubject ? "primary" : "secondary"}
                      style={styles.inlineButton}
                    />
                  </View>

                  <Text style={styles.sectionLabel}>{t(language, "subjectLabel")}</Text>
                  {useCustomSubject ? (
                    <TextInput value={customSubjectName} onChangeText={setCustomSubjectName} placeholder="Custom subject or course" placeholderTextColor="#8092A7" style={styles.input} />
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                      {localizedSubjects.map((entry) => (
                        <Pressable
                          key={entry.id}
                          onPress={() => {
                            setSubjectId(entry.id);
                            setTopicIds(entry.topics[0]?.id ? [entry.topics[0].id] : []);
                          }}
                          style={[styles.choiceChip, entry.id === selectedSubject?.id ? styles.choiceChipActive : null]}
                        >
                          <Text style={[styles.choiceChipText, entry.id === selectedSubject?.id ? styles.choiceChipTextActive : null]}>{entry.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}

                  <Text style={styles.sectionLabel}>{t(language, "grade")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {appVariant.allowedGrades.map((entry) => (
                      <Pressable key={entry} onPress={() => setGrade(entry)} style={[styles.choiceChip, entry === grade ? styles.choiceChipActive : null]}>
                        <Text style={[styles.choiceChipText, entry === grade ? styles.choiceChipTextActive : null]}>{entry}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.sectionLabel}>Question focus</Text>
                  <View style={styles.inlineActions}>
                    <PrimaryButton label={t(language, "general")} onPress={() => setFocusMode("general")} variant={focusMode === "general" ? "primary" : "secondary"} style={styles.inlineButton} />
                    <PrimaryButton label={t(language, "topicFocus")} onPress={() => setFocusMode("topic")} variant={focusMode === "topic" ? "primary" : "secondary"} style={styles.inlineButton} />
                  </View>

                  {focusMode === "topic" ? (
                    <>
                      <Text style={styles.sectionLabel}>{t(language, "topicLabel")}</Text>
                      <Text style={styles.helperText}>{t(language, "selectOneOrMoreTopics")}</Text>
                      {useCustomSubject ? (
                        <>
                          <TextInput
                            value={customTopicLabel}
                            onChangeText={setCustomTopicLabel}
                            placeholder={t(language, "enterCustomTopics")}
                            placeholderTextColor="#8092A7"
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                            style={[styles.input, styles.multilineTopicInput]}
                          />
                          <Text style={styles.helperText}>{t(language, "multipleCustomTopicsHint")}</Text>
                        </>
                      ) : selectedSubject ? (
                        <>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                            {selectedSubject.topics.map((entry) => (
                              <Pressable
                                key={entry.id}
                                onPress={() => {
                                  setTopicIds((current) =>
                                    current.includes(entry.id)
                                      ? current.filter((topicId) => topicId !== entry.id)
                                      : [...current, entry.id]
                                  );
                                }}
                                style={[styles.choiceChip, topicIds.includes(entry.id) ? styles.choiceChipActive : null]}
                              >
                                <Text style={[styles.choiceChipText, topicIds.includes(entry.id) ? styles.choiceChipTextActive : null]}>{entry.label}</Text>
                              </Pressable>
                            ))}
                            <Pressable
                              onPress={() => {
                                if (useCustomTopic) setCustomTopicLabel("");
                                setUseCustomTopic(!useCustomTopic);
                              }}
                              style={[styles.choiceChip, useCustomTopic ? styles.choiceChipActive : null]}
                            >
                              <Text style={[styles.choiceChipText, useCustomTopic ? styles.choiceChipTextActive : null]}>{t(language, "otherTopic")}</Text>
                            </Pressable>
                          </ScrollView>
                          {useCustomTopic ? (
                            <>
                              <TextInput
                                value={customTopicLabel}
                                onChangeText={setCustomTopicLabel}
                                placeholder={t(language, "enterCustomTopics")}
                                placeholderTextColor="#8092A7"
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                                style={[styles.input, styles.multilineTopicInput]}
                              />
                              <Text style={styles.helperText}>{t(language, "multipleCustomTopicsHint")}</Text>
                            </>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : null}

                  <Text style={styles.sectionLabel}>Difficulty</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {difficultyOptions.map((entry) => (
                      <Pressable key={entry} onPress={() => setDifficulty(entry)} style={[styles.choiceChip, entry === difficulty ? styles.choiceChipActive : null]}>
                        <Text style={[styles.choiceChipText, entry === difficulty ? styles.choiceChipTextActive : null]}>{getDifficultyLabel(language, entry)}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={styles.dualInputRow}>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>Level</Text>
                      <TextInput value={level} onChangeText={setLevel} keyboardType="number-pad" style={styles.input} />
                    </View>
                    <View style={styles.dualInputItem}>
                      <Text style={styles.sectionLabel}>Question count</Text>
                      <TextInput value={questionCount} onChangeText={setQuestionCount} keyboardType="number-pad" style={styles.input} />
                    </View>
                  </View>

                  <Pressable style={styles.sectionToggleSecondary} onPress={() => setActivityDetailsExpanded((current) => !current)}>
                    <Text style={styles.sectionLabel}>{t(language, "activityDetailsLabel")}</Text>
                    <Text style={styles.sectionToggleIcon}>{activityDetailsExpanded ? "-" : "+"}</Text>
                  </Pressable>

                  {activityDetailsExpanded ? (
                    <>
                      {activityType === "test" ? (
                        <>
                          <View style={styles.dualInputRow}>
                            <View style={styles.dualInputItem}>
                              <Text style={styles.sectionLabel}>{t(language, "testDate")}</Text>
                              <Pressable onPress={() => openDatePicker("startDate")} style={styles.pickerTrigger}>
                                <Text style={[styles.pickerValue, !startDate ? styles.pickerPlaceholder : null]}>
                                  {startDate || t(language, "selectDate")}
                                </Text>
                              </Pressable>
                            </View>
                            <View style={styles.dualInputItem}>
                              <Text style={styles.sectionLabel}>{t(language, "durationSeconds")}</Text>
                              <TextInput value={durationSeconds} onChangeText={setDurationSeconds} keyboardType="number-pad" style={styles.input} />
                            </View>
                          </View>

                          <View style={styles.dualInputRow}>
                            <View style={styles.dualInputItem}>
                              <Text style={styles.sectionLabel}>{t(language, "startTimeLabel")}</Text>
                              <Pressable onPress={() => openTimePicker("startTime")} style={styles.pickerTrigger}>
                                <Text style={[styles.pickerValue, !startTime ? styles.pickerPlaceholder : null]}>
                                  {startTime || t(language, "selectTime")}
                                </Text>
                              </Pressable>
                            </View>
                            <View style={styles.dualInputItem}>
                              <Text style={styles.sectionLabel}>{t(language, "endTimeLabel")}</Text>
                              <View style={styles.readOnlyField}>
                                <Text style={styles.readOnlyValue}>{computedTestEndAt ? computedTestEndTimeLabel : t(language, "setStartTimeAndDuration")}</Text>
                              </View>
                            </View>
                          </View>

                          <View style={styles.dualInputRow}>
                            <View style={styles.dualInputItem}>
                              <Text style={styles.sectionLabel}>{t(language, "customQuestion")}</Text>
                              <PrimaryButton
                                label={showCustomQuestionForm ? t(language, "hideCustomQuestion") : t(language, "customQuestion")}
                                variant="secondary"
                                onPress={() => setShowCustomQuestionForm((current) => !current)}
                              />
                            </View>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={styles.dualInputRow}>
                            <View style={styles.dualInputItem}>
                              <Text style={styles.sectionLabel}>{t(language, "deadlineDate")}</Text>
                              <Pressable onPress={() => openDatePicker("deadlineDate")} style={styles.pickerTrigger}>
                                <Text style={[styles.pickerValue, !deadlineDate ? styles.pickerPlaceholder : null]}>
                                  {deadlineDate || t(language, "selectDate")}
                                </Text>
                              </Pressable>
                            </View>
                          </View>

                          <View style={styles.dualInputRow}>
                            <View style={styles.dualInputItem}>
                              <Text style={styles.sectionLabel}>{t(language, "deadlineTime")}</Text>
                              <Pressable onPress={() => openTimePicker("deadlineTime")} style={styles.pickerTrigger}>
                                <Text style={[styles.pickerValue, !deadlineTime ? styles.pickerPlaceholder : null]}>
                                  {deadlineTime || t(language, "selectTime")}
                                </Text>
                              </Pressable>
                            </View>
                            <View style={styles.dualInputItem}>
                              <Text style={styles.sectionLabel}>{t(language, "customQuestion")}</Text>
                              <PrimaryButton
                                label={showCustomQuestionForm ? t(language, "hideCustomQuestion") : t(language, "customQuestion")}
                                variant="secondary"
                                onPress={() => setShowCustomQuestionForm((current) => !current)}
                              />
                            </View>
                          </View>
                        </>
                      )}

                      <Text style={styles.sectionLabel}>{t(language, "resultsLabel")}</Text>
                      <View style={styles.inlineActions}>
                        <PrimaryButton label={t(language, "privateLabel")} onPress={() => setResultVisibility("private")} variant={resultVisibility === "private" ? "primary" : "secondary"} style={styles.inlineButton} />
                        <PrimaryButton label={t(language, "publicLabel")} onPress={() => setResultVisibility("public")} variant={resultVisibility === "public" ? "primary" : "secondary"} style={styles.inlineButton} />
                      </View>

                      <Text style={styles.sectionLabel}>{t(language, "questionOrderLabel")}</Text>
                      <View style={styles.inlineActions}>
                        <PrimaryButton label={t(language, "sameForAll")} onPress={() => setQuestionOrderMode("same")} variant={questionOrderMode === "same" ? "primary" : "secondary"} style={styles.inlineButton} />
                        <PrimaryButton label={t(language, "shufflePerStudent")} onPress={() => setQuestionOrderMode("shuffled")} variant={questionOrderMode === "shuffled" ? "primary" : "secondary"} style={styles.inlineButton} />
                      </View>

                      {showCustomQuestionForm ? (
                        <View style={styles.questionCard}>
                          <Text style={styles.sectionLabel}>{t(language, "promptLabel")}</Text>
                          <TextInput value={customQuestionPrompt} onChangeText={setCustomQuestionPrompt} placeholder={t(language, "enterYourQuestion")} placeholderTextColor="#8092A7" style={[styles.input, styles.textAreaInput]} multiline />
                          {customQuestionOptions.map((option, index) => (
                            <View key={`custom-option-${index}`} style={styles.customOptionRow}>
                              <TextInput
                                value={option}
                                onChangeText={(value) => setCustomQuestionOptions((current) => current.map((entry, optionIndex) => (optionIndex === index ? value : entry)))}
                                placeholder={t(language, "optionLabel", { number: index + 1 })}
                                placeholderTextColor="#7C8EA3"
                                style={[styles.input, styles.customOptionInput]}
                              />
                              <Pressable onPress={() => setCustomQuestionAnswerIndex(index)} style={[styles.answerPick, customQuestionAnswerIndex === index ? styles.answerPickActive : null]}>
                                <Text style={[styles.answerPickText, customQuestionAnswerIndex === index ? styles.answerPickTextActive : null]}>
                                  {customQuestionAnswerIndex === index ? t(language, "correctOption") : t(language, "markCorrect")}
                                </Text>
                              </Pressable>
                            </View>
                          ))}
                          <TextInput value={customQuestionExplanation} onChangeText={setCustomQuestionExplanation} placeholder={t(language, "explanationOptional")} placeholderTextColor="#7C8EA3" style={[styles.input, styles.textAreaInput]} multiline />
                          <PrimaryButton label={t(language, "addCustomQuestion")} onPress={addCustomQuestion} />
                        </View>
                      ) : null}

                      <Text style={styles.sectionLabel}>{t(language, "questionCountLabel")} ({acceptedQuestions.length}/{desiredQuestionCount})</Text>
                      {acceptedQuestions.length < desiredQuestionCount ? (
                        currentCandidateQuestion ? (
                          <View style={styles.questionCard}>
                            <MathText value={currentCandidateQuestion.prompt} textStyle={styles.questionPrompt} />
                            {currentCandidateQuestion.options.map((option, index) => (
                              <MathText
                                key={`${currentCandidateQuestion.id}-option-${index}`}
                                value={`${index + 1}. ${option}`}
                                textStyle={styles.optionPreview}
                              />
                            ))}
                            <View style={styles.inlineActions}>
                              <PrimaryButton label={t(language, "accept")} onPress={() => acceptCandidate(currentCandidateQuestion)} style={styles.inlineButton} />
                              <PrimaryButton label={t(language, "skip")} variant="secondary" onPress={skipCandidate} style={styles.inlineButton} />
                            </View>
                          </View>
                        ) : (
                          <PrimaryButton label={candidateQuestions.length === 0 ? t(language, "loadQuestionCandidates") : t(language, "loadMoreQuestions")} onPress={generateCandidates} loading={candidateLoading} />
                        )
                      ) : (
                        <View style={styles.inlineActions}>
                          <PrimaryButton label={t(language, "reviewLabel")} variant="secondary" onPress={() => { setIsReviewingQuestions(true); setReviewPage(0); }} style={styles.inlineButton} />
                          <PrimaryButton label={editingActivityId ? t(language, "saveChanges") : activityType === "test" ? t(language, "publishTest") : t(language, "publishAssignment")} onPress={publishAssignment} loading={publishingAssignment} style={styles.inlineButton} />
                        </View>
                      )}

                      {isReviewingQuestions ? (
                        <View style={styles.reviewWrap}>
                          <Text style={styles.sectionLabel}>{t(language, "reviewLabel")}</Text>
                          {reviewQuestions.map((question) => (
                            <View key={question.id} style={styles.questionCard}>
                              <MathText value={question.prompt} textStyle={styles.questionPrompt} />
                              <PrimaryButton label={t(language, "remove")} variant="secondary" onPress={() => removeAcceptedQuestion(question.id)} />
                            </View>
                          ))}
                          <View style={styles.inlineActions}>
                            <PrimaryButton label={t(language, "previous")} variant="secondary" onPress={() => setReviewPage((current) => Math.max(0, current - 1))} disabled={reviewPage === 0} style={styles.inlineButton} />
                            <PrimaryButton label={t(language, "next")} variant="secondary" onPress={() => setReviewPage((current) => Math.min(reviewPageCount - 1, current + 1))} disabled={reviewPage >= reviewPageCount - 1} style={styles.inlineButton} />
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                    </>
                  ) : null}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t(language, "joinClass")}</Text>
              <TextInput
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder={t(language, "enterClassCode")}
                placeholderTextColor="#8092A7"
                style={styles.input}
                autoCapitalize="characters"
              />
              <PrimaryButton label={t(language, "requestJoin")} onPress={requestJoin} loading={saving} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t(language, "invites")}</Text>
              {pendingStudentInvites.length === 0 ? (
                <Text style={styles.helperText}>{t(language, "noInvites")}</Text>
              ) : (
                pendingStudentInvites.map(({ classroom, membership }) => (
                  <View key={membership.membershipId} style={styles.requestCard}>
                    <Text style={styles.classTitle}>{classroom.className}</Text>
                    <Text style={styles.classMeta}>{t(language, "teacherLabel")}: {classroom.teacherName}</Text>
                    <View style={styles.inlineActions}>
                      <PrimaryButton
                        label={t(language, "accept")}
                        onPress={() => respondToMembership(classroom, membership, "approve")}
                        style={styles.inlineButton}
                      />
                      <PrimaryButton
                        label={t(language, "reject")}
                        variant="secondary"
                        onPress={() => respondToMembership(classroom, membership, "reject")}
                        style={styles.inlineButton}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{profile.role === "teacher" ? t(language, "publishedActivities") : t(language, "classActivities")}</Text>
          {profile.role === "teacher" && selectedClass ? (
            <Text style={styles.helperText}>Showing activities for {selectedClass.className}.</Text>
          ) : null}
          {visibleActivities.length === 0 ? (
            <Text style={styles.helperText}>{t(language, "noActivitiesYet")}</Text>
          ) : (
            visibleActivities.map((activity) => (
              <View key={activity.activityId} style={styles.classCard}>
                <Text style={styles.classTitle}>{activity.title}</Text>
                <Text style={styles.classMeta}>
                  {activity.type === "test" ? t(language, "testType") : t(language, "assignmentType")} | {getSubjectDisplayName(activity.subjectId, activity.subjectName, language)} | {activity.grade} | {t(language, "levelLabel")} {activity.level}
                </Text>
                <Text style={styles.classMeta}>
                  {activity.status === "closed"
                    ? t(language, "closedLabel")
                    : activity.submitted
                      ? t(language, "submittedLabel")
                      : activity.status === "scheduled"
                        ? t(language, "startsLabel", { value: new Date(activity.startAt).toLocaleString() })
                        : t(language, "openUntilLabel", { value: new Date(activity.endAt).toLocaleString() })}
                </Text>
                <Text style={styles.classMeta}>{t(language, "questionsLabel", { count: activity.questionCount })}</Text>
                {profile.role === "teacher" ? (
                  <View style={styles.activityActionRow}>
                    <PrimaryButton
                      label={canEditScheduledActivity(activity) ? t(language, "edit") : t(language, "locked")}
                      variant="secondary"
                      onPress={() => editActivity(activity)}
                      loading={classActionLoading}
                      style={styles.activityActionButton}
                      compact
                      disabled={!canEditScheduledActivity(activity)}
                    />
                    <PrimaryButton
                      label={t(language, "resultsAction")}
                      variant="secondary"
                      onPress={() => openActivityDashboard(activity)}
                      style={styles.activityActionButton}
                      compact
                    />
                    <PrimaryButton
                      label={t(language, "duplicate")}
                      onPress={() => duplicateActivity(activity)}
                      loading={classActionLoading}
                      style={styles.activityActionButton}
                      compact
                    />
                  </View>
                ) : (
                  <PrimaryButton
                    label={
                      activity.submitted
                        ? t(language, "viewResult")
                        : activity.status === "closed"
                          ? t(language, "viewResult")
                          : activity.status === "scheduled"
                            ? t(language, "waitForStart")
                            : activity.type === "test"
                              ? t(language, "start", { mode: t(language, "testType").toLowerCase() })
                              : t(language, "start", { mode: t(language, "assignmentType").toLowerCase() })
                    }
                    onPress={() =>
                      activity.submitted || activity.status === "closed"
                        ? openStudentResult(activity)
                        : openActivity(activity)
                    }
                    disabled={activity.status === "scheduled"}
                  />
                )}
              </View>
            ))
          )}
        </View>

      </ScrollView>
      <Modal
        visible={showInviteLinkOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInviteLinkOptions(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowInviteLinkOptions(false)}>
          <Pressable style={styles.shareModalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{t(language, "shareClassInvite")}</Text>
            <Text style={styles.helperText}>{t(language, "shareClassInviteHint")}</Text>
            {selectedClass ? (
              <Text style={styles.inviteLinkText}>
                {createClassroomInvitationLink(selectedClass.classCode, selectedClass.className)}
              </Text>
            ) : null}
            <View style={styles.shareGrid}>
              {[
                ["whatsapp", "WhatsApp", "chat"],
                ["email", "Email", "email"],
                ["telegram", "Telegram", "send"],
                ["sms", "SMS", "sms"],
                ["more", t(language, "moreShareApps"), "share"],
                ["copy", t(language, "copyInviteLink"), "link"],
              ].map(([channel, label, icon]) => (
                <Pressable
                  key={channel}
                  style={styles.shareOption}
                  onPress={() => void shareClassInvitation(channel as "whatsapp" | "email" | "telegram" | "sms" | "more" | "copy")}
                >
                  <MaterialIcons name={icon as never} size={24} color={palette.navy} />
                  <Text style={styles.shareOptionText}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <PrimaryButton label={t(language, "cancel")} variant="ghost" onPress={() => setShowInviteLinkOptions(false)} />
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={openPicker !== null} transparent animationType="fade" onRequestClose={() => setOpenPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpenPicker(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            {openPicker === "startDate" || openPicker === "deadlineDate" ? (
              <>
                <View style={styles.modalHeader}>
                  <Pressable
                    onPress={() => canGoToPreviousMonth && setPickerMonth((current) => addMonths(current, -1))}
                    disabled={!canGoToPreviousMonth}
                    style={[styles.modalIconButton, !canGoToPreviousMonth ? styles.modalIconButtonDisabled : null]}
                  >
                    <MaterialIcons name="chevron-left" size={24} color={canGoToPreviousMonth ? palette.navy : "#A7B5C6"} />
                  </Pressable>
                  <Text style={styles.modalTitle}>
                    {pickerMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
                  </Text>
                  <Pressable onPress={() => setPickerMonth((current) => addMonths(current, 1))} style={styles.modalIconButton}>
                    <MaterialIcons name="chevron-right" size={24} color={palette.navy} />
                  </Pressable>
                </View>
                <View style={styles.calendarWeekRow}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <Text key={day} style={styles.calendarWeekday}>
                      {day}
                    </Text>
                  ))}
                </View>
                <View style={styles.calendarGrid}>
                  {calendarDays.map((entry) => {
                    const selectedValue =
                      openPicker === "startDate"
                        ? startDate
                        : deadlineDate;
                    const todayValue = formatLocalDateValue(new Date());
                    const isSelected = selectedValue === entry.value;
                    const isPastDate = entry.value < todayValue;
                    return (
                      <Pressable
                        key={entry.key}
                        onPress={() => {
                          if (!isPastDate) {
                            selectDateValue(entry.value);
                          }
                        }}
                        disabled={isPastDate}
                        style={[
                          styles.calendarCell,
                          !entry.inMonth ? styles.calendarCellMuted : null,
                          isPastDate ? styles.calendarCellDisabled : null,
                          isSelected ? styles.calendarCellActive : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarCellText,
                            !entry.inMonth ? styles.calendarCellTextMuted : null,
                            isPastDate ? styles.calendarCellTextDisabled : null,
                            isSelected ? styles.calendarCellTextActive : null,
                          ]}
                        >
                          {entry.date.getDate()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : openPicker === "deadlineTime" ? (
              <>
                <Text style={styles.modalTitle}>{t(language, "selectTimeTitle")}</Text>
                <ScrollView style={styles.modalList} nestedScrollEnabled>
                  {quarterHourOptions.map((value) => (
                    <Pressable
                      key={`deadline-${value}`}
                      onPress={() => {
                        setDeadlineTime(value);
                        setOpenPicker(null);
                      }}
                      style={[styles.modalListItem, deadlineTime === value ? styles.modalListItemActive : null]}
                    >
                      <Text style={[styles.modalListItemText, deadlineTime === value ? styles.modalListItemTextActive : null]}>{value}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>{t(language, "selectTimeTitle")}</Text>
                <View style={styles.timePickerRow}>
                  <ScrollView style={styles.timePickerColumn} nestedScrollEnabled>
                    {hourOptions.map((hour) => (
                      <Pressable
                        key={`hour-${hour}`}
                        onPress={() => setPickerHour(hour)}
                        style={[styles.modalListItem, pickerHour === hour ? styles.modalListItemActive : null]}
                      >
                        <Text style={[styles.modalListItemText, pickerHour === hour ? styles.modalListItemTextActive : null]}>{hour}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <ScrollView style={styles.timePickerColumn} nestedScrollEnabled>
                    {minuteOptions.map((minute) => (
                      <Pressable
                        key={`minute-${minute}`}
                        onPress={() => setPickerMinute(minute)}
                        style={[styles.modalListItem, pickerMinute === minute ? styles.modalListItemActive : null]}
                      >
                        <Text style={[styles.modalListItemText, pickerMinute === minute ? styles.modalListItemTextActive : null]}>{minute}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <PrimaryButton label={t(language, "setTime")} onPress={confirmTimeValue} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 22,
  },
  heroTitle: {
    color: palette.white,
    fontSize: 32,
    fontWeight: "900",
  },
  identityRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  identityChip: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 12,
  },
  identityLabel: {
    color: "#D6ECF9",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  identityValue: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 6,
  },
  identityCopyHint: {
    color: "#D6ECF9",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  centerCard: {
    marginTop: 36,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    ...shadows.card,
  },
  centerTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30,
  },
  card: {
    marginTop: 18,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    ...shadows.card,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  sectionToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionToggleSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#EEF3F8",
  },
  sectionToggleIcon: {
    color: palette.navy,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    color: palette.ink,
  },
  multilineTopicInput: {
    minHeight: 88,
    paddingTop: 14,
    paddingBottom: 14,
  },
  pickerTrigger: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F9FBFD",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  pickerValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  pickerPlaceholder: {
    color: "#7C8EA3",
    fontWeight: "500",
  },
  pickerMenu: {
    maxHeight: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: palette.white,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F8",
  },
  pickerOptionText: {
    color: palette.ink,
    fontWeight: "600",
  },
  readOnlyField: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    backgroundColor: "#F2F5F8",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  readOnlyValue: {
    color: palette.ink,
    fontWeight: "600",
  },
  textAreaInput: {
    minHeight: 90,
    paddingVertical: 12,
    textAlignVertical: "top",
  },
  helperText: {
    color: palette.slate,
    lineHeight: 20,
  },
  classCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    padding: 14,
    gap: 6,
  },
  classCardActive: {
    borderColor: palette.navy,
    backgroundColor: "#EEF8FB",
  },
  classTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  classMeta: {
    color: palette.slate,
    lineHeight: 20,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  copyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F4F7",
  },
  requestCard: {
    borderRadius: 18,
    backgroundColor: "#F6FAFD",
    padding: 14,
    gap: 8,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7E0EA",
    padding: 14,
  },
  memberMeta: {
    flex: 1,
    gap: 4,
  },
  memberAction: {
    minWidth: 110,
  },
  requestTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  inlineButton: {
    flex: 1,
    minWidth: 130,
  },
  activityActionRow: {
    flexDirection: "row",
    gap: 8,
  },
  activityActionButton: {
    flex: 1,
    minWidth: 0,
  },
  sectionLabel: {
    color: palette.slate,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  choiceChip: {
    borderRadius: 16,
    backgroundColor: "#F2F5F8",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceChipActive: {
    backgroundColor: palette.navy,
  },
  choiceChipText: {
    color: palette.navy,
    fontWeight: "700",
  },
  choiceChipTextActive: {
    color: palette.white,
  },
  dualInputRow: {
    flexDirection: "row",
    gap: 12,
  },
  dualInputItem: {
    flex: 1,
    gap: 8,
  },
  customOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customOptionInput: {
    flex: 1,
  },
  answerPick: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D6E0EA",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FBFD",
  },
  answerPickActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  answerPickText: {
    color: palette.navy,
    fontWeight: "800",
  },
  answerPickTextActive: {
    color: palette.white,
  },
  questionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8E3EC",
    backgroundColor: "#FBFDFF",
    padding: 14,
    gap: 10,
  },
  questionPrompt: {
    color: palette.ink,
    lineHeight: 22,
    fontWeight: "700",
  },
  optionPreview: {
    color: palette.slate,
    lineHeight: 20,
  },
  reviewWrap: {
    gap: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8,17,31,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 720,
    maxHeight: "90%",
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 18,
    gap: 14,
    ...shadows.card,
  },
  shareModalCard: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 24,
    backgroundColor: palette.white,
    padding: 20,
    gap: 14,
    ...shadows.card,
  },
  inviteLinkText: {
    color: palette.navy,
    fontSize: 13,
    lineHeight: 19,
  },
  shareGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  shareOption: {
    width: "47%",
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D8E3EC",
    backgroundColor: "#F8FBFD",
    padding: 12,
  },
  shareOptionText: {
    color: palette.ink,
    textAlign: "center",
    fontWeight: "800",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  modalIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF6FB",
  },
  modalIconButtonDisabled: {
    backgroundColor: "#F4F7FA",
  },
  calendarWeekRow: {
    flexDirection: "row",
  },
  calendarWeekday: {
    flex: 1,
    textAlign: "center",
    color: palette.slate,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.2857%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  calendarCellMuted: {
    opacity: 0.35,
  },
  calendarCellDisabled: {
    backgroundColor: "#F4F6F8",
  },
  calendarCellActive: {
    backgroundColor: palette.navy,
  },
  calendarCellText: {
    color: palette.ink,
    fontWeight: "700",
  },
  calendarCellTextMuted: {
    color: palette.slate,
  },
  calendarCellTextDisabled: {
    color: "#B6C1CC",
  },
  calendarCellTextActive: {
    color: palette.white,
  },
  modalList: {
    maxHeight: 320,
  },
  timePickerRow: {
    flexDirection: "row",
    gap: 12,
  },
  timePickerColumn: {
    flex: 1,
    maxHeight: 280,
  },
  modalListItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF3F8",
  },
  modalListItemActive: {
    backgroundColor: "#EEF8FB",
  },
  modalListItemText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  modalListItemTextActive: {
    color: palette.navy,
    fontWeight: "800",
  },
});
