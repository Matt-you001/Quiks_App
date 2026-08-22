import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { listClassroomChatMessages, sendClassroomChatMessage } from "../services/ai";
import { palette, shadows } from "../lib/theme";
import type { ClassroomChatMessage, UserProfile } from "../types/app";

interface Props { profile: UserProfile; classId: string; className: string; }

export function ClassroomChat({ profile, classId, className }: Props) {
  const [messages, setMessages] = useState<ClassroomChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    try {
      const response = await listClassroomChatMessages({ profile, classId });
      setMessages(response.messages);
      setError(null);
    } catch (caught) {
      if (!quiet) setError(caught instanceof Error ? caught.message : "Class chat could not be loaded.");
    }
  }, [classId, profile]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(true), 6000);
    return () => clearInterval(timer);
  }, [refresh]);

  const send = async () => {
    if (!text.trim() || sending) return;
    const outgoing = text.trim();
    setText("");
    setSending(true);
    try {
      const response = await sendClassroomChatMessage({ profile, classId, text: outgoing });
      setMessages((current) => [...current, response.message]);
    } catch (caught) {
      setText(outgoing);
      Alert.alert("Message not sent", caught instanceof Error ? caught.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Class Chat</Text>
          <Text style={styles.helper}>{className} · Teacher and active students</Text>
        </View>
        <Pressable onPress={() => void refresh()} style={styles.refreshButton}><MaterialIcons name="refresh" size={22} color={palette.navy} /></Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent} nestedScrollEnabled>
        {messages.length === 0 ? <Text style={styles.empty}>No messages yet. Start the class conversation.</Text> : null}
        {messages.map((message) => {
          const mine = message.senderProfileId === profile.id;
          return (
            <View key={message.messageId} style={[styles.bubble, mine ? styles.myBubble : styles.otherBubble]}>
              <Text style={[styles.sender, mine ? styles.myText : null]}>{message.senderName}{message.senderRole === "teacher" ? " · Teacher" : ""}</Text>
              <Text style={[styles.messageText, mine ? styles.myText : null]}>{message.text}</Text>
              <Text style={[styles.time, mine ? styles.myTime : null]}>{new Date(message.createdAt).toLocaleString()}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput value={text} onChangeText={setText} placeholder="Message your class..." placeholderTextColor="#8092A7" style={styles.input} multiline maxLength={2000} />
        <Pressable onPress={() => void send()} disabled={!text.trim() || sending} style={[styles.sendButton, (!text.trim() || sending) ? styles.sendButtonDisabled : null]}>
          <MaterialIcons name="send" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, backgroundColor: "#FFFFFF", borderRadius: 28, padding: 20, gap: 14, ...shadows.card },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  title: { color: palette.navy, fontSize: 25, fontWeight: "900" },
  helper: { color: "#536B7B", fontSize: 13, marginTop: 3 },
  refreshButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EDF5F8", alignItems: "center", justifyContent: "center" },
  error: { color: "#B42318", fontWeight: "700" },
  messages: { minHeight: 260, maxHeight: 620 },
  messagesContent: { flexGrow: 1, gap: 10 },
  empty: { color: "#647B8A", textAlign: "center", paddingVertical: 60 },
  bubble: { maxWidth: "84%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  myBubble: { alignSelf: "flex-end", backgroundColor: palette.aqua, borderBottomRightRadius: 5 },
  otherBubble: { alignSelf: "flex-start", backgroundColor: "#EEF4F7", borderBottomLeftRadius: 5 },
  sender: { color: palette.navy, fontSize: 12, fontWeight: "900", marginBottom: 3 },
  messageText: { color: "#253D4C", fontSize: 15, lineHeight: 21 },
  time: { color: "#718696", fontSize: 10, marginTop: 5, textAlign: "right" },
  myText: { color: "#FFFFFF" },
  myTime: { color: "#D8FFFA" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, borderTopWidth: 1, borderTopColor: "#E1EAF0", paddingTop: 14 },
  input: { flex: 1, maxHeight: 110, minHeight: 48, borderWidth: 1, borderColor: "#D5E1E9", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, color: palette.navy, backgroundColor: "#F8FBFC" },
  sendButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: palette.aqua },
  sendButtonDisabled: { opacity: 0.45 },
});
