import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { CalendarDateField, getTodayDateValue } from "../components/CalendarDateField";
import { SchoolAdministrationLicenceEditor } from "../components/SchoolAdministrationLicenceEditor";
import { palette, shadows } from "../lib/theme";
import { archiveSchool, createOwnerIssuedIndividualLicence, createSchool, getSchoolOwnerDashboard, restoreSchool, updateSchoolRecord } from "../services/ai";
import type { SchoolEnrolmentMode, SchoolOwnerDashboardResponse, SchoolSummary } from "../types/app";

function dateValue(timestamp: number) { return new Date(timestamp).toISOString().slice(0, 10); }

export default function SchoolOwnerScreen() {
  const [data, setData] = useState<SchoolOwnerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [licenceType, setLicenceType] = useState<"school" | "individual">("school");
  const [individualEmail, setIndividualEmail] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
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
    emailStatus: "sent" | "not_configured" | "failed";
  } | null>(null);
  const [individualCreationNotice, setIndividualCreationNotice] = useState<{ email: string; endAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolSummary | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [deletingSchool, setDeletingSchool] = useState<SchoolSummary | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [individualSignupsOpen, setIndividualSignupsOpen] = useState(false);
  const [individualLicencesOpen, setIndividualLicencesOpen] = useState(false);

  async function copyCode(code: string, label: string) {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied", `${label} copied to the clipboard.`);
  }

  function openEditor(school: SchoolSummary) {
    setEditingSchool(school); setEditName(school.name); setEditStartDate(dateValue(school.licence.startAt)); setEditEndDate(dateValue(school.licence.endAt)); setError("");
  }

  async function saveSchoolEdit() {
    if (!editingSchool || busy) return;
    const nextStartAt = new Date(`${editStartDate}T00:00:00`).getTime();
    const nextEndAt = new Date(`${editEndDate}T23:59:59`).getTime();
    if (!editName.trim() || !Number.isFinite(nextStartAt) || !Number.isFinite(nextEndAt) || nextEndAt <= nextStartAt) { setError("Enter a school name and valid licence dates."); return; }
    setBusy(true);
    try { await updateSchoolRecord({ schoolId: editingSchool.schoolId, patch: { name: editName.trim(), licence: { startAt: nextStartAt, endAt: nextEndAt } } }); setEditingSchool(null); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update the school."); }
    finally { setBusy(false); }
  }

  async function confirmArchive() {
    if (!deletingSchool || busy) return;
    setBusy(true);
    try { await archiveSchool({ schoolId: deletingSchool.schoolId, confirmationName: deleteConfirmation }); setDeletingSchool(null); setDeleteConfirmation(""); setSelectedSchoolId(null); await load(); Alert.alert("School deleted from active use", "Access is revoked and the school is hidden. Its records were preserved and can be restored by the App Owner."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete the school."); }
    finally { setBusy(false); }
  }

  async function load() {
    setLoading(true);
    try {
      setData(await getSchoolOwnerDashboard());
      setError("");
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : "Owner access is not configured for this account.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addSchool() {
    if (busy) return;
    setError("");
    setCreationNotice(null);
    setIndividualCreationNotice(null);
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
        emailStatus: created.administratorInvitation.emailDelivery?.status ?? "not_configured",
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

  async function addIndividualLicence() {
    if (busy) return;
    setError("");
    setCreationNotice(null);
    setIndividualCreationNotice(null);
    if (!individualEmail.trim() || !endDate) {
      setError("Enter the individual's email address and licence expiry date.");
      return;
    }
    const startAt = new Date(`${startDate}T00:00:00`).getTime();
    const endAt = new Date(`${endDate}T23:59:59`).getTime();
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
      setError("Select a licence expiry date after the licence start date.");
      return;
    }
    setBusy(true);
    try {
      const { licence } = await createOwnerIssuedIndividualLicence({ email: individualEmail.trim().toLowerCase(), startAt, endAt });
      setIndividualCreationNotice({ email: licence.email, endAt: licence.endAt });
      setIndividualEmail("");
      setEndDate("");
      await load();
      Alert.alert("Individual licence issued", `${licence.email} now has premium access for the licence period and may create one profile.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to issue the individual licence.");
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
      {loading ? <ActivityIndicator size="large" color={palette.navy} style={styles.loader} /> : null}
      {!loading && !data && error ? (
        <View style={styles.accessErrorCard}>
          <Text style={styles.error}>{error}</Text>
          <View style={styles.row}>
            <Pressable style={styles.button} onPress={() => void load()}><Text style={styles.buttonText}>Try again</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => router.replace("/school" as never)}><Text style={styles.secondaryButtonText}>Back to School Control</Text></Pressable>
          </View>
        </View>
      ) : null}
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
      {data ? <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.heading}>{licenceType === "school" ? "Create school licence" : "Create individual licence"}</Text>
          <View style={styles.typeSelector}>
            {(["school", "individual"] as const).map((value) => <Pressable key={value} onPress={() => { setLicenceType(value); setError(""); setCreationNotice(null); setIndividualCreationNotice(null); }} style={[styles.typeOption, licenceType === value && styles.typeOptionActive]}><Text style={[styles.typeOptionText, licenceType === value && styles.typeOptionTextActive]}>{value === "school" ? "School" : "Individual"}</Text></Pressable>)}
          </View>
          {licenceType === "school" ? <>
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
          </> : <TextInput value={individualEmail} onChangeText={setIndividualEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Individual's email address" style={styles.input} />}
          <CalendarDateField label="Starts" value={startDate} onChange={(value) => { setStartDate(value); if (endDate && endDate < value) setEndDate(""); }} minimumDate={getTodayDateValue()} />
          <CalendarDateField label="Expires" value={endDate} onChange={setEndDate} minimumDate={startDate || getTodayDateValue()} />
          <Pressable disabled={busy} style={[styles.button, busy && styles.disabled]} onPress={() => void (licenceType === "school" ? addSchool() : addIndividualLicence())}>
            <Text style={styles.buttonText}>{busy ? "Creating…" : licenceType === "school" ? "Create Quiks School account" : "Issue individual licence"}</Text>
          </Pressable>
          {error ? <Text style={styles.formError}>{error}</Text> : null}
          {creationNotice ? (
            <View style={styles.creationNotice}>
              <Text style={styles.creationNoticeTitle}>{creationNotice.schoolName} was created successfully.</Text>
              <View style={styles.codeRow}><Text selectable style={styles.creationNoticeText}>School code: {creationNotice.schoolCode}</Text><Pressable style={styles.copyIcon} onPress={() => void copyCode(creationNotice.schoolCode, "School code")}><MaterialIcons name="content-copy" size={19} color={palette.navy}/></Pressable></View>
              <Text style={styles.creationNoticeText}>Administrator: {creationNotice.administratorEmail}</Text>
              <View style={styles.codeRow}><Text selectable style={styles.creationNoticeText}>Administrator invitation code: {creationNotice.administratorInvitationCode}</Text><Pressable style={styles.copyIcon} onPress={() => void copyCode(creationNotice.administratorInvitationCode, "Administrator invitation code")}><MaterialIcons name="content-copy" size={19} color={palette.navy}/></Pressable></View>
              <Text style={styles.creationNoticeText}>{creationNotice.emailStatus === "sent" ? "The invitation code was sent to the administrator by email." : creationNotice.emailStatus === "failed" ? "Email delivery failed. Copy and send the administrator code manually." : "Automatic email is not configured. Copy and send the administrator code manually."}</Text>
            </View>
          ) : null}
          {individualCreationNotice ? <View style={styles.creationNotice}><Text style={styles.creationNoticeTitle}>Individual licence issued successfully.</Text><Text style={styles.creationNoticeText}>{individualCreationNotice.email}</Text><Text style={styles.creationNoticeText}>Premium access ends {new Date(individualCreationNotice.endAt).toLocaleDateString()} and permits one profile.</Text></View> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>Schools and enrolment records</Text>
          <Text style={styles.copy}>Open a school to view administrators, teachers, students, pending requests and configured enrolment fields.</Text>
          {data?.schools.map((school) => (
            <View key={school.schoolId} style={styles.school}>
              <Pressable accessibilityRole="button" onPress={() => setSelectedSchoolId((current) => current === school.schoolId ? null : school.schoolId)} style={styles.schoolNameButton}>
                <Text style={styles.schoolName}>{school.name}</Text><MaterialIcons name={selectedSchoolId === school.schoolId ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={24} color={palette.navy}/>
              </Pressable>
              {selectedSchoolId === school.schoolId ? <View style={styles.schoolDetails}>
              <View style={styles.codeRow}><Text selectable style={styles.meta}>School code {school.schoolCode} · {school.status}</Text><Pressable accessibilityLabel="Copy school code" style={styles.copyIcon} onPress={() => void copyCode(school.schoolCode, "School code")}><MaterialIcons name="content-copy" size={19} color={palette.navy}/></Pressable></View>
              {school.licence.packageName ? <Text style={styles.meta}>{school.licence.packageName} · {school.licence.plan === "session" ? "Session / year" : "Term"}</Text> : null}
              <Text style={styles.meta}>Enrolment: {school.enrolmentMode === "individual_codes" ? "unique individual codes" : "one shared school code"}</Text>
              <Text style={styles.meta}>{school.studentCount}/{school.licence.studentSeatLimit} students · {school.teacherCount}/{school.licence.teacherSeatLimit} teachers · {school.pendingCount} pending</Text>
              <Text style={styles.meta}>Expires {new Date(school.licence.endAt).toLocaleDateString()} · {school.seatUsagePercent}% seats used</Text>
              {school.administratorSetup ? (
                <View style={styles.adminSetup}>
                  <Text style={styles.adminText}>Administrator: {school.administratorSetup.email} · {school.administratorSetup.status}</Text>
                  {school.administratorSetup.invitationCode ? <View style={styles.codeRow}><Text selectable style={styles.invitationCode}>Invitation code: {school.administratorSetup.invitationCode}</Text><Pressable accessibilityLabel="Copy administrator invitation code" style={styles.copyIcon} onPress={() => void copyCode(school.administratorSetup!.invitationCode!, "Administrator invitation code")}><MaterialIcons name="content-copy" size={19} color={palette.navy}/></Pressable></View> : null}
                </View>
              ) : null}
              <Pressable style={styles.secondaryButton} onPress={() => router.push({ pathname: "/school-admin", params: { schoolId: school.schoolId } } as never)}>
                <Text style={styles.secondaryButtonText}>View enrolment records</Text>
              </Pressable>
              <SchoolAdministrationLicenceEditor schoolId={school.schoolId}/>
              <View style={styles.row}><Pressable style={[styles.secondaryButton, styles.flex]} onPress={() => openEditor(school)}><Text style={styles.secondaryButtonText}>Edit / renew</Text></Pressable><Pressable style={[styles.deleteButton, styles.flex]} onPress={() => { setDeletingSchool(school); setDeleteConfirmation(""); setError(""); }}><Text style={styles.deleteButtonText}>Delete school</Text></Pressable></View>
              </View> : null}
            </View>
          ))}
        </View>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: individualSignupsOpen }} onPress={() => setIndividualSignupsOpen((current) => !current)} style={styles.signupSummary}>
            <Text style={styles.collapsibleHeading}>Individual sign-ups</Text>
            <MaterialIcons name={individualSignupsOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={28} color={palette.navy}/>
          </Pressable>
          {individualSignupsOpen ? <View>
            <Text style={styles.signupTotal}>Total: {(data.individualSignups ?? []).length}</Text>
            {(data.individualSignups ?? []).length === 0 ? <Text style={styles.copy}>No independent individual sign-ups have been captured yet.</Text> : (data.individualSignups ?? []).map((account) => <View key={account.email} style={styles.school}><Text selectable style={styles.schoolName}>{account.email}</Text></View>)}
          </View> : null}
        </View>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: individualLicencesOpen }} onPress={() => setIndividualLicencesOpen((current) => !current)} style={styles.signupSummary}>
            <Text style={styles.collapsibleHeading}>Individual licences</Text>
            <MaterialIcons name={individualLicencesOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={28} color={palette.navy}/>
          </Pressable>
          {individualLicencesOpen ? <View>{data.individualLicences.length === 0 ? <Text style={styles.copy}>No individual licences issued yet.</Text> : data.individualLicences.map((licence) => <View key={licence.licenceId} style={styles.school}><Text style={styles.schoolName}>{licence.email}</Text><Text style={styles.meta}>{licence.status} · {new Date(licence.startAt).toLocaleDateString()} to {new Date(licence.endAt).toLocaleDateString()}</Text><Text style={styles.meta}>Activated by signed-in email · Profile allowance: 1</Text></View>)}</View> : null}
        </View>
        {(data.archivedSchools?.length ?? 0) > 0 ? <View style={styles.card}><Text style={styles.heading}>Deleted schools</Text><Text style={styles.copy}>Access is revoked, but records remain preserved for recovery and audit.</Text>{data.archivedSchools?.map(school => <View key={school.schoolId} style={styles.school}><Text style={styles.schoolName}>{school.name}</Text><Text style={styles.meta}>Deleted {school.archivedAt ? new Date(school.archivedAt).toLocaleString() : ""}</Text><Pressable style={styles.secondaryButton} onPress={() => void (async () => { setBusy(true); try { await restoreSchool({ schoolId: school.schoolId }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to restore school."); } finally { setBusy(false); } })()}><Text style={styles.secondaryButtonText}>Restore school</Text></Pressable></View>)}</View> : null}
        <View style={styles.card}>
          <Text style={styles.heading}>Online school licence payments</Text>
          <Text style={styles.copy}>Verified Paddle purchases and the fixed licence periods granted by Quiks.</Text>
          {(data.billingPurchases ?? []).length === 0 ? <Text style={styles.copy}>No verified online school payments yet.</Text> : (data.billingPurchases ?? []).map((purchase) => {
            const schoolName = data.schools.find((school) => school.schoolId === purchase.schoolId)?.name ?? "School";
            return <View key={purchase.purchaseId} style={styles.school}>
              <Text style={styles.schoolName}>{schoolName}</Text>
              <Text style={styles.meta}>{purchase.packageName} · {purchase.period === "session" ? "Session / year" : "Term"} · {purchase.learnerCount} learners</Text>
              <Text style={styles.meta}>{purchase.status} · {new Date(purchase.licenceStartAt).toLocaleDateString()} to {new Date(purchase.licenceEndAt).toLocaleDateString()}</Text>
              <Text style={styles.meta}>Paddle transaction: {purchase.transactionId}</Text>
            </View>;
          })}
        </View>
      </View> : null}
      <Modal visible={Boolean(editingSchool)} transparent animationType="fade" onRequestClose={() => setEditingSchool(null)}><View style={styles.modalOverlay}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modalCard}><Text style={styles.heading}>Edit or renew school</Text><Text style={styles.copy}>Changing the expiry date is the manual renewal workflow. Online Paddle renewals continue to update from verified payments.</Text><TextInput value={editName} onChangeText={setEditName} placeholder="School name" style={styles.input}/><CalendarDateField label="Licence starts" value={editStartDate} onChange={setEditStartDate}/><CalendarDateField label="Licence expires" value={editEndDate} onChange={setEditEndDate} minimumDate={editStartDate}/>{error ? <Text style={styles.formError}>{error}</Text> : null}<Pressable disabled={busy} style={styles.button} onPress={() => void saveSchoolEdit()}><Text style={styles.buttonText}>Save changes</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => { setEditingSchool(null); setError(""); }}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable></View></ScrollView></View></Modal>
      <Modal visible={Boolean(deletingSchool)} transparent animationType="fade" onRequestClose={() => setDeletingSchool(null)}><View style={styles.modalOverlay}><View style={styles.modalCard}><Text style={styles.heading}>Delete school from active use?</Text><Text style={styles.copy}>This immediately revokes school access and hides the school. Records are preserved for recovery and audit. Type <Text style={styles.schoolName}>{deletingSchool?.name}</Text> exactly to confirm.</Text><TextInput value={deleteConfirmation} onChangeText={setDeleteConfirmation} placeholder="School name" style={styles.input}/>{error ? <Text style={styles.formError}>{error}</Text> : null}<Pressable disabled={busy || deleteConfirmation !== deletingSchool?.name} style={[styles.deleteButton, (busy || deleteConfirmation !== deletingSchool?.name) && styles.disabled]} onPress={() => void confirmArchive()}><Text style={styles.deleteButtonText}>Confirm delete</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => { setDeletingSchool(null); setDeleteConfirmation(""); setError(""); }}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable></View></View></Modal>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: palette.navy, borderRadius: 26, padding: 24, marginBottom: 16 },
  eyebrow: { color: "#70E2D8", fontWeight: "900", letterSpacing: 1.5 },
  title: { color: "white", fontSize: 31, fontWeight: "900", marginTop: 7 },
  light: { color: "#D8E8EE", marginTop: 7 },
  loader: { marginVertical: 24 },
  accessErrorCard: { backgroundColor: "#FFF1F0", borderRadius: 18, padding: 18, marginBottom: 16 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  metric: { backgroundColor: "white", borderRadius: 18, padding: 16, minWidth: 145, flexGrow: 1, ...shadows.card },
  number: { color: palette.navy, fontSize: 26, fontWeight: "900" },
  metricLabel: { color: "#587180", textTransform: "capitalize" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  card: { backgroundColor: "white", borderRadius: 24, padding: 20, flexGrow: 1, flexBasis: 440, ...shadows.card },
  signupSummary: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  collapsibleHeading: { color: palette.navy, fontSize: 22, fontWeight: "900" },
  signupTotal: { color: palette.navy, fontSize: 18, fontWeight: "900", marginBottom: 6 },
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
  typeSelector: { flexDirection: "row", gap: 8, marginBottom: 12 },
  typeOption: { flex: 1, padding: 13, borderRadius: 13, backgroundColor: "#EEF3F6", alignItems: "center" },
  typeOptionActive: { backgroundColor: palette.navy },
  typeOptionText: { color: palette.navy, fontWeight: "900" },
  typeOptionTextActive: { color: "white" },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },
  button: { backgroundColor: palette.navy, borderRadius: 14, padding: 15, alignItems: "center", marginTop: 10 },
  disabled: { opacity: 0.55 },
  buttonText: { color: "white", fontWeight: "900" },
  formError: { color: "#B42318", backgroundColor: "#FFF0EE", padding: 12, borderRadius: 12, marginTop: 10, lineHeight: 20 },
  creationNotice: { backgroundColor: "#E9F8F2", borderWidth: 1, borderColor: "#81C9AF", borderRadius: 14, padding: 13, marginTop: 10 },
  creationNoticeTitle: { color: "#125C45", fontWeight: "900", marginBottom: 6 },
  creationNoticeText: { color: "#125C45", fontWeight: "700", marginTop: 3 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  copyIcon: { minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "#E8F4F5" },
  school: { paddingVertical: 15, borderTopColor: "#E4ECF1", borderTopWidth: 1 },
  schoolName: { color: palette.navy, fontSize: 17, fontWeight: "900" },
  schoolNameButton: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  schoolDetails: { paddingBottom: 3 },
  meta: { color: "#587180", marginTop: 4 },
  adminSetup: { backgroundColor: "#F0F8FA", borderRadius: 12, padding: 11, marginTop: 10 },
  adminText: { color: palette.navy, fontWeight: "800" },
  invitationCode: { color: palette.navy, fontWeight: "900", marginTop: 5 },
  secondaryButton: { borderWidth: 1, borderColor: palette.navy, borderRadius: 12, padding: 12, alignItems: "center", marginTop: 10 },
  secondaryButtonText: { color: palette.navy, fontWeight: "900" },
  deleteButton: { backgroundColor: "#FFF0EE", borderWidth: 1, borderColor: "#E6584E", borderRadius: 12, padding: 12, alignItems: "center", marginTop: 10 },
  deleteButtonText: { color: "#B42318", fontWeight: "900" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalScroll: { flexGrow: 1, justifyContent: "center" },
  modalCard: { width: "100%", maxWidth: 560, alignSelf: "center", backgroundColor: "white", borderRadius: 22, padding: 20 },
  error: { color: "#B42318", backgroundColor: "#FFF0EE", padding: 12, borderRadius: 12, marginBottom: 12 },
});
