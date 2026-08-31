import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { CalendarDateField, getTodayDateValue } from "../components/CalendarDateField";
import { palette, shadows } from "../lib/theme";
import { createSchool, getSchoolOwnerDashboard } from "../services/ai";
import type { SchoolEnrolmentMode, SchoolOwnerDashboardResponse } from "../types/app";

export default function SchoolOwnerScreen() {
  const [data, setData] = useState<SchoolOwnerDashboardResponse | null>(null);
  const [name, setName] = useState("");
  const [administratorEmail, setAdministratorEmail] = useState("");
  const [enrolmentMode, setEnrolmentMode] = useState<SchoolEnrolmentMode>("shared_code");
  const [enrolmentModeOpen, setEnrolmentModeOpen] = useState(false);
  const [students, setStudents] = useState("500");
  const [teachers, setTeachers] = useState("50");
  const [startDate, setStartDate] = useState(getTodayDateValue());
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [creationNotice, setCreationNotice] = useState<{
    schoolName: string;
    schoolCode: string;
    administratorEmail: string;
    administratorInvitationCode: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setData(await getSchoolOwnerDashboard());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Owner access is not configured for this account.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addSchool() {
    if (busy) return;
    setError("");
    setCreationNotice(null);
    if (!name.trim() || !administratorEmail.trim() || !endDate) {
      const message = "Enter the school name, administrator email, and licence expiry date.";
      setError(message);
      return;
    }
    const startAt = new Date(`${startDate}T00:00:00`).getTime();
    const endAt = new Date(`${endDate}T23:59:59`).getTime();
    const studentSeatLimit = Number(students);
    const teacherSeatLimit = Number(teachers);
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      setError("Select a licence expiry date after the licence start date.");
      return;
    }
    if (!Number.isInteger(studentSeatLimit) || studentSeatLimit < 1 || !Number.isInteger(teacherSeatLimit) || teacherSeatLimit < 1) {
      setError("Student and teacher seats must be whole numbers greater than zero.");
      return;
    }
    setBusy(true);
    try {
      const created = await createSchool({
        name: name.trim(),
        administratorEmail: administratorEmail.trim().toLowerCase(),
        enrolmentMode,
        plan: "term",
        startAt,
        endAt,
        studentSeatLimit,
        teacherSeatLimit,
        allowedVariants: ["children", "teens", "uni"],
        gracePeriodDays: 0,
      });
      if (!created?.school?.schoolCode || !created?.administratorInvitation?.invitationCode) {
        throw new Error("The server returned an incomplete school record. Deploy the latest backend and try again.");
      }
      setCreationNotice({
        schoolName: created.school.name,
        schoolCode: created.school.schoolCode,
        administratorEmail: created.administratorInvitation.email,
        administratorInvitationCode: created.administratorInvitation.invitationCode,
      });
      setName("");
      setAdministratorEmail("");
      setEndDate("");
      await load();
      Alert.alert(
        "School licence created",
        `School code: ${created.school.schoolCode}\n\nAdministrator invitation code: ${created.administratorInvitation.invitationCode}\n\nSend the administrator code only to ${created.administratorInvitation.email}. They must sign in with that email address.`
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to create school.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppBackground webContentWidth="wide">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>QUIKS OWNER CONTROL</Text>
        <Text style={styles.title}>Quiks School portfolio</Text>
        <Text style={styles.light}>Institutional enrolment, seats, licence expiry and operational visibility.</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {data ? (
        <View style={styles.metrics}>
          {Object.entries(data.totals).map(([key, value]) => (
            <View key={key} style={styles.metric}>
              <Text style={styles.number}>{value}</Text>
              <Text style={styles.metricLabel}>{key.replace(/([A-Z])/g, " $1")}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.heading}>Create school licence</Text>
          <Text style={styles.copy}>Choose the first school administrator. They receive a one-time, email-locked invitation and can approve subsequent staff and student requests.</Text>
          <TextInput value={name} onChangeText={setName} placeholder="School name" style={styles.input} />
          <TextInput value={administratorEmail} onChangeText={setAdministratorEmail} autoCapitalize="none" keyboardType="email-address" placeholder="School administrator email" style={styles.input} />
          <Text style={styles.fieldLabel}>Student and staff enrolment codes</Text>
          <Pressable style={styles.dropdownTrigger} onPress={() => setEnrolmentModeOpen((current) => !current)}>
            <Text style={styles.dropdownValue}>{enrolmentMode === "individual_codes" ? "Unique individual codes" : "One shared code"}</Text>
            <MaterialIcons name={enrolmentModeOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={palette.navy} />
          </Pressable>
          {enrolmentModeOpen ? (
            <View style={styles.dropdownMenu}>
              {([
                ["shared_code", "One shared code"],
                ["individual_codes", "Unique individual codes"],
              ] as const).map(([value, label]) => (
                <Pressable
                  key={value}
                  style={[styles.dropdownOption, enrolmentMode === value && styles.dropdownOptionActive]}
                  onPress={() => {
                    setEnrolmentMode(value);
                    setEnrolmentModeOpen(false);
                  }}
                >
                  <Text style={[styles.dropdownOptionText, enrolmentMode === value && styles.dropdownOptionTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.row}>
            <TextInput value={students} onChangeText={setStudents} keyboardType="number-pad" placeholder="Student seats" style={[styles.input, styles.flex]} />
            <TextInput value={teachers} onChangeText={setTeachers} keyboardType="number-pad" placeholder="Teacher seats" style={[styles.input, styles.flex]} />
          </View>
          <CalendarDateField label="Starts" value={startDate} onChange={(value) => { setStartDate(value); if (endDate && endDate < value) setEndDate(""); }} minimumDate={getTodayDateValue()} />
          <CalendarDateField label="Expires" value={endDate} onChange={setEndDate} minimumDate={startDate || getTodayDateValue()} />
          <Pressable disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={addSchool}>
            <Text style={styles.buttonText}>{busy ? "Creating…" : "Create Quiks School account"}</Text>
          </Pressable>
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          {creationNotice ? (
            <View style={styles.creationNotice}>
              <Text style={styles.creationNoticeTitle}>{creationNotice.schoolName} was created successfully.</Text>
              <Text style={styles.creationNoticeText}>School code: {creationNotice.schoolCode}</Text>
              <Text style={styles.creationNoticeText}>Administrator: {creationNotice.administratorEmail}</Text>
              <Text style={styles.creationNoticeText}>Administrator invitation code: {creationNotice.administratorInvitationCode}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Schools and enrolment records</Text>
          <Text style={styles.copy}>Open a school to view administrators, teachers, students, pending requests and configured enrolment fields.</Text>
          {data?.schools.map((school) => (
            <View key={school.schoolId} style={styles.school}>
              <Text style={styles.schoolName}>{school.name}</Text>
              <Text style={styles.meta}>School code {school.schoolCode} · {school.status}</Text>
              <Text style={styles.meta}>Enrolment: {school.enrolmentMode === "individual_codes" ? "unique individual codes" : "one shared school code"}</Text>
              <Text style={styles.meta}>{school.studentCount}/{school.licence.studentSeatLimit} students · {school.teacherCount}/{school.licence.teacherSeatLimit} teachers · {school.pendingCount} pending</Text>
              <Text style={styles.meta}>Expires {new Date(school.licence.endAt).toLocaleDateString()} · {school.seatUsagePercent}% seats used</Text>
              {school.administratorSetup ? (
                <View style={styles.adminSetup}>
                  <Text style={styles.adminText}>Administrator: {school.administratorSetup.email} · {school.administratorSetup.status}</Text>
                  {school.administratorSetup.invitationCode ? <Text style={styles.invitationCode}>Invitation code: {school.administratorSetup.invitationCode}</Text> : null}
                </View>
              ) : null}
              <Pressable style={styles.secondaryButton} onPress={() => router.push({ pathname: "/school-admin", params: { schoolId: school.schoolId } } as never)}>
                <Text style={styles.secondaryButtonText}>View enrolment records</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: palette.navy, borderRadius: 26, padding: 24, marginBottom: 16 },
  eyebrow: { color: "#70E2D8", fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "white", fontSize: 31, fontWeight: "900", marginTop: 7 },
  light: { color: "#D8E8EE", marginTop: 7 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  metric: { backgroundColor: "white", borderRadius: 18, padding: 16, minWidth: 145, flexGrow: 1, ...shadows.card },
  number: { color: palette.navy, fontSize: 26, fontWeight: "900" },
  metricLabel: { color: "#587180", textTransform: "capitalize" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card: { backgroundColor: "white", borderRadius: 24, padding: 20, flexGrow: 1, flexBasis: 440, ...shadows.card },
  heading: { color: palette.navy, fontSize: 22, fontWeight: "900", marginBottom: 10 },
  copy: { color: "#587180", lineHeight: 21, marginBottom: 8 },
  input: { backgroundColor: "#F6F9FB", borderWidth: 1, borderColor: "#D4E0E7", borderRadius: 13, padding: 13, marginVertical: 6 },
  fieldLabel: { color: palette.navy, fontWeight: "900", marginTop: 12, marginBottom: 7 },
  dropdownTrigger: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F6F9FB", borderWidth: 1, borderColor: "#D4E0E7", borderRadius: 13, paddingHorizontal: 13, marginBottom: 6 },
  dropdownValue: { color: palette.navy, fontWeight: "800" },
  dropdownMenu: { borderWidth: 1, borderColor: "#D4E0E7", borderRadius: 13, overflow: "hidden", backgroundColor: "white", marginBottom: 6 },
  dropdownOption: { padding: 13, borderBottomWidth: 1, borderBottomColor: "#E5EDF2" },
  dropdownOptionActive: { backgroundColor: palette.navy },
  dropdownOptionText: { color: palette.navy, fontWeight: "800" },
  dropdownOptionTextActive: { color: "white" },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  button: { backgroundColor: palette.navy, borderRadius: 14, padding: 15, alignItems: "center", marginTop: 10 },
  disabled: { opacity: 0.55 },
  buttonText: { color: "white", fontWeight: "900" },
  formError: { color: "#B42318", backgroundColor: "#FFF0EE", padding: 12, borderRadius: 12, marginTop: 10, lineHeight: 20 },
  creationNotice: { backgroundColor: "#E9F8F2", borderWidth: 1, borderColor: "#81C9AF", borderRadius: 14, padding: 13, marginTop: 10 },
  creationNoticeTitle: { color: "#125C45", fontWeight: "900", marginBottom: 6 },
  creationNoticeText: { color: "#125C45", fontWeight: "700", marginTop: 3 },
  school: { paddingVertical: 15, borderTopColor: "#E4ECF1", borderTopWidth: 1 },
  schoolName: { color: palette.navy, fontSize: 17, fontWeight: "900" },
  meta: { color: "#587180", marginTop: 4 },
  adminSetup: { backgroundColor: "#F0F8FA", borderRadius: 12, padding: 11, marginTop: 10 },
  adminText: { color: palette.navy, fontWeight: "800" },
  invitationCode: { color: palette.navy, fontWeight: "900", marginTop: 5 },
  secondaryButton: { borderWidth: 1, borderColor: palette.navy, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 10 },
  secondaryButtonText: { color: palette.navy, fontWeight: "900" },
  error: { color: "#B42318", backgroundColor: "#FFF0EE", padding: 12, borderRadius: 12, marginBottom: 12 },
});
