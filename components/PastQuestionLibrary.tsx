import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { extractDocxText } from "../lib/question-document";
import { palette } from "../lib/theme";
import { searchPastQuestions, submitPastQuestions } from "../services/ai";
import type { PastQuestionAttachmentInput, PastQuestionSet, UserProfile } from "../types/app";
import { PrimaryButton } from "./PrimaryButton";

type Props = {
  profile: UserProfile | null;
  canGenerate: () => boolean;
  onGenerationUsed: () => Promise<void>;
  onLimitReached: () => void;
};

const MAX_UPLOAD_BYTES = 6_000_000;

async function webFileBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function PastQuestionResults({ sets }: { sets: PastQuestionSet[] }) {
  return (
    <View style={styles.results}>
      {sets.map((set) => (
        <View key={set.id} style={styles.setCard}>
          <Text style={styles.setTitle}>{set.examTitle} · {set.year}</Text>
          {set.subject ? <Text style={styles.subject}>{set.subject}</Text> : null}
          {set.questions.map((question, index) => (
            <View key={question.id || `${set.id}-${index}`} style={styles.questionCard}>
              <Text style={styles.prompt}>{question.number || index + 1}. {question.prompt}</Text>
              {question.options.map((option, optionIndex) => <Text key={`${question.id}-option-${optionIndex}`} style={styles.option}>{String.fromCharCode(65 + optionIndex)}. {option}</Text>)}
              <Text style={styles.answerLabel}>Answer</Text>
              <Text style={styles.answer}>{question.answer}</Text>
              <Text style={styles.explanation}>{question.explanation}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function PastQuestionLibrary({ profile, canGenerate, onGenerationUsed, onLimitReached }: Props) {
  const [examTitle, setExamTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [attachment, setAttachment] = useState<PastQuestionAttachmentInput | undefined>();
  const [shareConfirmed, setShareConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [solved, setSolved] = useState<PastQuestionSet[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PastQuestionSet[] | null>(null);

  const chooseDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "image/png", "image/jpeg", "image/webp"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > MAX_UPLOAD_BYTES) throw new Error("The uploaded document must be 6 MB or smaller.");
      const extension = asset.name.toLowerCase().split(".").pop() ?? "";
      const mimeType = extension === "pdf" ? "application/pdf"
        : extension === "png" ? "image/png"
          : ["jpg", "jpeg"].includes(extension) ? "image/jpeg"
            : extension === "webp" ? "image/webp"
              : asset.mimeType ?? "";
      if (mimeType === "text/plain" || extension === "txt") {
        const text = Platform.OS === "web" && asset.file ? await asset.file.text() : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
        setQuestionText((current) => [current.trim(), text.trim()].filter(Boolean).join("\n\n"));
        setAttachment(undefined);
        return;
      }
      const dataBase64 = Platform.OS === "web" && asset.file
        ? await webFileBase64(asset.file)
        : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      if (mimeType.includes("wordprocessingml") || extension === "docx") {
        const text = await extractDocxText(dataBase64);
        setQuestionText((current) => [current.trim(), text.trim()].filter(Boolean).join("\n\n"));
        setAttachment(undefined);
        return;
      }
      if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(mimeType)) throw new Error("Use PDF, DOCX, TXT, PNG, JPEG or WebP.");
      setAttachment({ name: asset.name, mimeType: mimeType as PastQuestionAttachmentInput["mimeType"], size: asset.size ?? Math.ceil(dataBase64.length * 0.75), dataBase64 });
    } catch (error) {
      Alert.alert("Past Q&A", error instanceof Error ? error.message : "The document could not be read.");
    }
  };

  const solve = async () => {
    if (!examTitle.trim() || !subject.trim() || !year.trim() || (!questionText.trim() && !attachment)) {
      Alert.alert("Past Q&A", "Enter the exam title, subject and year, then paste questions or upload a document.");
      return;
    }
    if (!shareConfirmed) {
      Alert.alert("Past Q&A", "Confirm that you have permission to share this material in the Quiks library.");
      return;
    }
    if (!canGenerate()) { onLimitReached(); return; }
    setLoading(true);
    try {
      const response = await submitPastQuestions({ examTitle: examTitle.trim(), subject: subject.trim(), year: year.trim(), questionText: questionText.trim() || undefined, attachment, shareConfirmed, profile });
      setSolved([response.item]);
      await onGenerationUsed();
      Alert.alert("Past Q&A", response.duplicate ? "This paper was already in the library. Its solved copy is shown below." : "Questions solved and added to the Past Q&A library.");
    } catch (error) {
      Alert.alert("Past Q&A", error instanceof Error ? error.message : "The questions could not be processed.");
    } finally { setLoading(false); }
  };

  const search = async () => {
    if (searchQuery.trim().length < 2) return;
    setSearching(true);
    try {
      const response = await searchPastQuestions(searchQuery.trim());
      setSearchResults(response.items);
    } catch (error) {
      Alert.alert("Past Q&A", error instanceof Error ? error.message : "The library search failed.");
    } finally { setSearching(false); }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}><Text style={styles.title}>Past Q&A</Text><Text style={styles.hint}>Upload or paste a past paper to receive worked answers.</Text></View>
        <Pressable accessibilityLabel="Search past questions" onPress={() => { setSearchOpen((value) => !value); setSearchResults(null); }} style={styles.searchIcon}>
          <MaterialIcons name="search" size={25} color={palette.white} />
        </Pressable>
      </View>
      {searchOpen ? (
        <View style={styles.searchPanel}>
          <TextInput value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={search} returnKeyType="search" placeholder="Search exam, year, subject or question" placeholderTextColor="#7C8EA3" style={[styles.input, styles.searchInput]} />
          <PrimaryButton label="Search" onPress={search} loading={searching} compact />
          {searchResults?.length === 0 ? <Text style={styles.empty}>Past Question not available</Text> : null}
          {searchResults?.length ? <PastQuestionResults sets={searchResults} /> : null}
        </View>
      ) : null}

      <Text style={styles.label}>Exam title</Text>
      <TextInput value={examTitle} onChangeText={setExamTitle} placeholder="e.g. Cambridge IGCSE" placeholderTextColor="#7C8EA3" style={styles.input} />
      <Text style={styles.label}>Subject</Text>
      <TextInput value={subject} onChangeText={setSubject} placeholder="e.g. Biology" placeholderTextColor="#7C8EA3" style={styles.input} />
      <Text style={styles.label}>Year</Text>
      <TextInput value={year} onChangeText={setYear} placeholder="e.g. 2025" placeholderTextColor="#7C8EA3" keyboardType="number-pad" style={styles.input} />
      <Text style={styles.label}>Paste past questions</Text>
      <TextInput value={questionText} onChangeText={setQuestionText} multiline textAlignVertical="top" placeholder="Paste the questions here, or upload a document below." placeholderTextColor="#7C8EA3" style={[styles.input, styles.textArea]} />
      <PrimaryButton label="Upload past-question document" variant="secondary" onPress={chooseDocument} style={styles.uploadButton} />
      {attachment ? <View style={styles.fileRow}><MaterialIcons name="description" size={20} color={palette.navy} /><Text numberOfLines={1} style={styles.fileName}>{attachment.name}</Text><Pressable onPress={() => setAttachment(undefined)}><MaterialIcons name="close" size={22} color="#B42318" /></Pressable></View> : null}
      <View style={styles.consentRow}>
        <Switch value={shareConfirmed} onValueChange={setShareConfirmed} trackColor={{ false: "#CCD6DF", true: palette.aqua }} />
        <Text style={styles.consent}>I confirm I have permission to share this material.</Text>
      </View>
      <PrimaryButton label="Submit" onPress={solve} loading={loading} style={styles.solveButton} />
      {solved.length ? <PastQuestionResults sets={solved} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, borderRadius: 24, padding: 18, backgroundColor: palette.white },
  headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headingText: { flex: 1 },
  title: { color: palette.ink, fontSize: 22, fontWeight: "900" },
  hint: { color: palette.slate, lineHeight: 21, marginTop: 5 },
  searchIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: palette.navy, alignItems: "center", justifyContent: "center" },
  searchPanel: { marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: "#F3F9FC", gap: 10 },
  searchInput: { marginTop: 0 },
  label: { color: palette.slate, fontWeight: "800", marginTop: 16, marginBottom: 8 },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: "#D6E0EA", backgroundColor: "#F9FBFD", paddingHorizontal: 14, color: palette.ink },
  textArea: { minHeight: 160, paddingTop: 14 },
  uploadButton: { marginTop: 14 },
  fileRow: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: "#EDF7FA", flexDirection: "row", alignItems: "center", gap: 9 },
  fileName: { flex: 1, color: palette.navy, fontWeight: "700" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 18 },
  consent: { flex: 1, color: palette.slate, lineHeight: 20 },
  privacy: { color: "#66788A", fontSize: 12, lineHeight: 18, marginTop: 10 },
  solveButton: { marginTop: 18 },
  empty: { color: "#B42318", fontWeight: "800", marginTop: 8 },
  results: { marginTop: 16, gap: 16 },
  setCard: { borderTopWidth: 1, borderTopColor: "#DCE8EF", paddingTop: 16 },
  setTitle: { color: palette.ink, fontSize: 20, fontWeight: "900" },
  subject: { color: palette.slate, marginTop: 4, fontWeight: "700" },
  questionCard: { marginTop: 13, borderRadius: 16, padding: 14, backgroundColor: "#F8FBFD" },
  prompt: { color: palette.ink, fontWeight: "800", lineHeight: 22 },
  option: { color: palette.slate, lineHeight: 21, marginTop: 5 },
  answerLabel: { color: palette.navy, fontWeight: "900", marginTop: 12 },
  answer: { color: palette.ink, fontWeight: "700", lineHeight: 22, marginTop: 3 },
  explanation: { color: palette.slate, lineHeight: 21, marginTop: 6 },
});
