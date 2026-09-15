import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { getSchoolAdminDetails, getSchoolMemberships, getSchoolOwnerDashboard } from "../services/ai";
import { readAppState } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import type { SchoolMembership } from "../types/app";

export default function QuiksSchoolScreen() {
  const [memberships, setMemberships] = useState<SchoolMembership[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [hasSavedSchoolAdminProfile, setHasSavedSchoolAdminProfile] = useState(false);

  async function resolveMissingAdminLicenceStatus(membership: SchoolMembership): Promise<SchoolMembership> {
    if (membership.role !== "school_admin" || membership.schoolLicenceStatus) return membership;
    try {
      const details = await getSchoolAdminDetails(membership.schoolId);
      return { ...membership, schoolLicenceStatus: details.school.status, schoolLicenceExpiresAt: details.school.licence.endAt };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.toLowerCase() : "";
      const status = message.includes("expired") ? "expired" : message.includes("not started") ? "draft" : message.includes("suspend") ? "suspended" : undefined;
      return status ? { ...membership, schoolLicenceStatus: status } : membership;
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membershipResponse, state] = await Promise.all([
        getSchoolMemberships(),
        readAppState(),
      ]);
      const verifiedMemberships = await Promise.all(membershipResponse.memberships.map(resolveMissingAdminLicenceStatus));
      setMemberships(verifiedMemberships);
      setHasSavedSchoolAdminProfile(state.profiles.some((profile) => profile.administrativeRole === "school_admin"));
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
        {!loading && memberships.length === 0 ? (
          <Text style={hasSavedSchoolAdminProfile ? styles.expiredNotice : styles.copy}>
            {hasSavedSchoolAdminProfile
              ? "Your school's licence has expired. Renew it to view your school's portal."
              : "You have not joined a school yet."}
          </Text>
        ) : null}
        {!loading &&
        memberships.some((item) => item.role === "school_admin" && item.schoolLicenceStatus === "expired") &&
        !memberships.some((item) => item.role === "school_admin" && item.schoolLicenceStatus === "active") ? (
          <Text style={styles.expiredNotice}>Your school's licence has expired. Renew it to view your school's portal.</Text>
        ) : null}
        {memberships.map((item) => (
          <View key={item.membershipId} style={styles.membership}>
            <View style={styles.flex}>
              <Text style={styles.memberName}>{item.schoolName}</Text>
              <Text style={styles.meta}>{item.role.replace("_", " ")} · {item.status}</Text>
              {item.schoolLicenceStatus && item.schoolLicenceStatus !== "active" ? (
                <Text style={styles.expiredLicence}>Licence {item.schoolLicenceStatus}{item.schoolLicenceExpiresAt ? ` · ended ${new Date(item.schoolLicenceExpiresAt).toLocaleDateString()}` : ""}</Text>
              ) : item.role === "school_admin" && !item.schoolLicenceStatus ? <Text style={styles.expiredLicence}>Licence status could not be verified. Refresh or sign in again.</Text> : null}
            </View>
            {item.role === "school_admin" && item.status === "active" && item.schoolLicenceStatus === "active" ? (
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
  smallButton: { backgroundColor: palette.navy, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 }, smallText: { color: "white", fontWeight: "800" }, expiredNotice: { color: "#B42318", backgroundColor: "#FFF0EE", borderRadius: 12, padding: 12, fontWeight: "800", lineHeight: 21, marginBottom: 8 }, expiredLicence: { color: "#B42318", fontWeight: "800", marginTop: 4 }, error: { color: "#B42318", marginBottom: 8 }, ownerLink: { alignItems: "center", padding: 15 }, ownerText: { color: palette.navy, fontWeight: "800" },
});
