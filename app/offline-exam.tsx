import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import {
  listOfflineExamAttempts,
  listOfflineExamPackages,
  offlineResponseFilename,
  openOfflineExamPackage,
  saveOfflineExamAttempt,
  saveOfflineExamPackage,
  serializeOfflineResponse,
  type OfflineExamAttempt,
  type StoredOfflineExamPackage,
} from "../lib/offline-exams";
import { readAppState } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import { recordClassroomActivitySecurityEvent, submitClassroomActivity } from "../services/ai";
import type { OfflineExamPayload, OfflineExamStudentQuestion, UserProfile } from "../types/app";

function seededNumber(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return () => ((hash = Math.imul(hash ^ (hash >>> 13), 16777619)) >>> 0) / 4294967296;
}

function shuffled<T>(items: T[], seed: string) {
  const next = [...items]; const random = seededNumber(seed);
  for (let index = next.length - 1; index > 0; index--) { const target = Math.floor(random() * (index + 1)); [next[index], next[target]] = [next[target], next[index]]; }
  return next;
}

async function documentText(asset: DocumentPicker.DocumentPickerAsset) {
  if (Platform.OS === "web" && asset.file) return asset.file.text();
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
}

async function shareText(filename: string, content: string) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([content], { type: "application/vnd.quiks.response+json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
  }
  if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device.");
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: "application/vnd.quiks.response+json", dialogTitle: "Export offline examination response" });
}

export default function OfflineExamPlayerScreen() {
  const [packages, setPackages] = useState<StoredOfflineExamPackage[]>([]);
  const [selectedStored, setSelectedStored] = useState<StoredOfflineExamPackage | null>(null);
  const [pendingEnvelope, setPendingEnvelope] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [payload, setPayload] = useState<OfflineExamPayload | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [candidateNumber, setCandidateNumber] = useState("");
  const [attempt, setAttempt] = useState<OfflineExamAttempt | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  async function refresh() {
    const [saved, state] = await Promise.all([listOfflineExamPackages(), readAppState()]);
    setPackages(saved); const active = state.profiles.find((entry) => entry.id === state.currentProfileId) ?? null; setProfile(active);
    if (active) { setCandidateName(active.name); setCandidateNumber(active.quiksId); }
    if (active?.role === "student") {
      const attempts = await listOfflineExamAttempts();
      for (const queued of attempts.filter((entry) => entry.status === "pending_sync")) {
        try {
          for (const event of queued.securityEvents ?? []) await recordClassroomActivitySecurityEvent({ profile: active, activityId: queued.activityId, event });
          await submitClassroomActivity({ profile: active, activityId: queued.activityId, answers: queued.answers, timeTakenSeconds: queued.timeTakenSeconds ?? 0, autoSubmitted: false });
          await saveOfflineExamAttempt({ ...queued, status: "synced" });
        } catch { /* Remain queued until connectivity and authorization are available. */ }
      }
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (!attempt || attempt.status !== "in_progress") return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - attempt.startedAt) / 1000);
      const remaining = Math.max(0, (payload?.durationMinutes ?? 0) * 60 - elapsed); setRemainingSeconds(remaining);
      if (remaining === 0) void finishAttempt(true);
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt?.attemptId, attempt?.status, payload?.durationMinutes]);
  useEffect(() => {
    if (!attempt || !payload || attempt.status !== "in_progress") return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "background" && state !== "inactive") return;
      void (async () => {
        const recorded = await recordLocalSecurityEvent("app_background");
        if (payload.exitPolicy === "strict_submit") await finishAttempt(true, recorded);
      })();
    });
    return () => subscription.remove();
  }, [attempt?.attemptId, attempt?.status, payload?.exitPolicy]);
  useEffect(() => {
    if (!attempt || !payload || attempt.status !== "in_progress" || Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      void (async () => {
        const recorded = await recordLocalSecurityEvent("exit_attempt");
        if (payload.exitPolicy === "strict_submit") await finishAttempt(true, recorded);
        else if (payload.exitPolicy === "confirm_submit") Alert.alert("Exit examination?", "Leaving now will submit your saved answers.", [{ text: "Continue exam", style: "cancel" }, { text: "Submit and exit", style: "destructive", onPress: () => void finishAttempt(true, recorded) }]);
        else Alert.alert("Examination in progress", "Your exit attempt has been recorded. Submit the examination before leaving this screen.");
      })();
      return true;
    });
    return () => subscription.remove();
  }, [attempt?.attemptId, attempt?.status, payload?.exitPolicy]);

  const questions = useMemo(() => {
    if (!payload) return [];
    const ordered = payload.questionOrderMode === "shuffled" ? shuffled(payload.questions, `${payload.packageId}:${candidateNumber}`) : payload.questions;
    return ordered.map((question) => payload.randomizeOptions && question.type === "objective" ? { ...question, options: shuffled(question.options, `${payload.packageId}:${candidateNumber}:${question.id}`) } : question);
  }, [payload, candidateNumber]);
  const currentQuestion = questions[questionIndex];
  const currentAnswer = attempt?.answers.find((entry) => entry.questionId === currentQuestion?.id)?.answer ?? "";

  async function pickPackage() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "application/octet-stream", "*/*"], copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    setPendingEnvelope(await documentText(result.assets[0])); setSelectedStored(null); setPayload(null); setActivationCode("");
  }
  async function unlock() {
    const envelope = pendingEnvelope || selectedStored?.envelope;
    if (!envelope) return;
    setBusy(true);
    try {
      const opened = await openOfflineExamPackage(envelope, activationCode);
      if (opened.deploymentFormat === "exam_hub") throw new Error("This package is for the separate Quiks Exam Hub on the school's local network.");
      if (opened.deploymentFormat === "printable_pdf") throw new Error("This package is configured as a printable paper. The teacher should print it from the activity results page.");
      await saveOfflineExamPackage(opened, envelope); setPayload(opened); setCandidateName(profile?.name ?? candidateName); setCandidateNumber(profile?.quiksId ?? candidateNumber);
      const resumable = (await listOfflineExamAttempts()).find((entry) => entry.packageId === opened.packageId && entry.status === "in_progress");
      if (resumable) { setAttempt(resumable); setCandidateName(resumable.candidateName); setCandidateNumber(resumable.candidateNumber); }
      await refresh();
    } catch (error) { Alert.alert("Package not opened", error instanceof Error ? error.message : "Unable to open this package."); }
    finally { setBusy(false); }
  }
  async function startAttempt() {
    if (!payload || !candidateName.trim() || !candidateNumber.trim()) { Alert.alert("Candidate details required", "Enter the candidate's name and identification number."); return; }
    if (payload.startsAt > Date.now()) { Alert.alert("Examination not started", `This examination opens ${new Date(payload.startsAt).toLocaleString()}.`); return; }
    if (payload.deliveryMode === "offline_sync" && (!profile || profile.role !== "student")) { Alert.alert("Student profile required", "Sign in and select the enrolled student profile before starting a synchronized offline examination."); return; }
    const prior = (await listOfflineExamAttempts()).filter((entry) => entry.packageId === payload.packageId);
    if (prior.some((entry) => entry.candidateNumber.toLowerCase() === candidateNumber.trim().toLowerCase())) { Alert.alert("Attempt already exists", "This candidate number already has an attempt for this examination on this device."); return; }
    if (new Set(prior.map((entry) => entry.candidateNumber.toLowerCase())).size >= payload.maxDevices) { Alert.alert("Device limit reached", "This package has reached its authorised candidate/device limit on this device. Use Quiks Exam Hub for school-wide enforcement."); return; }
    const next: OfflineExamAttempt = { attemptId: Crypto.randomUUID(), packageId: payload.packageId, activityId: payload.activityId, candidateName: candidateName.trim(), candidateNumber: candidateNumber.trim(), answers: [], securityEvents: [], startedAt: Date.now(), status: "in_progress" };
    await saveOfflineExamAttempt(next); setAttempt(next); setQuestionIndex(0); setRemainingSeconds(payload.durationMinutes * 60);
  }
  async function answerQuestion(question: OfflineExamStudentQuestion, answer: string) {
    if (!attempt) return;
    const next = { ...attempt, answers: [...attempt.answers.filter((entry) => entry.questionId !== question.id), { questionId: question.id, answer }] };
    setAttempt(next); await saveOfflineExamAttempt(next);
  }
  async function recordLocalSecurityEvent(eventType: "exit_attempt" | "app_background" | "tab_hidden") {
    if (!attempt || attempt.status !== "in_progress") return attempt;
    const next = { ...attempt, securityEvents: [...(attempt.securityEvents ?? []), { eventType, occurredAt: Date.now() }] };
    setAttempt(next); await saveOfflineExamAttempt(next);
    return next;
  }
  async function finishAttempt(autoSubmitted = false, sourceAttempt = attempt) {
    if (!sourceAttempt || !payload || submittingRef.current || sourceAttempt.status !== "in_progress") return;
    submittingRef.current = true;
    try {
      const completed: OfflineExamAttempt = { ...sourceAttempt, submittedAt: Date.now(), timeTakenSeconds: Math.max(0, Math.floor((Date.now() - sourceAttempt.startedAt) / 1000)), status: payload.deliveryMode === "offline_sync" ? "pending_sync" : "completed" };
      await saveOfflineExamAttempt(completed); setAttempt(completed);
      if (payload.deliveryMode === "offline_sync" && profile) {
        try { for (const event of completed.securityEvents ?? []) await recordClassroomActivitySecurityEvent({ profile, activityId: payload.activityId, event }); await submitClassroomActivity({ profile, activityId: payload.activityId, answers: completed.answers, timeTakenSeconds: completed.timeTakenSeconds ?? 0, autoSubmitted }); const synced = { ...completed, status: "synced" as const }; await saveOfflineExamAttempt(synced); setAttempt(synced); }
        catch { Alert.alert("Saved securely", "The attempt is queued on this device and will be submitted to Quiks when connectivity returns."); }
      } else if (payload.responseMode === "device_export" && payload.allowLocalResponseExport) {
        await shareText(offlineResponseFilename(payload, completed), serializeOfflineResponse(payload, completed));
      }
    } finally { submittingRef.current = false; }
  }

  if (payload && attempt?.status === "in_progress" && currentQuestion) return <AppBackground scroll={false}><View style={styles.examHeader}><Text style={styles.examTitle}>{payload.title}</Text><Text style={styles.timer}>{Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}</Text></View><ScrollView contentContainerStyle={styles.examContent}><View style={styles.card}><Text style={styles.meta}>Question {questionIndex + 1} of {questions.length}{payload.showQuestionPoints ? ` · ${currentQuestion.points} mark${currentQuestion.points === 1 ? "" : "s"}` : ""}</Text><Text style={styles.question}>{currentQuestion.prompt}</Text>{currentQuestion.image ? <Image source={{ uri: `data:${currentQuestion.image.mimeType};base64,${currentQuestion.image.dataBase64}` }} style={styles.image} resizeMode="contain"/> : null}{currentQuestion.type === "written" ? <TextInput value={currentAnswer} onChangeText={(value) => void answerQuestion(currentQuestion, value)} multiline placeholder="Write your answer" style={[styles.input, styles.answerBox]}/> : currentQuestion.options.map((option) => <Pressable key={option} style={[styles.option, currentAnswer === option && styles.optionSelected]} onPress={() => void answerQuestion(currentQuestion, option)}><Text style={styles.optionText}>{option}</Text></Pressable>)}<View style={styles.row}><PrimaryButton label="Previous" variant="secondary" disabled={questionIndex === 0 || payload.navigationMode === "linear"} onPress={() => setQuestionIndex((index) => Math.max(0, index - 1))}/><PrimaryButton label={questionIndex === questions.length - 1 ? "Submit examination" : "Next"} onPress={() => questionIndex === questions.length - 1 ? void finishAttempt(false) : setQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}/></View></View></ScrollView></AppBackground>;

  return <AppBackground><View style={styles.hero}><Text style={styles.heroTitle}>Quiks Exam Player</Text><Text style={styles.heroCopy}>Import and sit signed offline examinations. Student questions remain encrypted until a proctor enters the activation code.</Text></View>
    <View style={styles.card}><Text style={styles.heading}>Import examination</Text><PrimaryButton label="Choose .qexam file" onPress={() => void pickPackage()}/>{pendingEnvelope ? <Text style={styles.success}>Package selected. Enter the activation code to verify and open it.</Text> : null}</View>
    {!!packages.length && <View style={styles.card}><Text style={styles.heading}>Examinations on this device</Text>{packages.map((entry) => <Pressable key={entry.packageId} style={styles.saved} onPress={() => { setSelectedStored(entry); setPendingEnvelope(""); setPayload(null); setActivationCode(""); }}><Text style={styles.savedTitle}>{entry.title}</Text><Text style={styles.meta}>{entry.className} · {entry.subjectName} · expires {new Date(entry.expiresAt).toLocaleString()}</Text></Pressable>)}</View>}
    {(pendingEnvelope || selectedStored) && !payload ? <View style={styles.card}><Text style={styles.heading}>Proctor activation</Text><TextInput value={activationCode} onChangeText={setActivationCode} secureTextEntry autoCapitalize="characters" placeholder="Activation code" style={styles.input}/><PrimaryButton label="Verify and open package" loading={busy} onPress={() => void unlock()}/></View> : null}
    {payload && !attempt ? <View style={styles.card}><Text style={styles.heading}>{payload.title}</Text><Text style={styles.meta}>{payload.className} · {payload.subjectName} · {payload.durationMinutes} minutes</Text><Text>{payload.instructions || "Follow the school's examination instructions."}</Text><TextInput value={candidateName} editable={!profile} onChangeText={setCandidateName} placeholder="Candidate name" style={styles.input}/><TextInput value={candidateNumber} editable={!profile} onChangeText={setCandidateNumber} placeholder="Candidate number" style={styles.input}/><PrimaryButton label={payload.responseMode === "paper" ? "Open question paper" : "Start examination"} onPress={() => void startAttempt()}/></View> : null}
    {payload && attempt && attempt.status !== "in_progress" ? <View style={styles.card}><Text style={styles.heading}>Attempt completed</Text><Text style={styles.success}>{attempt.status === "synced" ? "Submitted successfully to Quiks." : attempt.status === "pending_sync" ? "Saved securely and awaiting Quiks synchronization." : "Saved locally for the school."}</Text>{payload.allowLocalResponseExport ? <PrimaryButton label="Export local response" onPress={() => void shareText(offlineResponseFilename(payload, attempt), serializeOfflineResponse(payload, attempt))}/> : null}<PrimaryButton label="Back to packages" variant="secondary" onPress={() => { setPayload(null); setAttempt(null); setSelectedStored(null); setPendingEnvelope(""); }}/></View> : null}
    <PrimaryButton label="Back" variant="ghost" onPress={() => router.back()}/>
  </AppBackground>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: palette.navy, borderRadius: 24, padding: 22, gap: 8, ...shadows.card }, heroTitle: { color: "white", fontSize: 30, fontWeight: "900" }, heroCopy: { color: "white", lineHeight: 21 },
  card: { backgroundColor: "white", borderRadius: 22, padding: 18, gap: 13, ...shadows.card }, heading: { color: palette.ink, fontSize: 21, fontWeight: "900" }, meta: { color: palette.slate, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: "#CBDDE4", borderRadius: 14, padding: 13, color: palette.ink, backgroundColor: "#F8FBFC" }, success: { color: "#087A55", fontWeight: "700", lineHeight: 20 },
  saved: { borderWidth: 1, borderColor: "#DDE8ED", borderRadius: 14, padding: 13, gap: 4 }, savedTitle: { color: palette.navy, fontWeight: "900", fontSize: 17 },
  examHeader: { backgroundColor: palette.navy, padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, examTitle: { color: "white", fontWeight: "900", fontSize: 18, flex: 1 }, timer: { color: "white", fontWeight: "900", fontSize: 20 },
  examContent: { padding: 18 }, question: { color: palette.ink, fontSize: 20, lineHeight: 29, fontWeight: "700" }, image: { width: "100%", height: 260 }, option: { borderWidth: 1, borderColor: "#CBDDE4", borderRadius: 14, padding: 14 }, optionSelected: { borderColor: palette.navy, backgroundColor: "#E7F5F6" }, optionText: { color: palette.ink, fontSize: 16 }, answerBox: { minHeight: 150, textAlignVertical: "top" }, row: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
});
