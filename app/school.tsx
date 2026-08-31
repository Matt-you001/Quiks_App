import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { getSchoolMemberships, getSchoolOwnerDashboard } from "../services/ai";
import { palette, shadows } from "../lib/theme";
import type { SchoolMembership } from "../types/app";

export default function QuiksSchoolScreen() {
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMemberships((await getSchoolMemberships()).memberships);
      void getSchoolOwnerDashboard().then(() => setIsOwner(true)).catch(() => setIsOwner(false));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load school memberships.");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <AppBackground webContentWidth="standard">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>QUIKS SCHOOL</Text>
        <Text style={styles.title}>Your school learning space</Text>
        <Text style={styles.copy}>Join your institution, access its paid Quiks licence, classroom, lesson notes and secure CBT activities.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Join a school</Text>
        <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="School code or invitation code" placeholderTextColor="#7890A0" style={styles.input} />
        <Pressable style={styles.primary} onPress={() => code.trim() && router.push({ pathname: "/school-enrol", params: { code: code.trim().toUpperCase() } } as never)}>
          <Text style={styles.primaryText}>Continue</Text>
        </Pressable>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>My schools</Text>
        {loading ? <ActivityIndicator color={palette.navy} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && memberships.length === 0 ? <Text style={styles.copy}>You have not joined a school yet.</Text> : null}
        {memberships.map((item) => (
          <View key={item.membershipId} style={styles.membership}>
            <View style={styles.flex}>
              <Text style={styles.memberName}>{item.schoolName}</Text>
              <Text style={styles.meta}>{item.role.replace("_", " ")} · {item.status}</Text>
            </View>
            {item.role === "school_admin" && item.status === "active" ? (
              <Pressable style={styles.smallButton} onPress={() => router.push({ pathname: "/school-admin", params: { schoolId: item.schoolId } } as never)}><Text style={styles.smallText}>Manage</Text></Pressable>
            ) : null}
          </View>
        ))}
      </View>
      {isOwner ? <Pressable style={styles.ownerLink} onPress={() => router.push("/school-owner" as never)}><Text style={styles.ownerText}>Quiks owner dashboard</Text></Pressable> : null}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: palette.navy, borderRadius: 28, padding: 24, marginBottom: 16, ...shadows.card },
  eyebrow: { color: "#70E2D8", fontWeight: "900", letterSpacing: 2 }, title: { color: "white", fontSize: 30, fontWeight: "900", marginTop: 8 },
  copy: { color: "#486474", fontSize: 16, lineHeight: 23, marginTop: 8 },
  card: { backgroundColor: "white", borderRadius: 24, padding: 20, marginBottom: 16, ...shadows.card }, heading: { color: palette.navy, fontSize: 22, fontWeight: "900", marginBottom: 12 },
  input: { backgroundColor: "#F5F8FB", borderWidth: 1, borderColor: "#D5E0E8", borderRadius: 16, padding: 16, fontSize: 16 },
  primary: { marginTop: 12, backgroundColor: palette.navy, borderRadius: 16, padding: 16, alignItems: "center" }, primaryText: { color: "white", fontWeight: "900", fontSize: 16 },
  membership: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#E6EDF2" }, flex: { flex: 1 }, memberName: { color: palette.navy, fontSize: 17, fontWeight: "800" }, meta: { color: "#587180", marginTop: 3, textTransform: "capitalize" },
  smallButton: { backgroundColor: palette.navy, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 }, smallText: { color: "white", fontWeight: "800" }, error: { color: "#B42318", marginBottom: 8 }, ownerLink: { alignItems: "center", padding: 15 }, ownerText: { color: palette.navy, fontWeight: "800" },
});
