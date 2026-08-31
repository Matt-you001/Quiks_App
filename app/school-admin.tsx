import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { palette, shadows } from "../lib/theme";
import { getSchoolAdminDetails, inviteSchoolMember, updateSchoolMembershipStatus, updateSchoolProfileFields } from "../services/ai";
import type { SchoolDetailsResponse, SchoolMemberRole, SchoolProfileFieldDefinition, SchoolProfileFieldType } from "../types/app";

export default function SchoolAdminScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const [details, setDetails] = useState<SchoolDetailsResponse | null>(null);
  const [fields, setFields] = useState<SchoolProfileFieldDefinition[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SchoolMemberRole>("student");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<{
    email: string;
    role: SchoolMemberRole;
    code: string;
    expiresAt: number;
    emailStatus: "sent" | "not_configured" | "failed";
  } | null>(null);
  const [customLabel, setCustomLabel] = useState("");
  const [error, setError] = useState("");
  async function load() { try { const data = await getSchoolAdminDetails(schoolId); setDetails(data); setFields(data.profileFields); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load school."); } }
  useEffect(() => { void load(); }, [schoolId]);
  async function saveFields() { try { await updateSchoolProfileFields({ schoolId, fields }); await load(); Alert.alert("Saved", "The enrolment form has been updated."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save fields."); } }
  function patchField(id: string, patch: Partial<SchoolProfileFieldDefinition>) { setFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field)); }
  function addCustomField() { const label = customLabel.trim(); if (!label) return; setFields((current) => [...current, { id: `custom_${Date.now()}`, label, type: "text", enabled: true, required: false, roles: ["student", "teacher"] }]); setCustomLabel(""); }
  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (inviteBusy) return;
    setError("");
    setGeneratedInvite(null);
    if (!email.includes("@")) {
      setError("Enter a valid email address before generating the invitation code.");
      return;
    }
    setInviteBusy(true);
    try {
      const result = await inviteSchoolMember({ schoolId, email, role: inviteRole });
      if (!result.invitationCode) throw new Error("The server did not return an invitation code. Deploy the latest backend and try again.");
      setGeneratedInvite({
        email,
        role: inviteRole,
        code: result.invitationCode,
        expiresAt: result.expiresAt,
        emailStatus: result.emailDelivery?.status ?? "not_configured",
      });
      setInviteEmail("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to invite member.");
    } finally {
      setInviteBusy(false);
    }
  }
  async function setStatus(membershipId: string, status: "active" | "suspended") { try { await updateSchoolMembershipStatus({ schoolId, membershipId, status }); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update member."); } }
  return <AppBackground webContentWidth="wide">
    <View style={styles.hero}>
      <View style={styles.heroRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>SCHOOL ADMINISTRATION</Text>
          <Text style={styles.title}>{details?.school.name ?? "Quiks School"}</Text>
          <Text style={styles.light}>{details ? `${details.school.studentCount} students · ${details.school.teacherCount} teachers · ${details.school.pendingCount} pending` : "Loading…"}</Text>
        </View>
        {details?.viewer ? <View style={styles.viewer}><Text style={styles.viewerName}>{details.viewer.displayName}</Text><Text style={styles.viewerRole}>{details.viewer.role === "app_owner" ? "Quiks App Owner" : "School Administrator"}</Text></View> : null}
      </View>
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.grid}>
      <View style={styles.card}><Text style={styles.heading}>Enrolment profile form</Text><Text style={styles.copy}>Open only the fields your school needs. Required fields must be completed before an enrolment can be submitted.</Text>
        {fields.map((field) => <View key={field.id} style={styles.fieldRow}><View style={styles.flex}><TextInput value={field.label} editable={!field.system} onChangeText={(label) => patchField(field.id, { label })} style={styles.compactInput}/><Text style={styles.meta}>{field.roles.join(" & ")} · {field.type}</Text></View><View style={styles.switchBlock}><Text style={styles.meta}>Open</Text><Switch value={field.enabled} onValueChange={(enabled) => patchField(field.id, { enabled, required: enabled ? field.required : false })}/></View><View style={styles.switchBlock}><Text style={styles.meta}>Required</Text><Switch disabled={!field.enabled} value={field.required} onValueChange={(required) => patchField(field.id, { required })}/></View></View>)}
        <View style={styles.row}><TextInput value={customLabel} onChangeText={setCustomLabel} placeholder="New custom field" style={[styles.input, styles.flex]}/><Pressable style={styles.secondary} onPress={addCustomField}><Text style={styles.secondaryText}>Add field</Text></Pressable></View><Pressable style={styles.primary} onPress={saveFields}><Text style={styles.primaryText}>Save profile form</Text></Pressable>
      </View>
      <View style={styles.card}><Text style={styles.heading}>{details?.school.enrolmentMode === "individual_codes" ? "Generate an individual enrolment code" : "Invite staff or students"}</Text><Text style={styles.copy}>{details?.school.enrolmentMode === "individual_codes" ? "Enter one person's email and role. Each code is unique, can only be used by that email address, and enrols the person without a separate approval step." : "You may invite a person directly, or allow them to apply with the shared school code for your approval."}</Text><TextInput value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" style={styles.input}/><View style={styles.row}>{(["student", "teacher", "school_admin"] as SchoolMemberRole[]).map((role) => <Pressable key={role} onPress={() => setInviteRole(role)} style={[styles.role, inviteRole === role && styles.roleActive]}><Text style={inviteRole === role ? styles.primaryText : styles.secondaryText}>{role.replace("school_", "")}</Text></Pressable>)}</View><Pressable disabled={inviteBusy} style={[styles.primary, inviteBusy && styles.disabled]} onPress={sendInvite}><Text style={styles.primaryText}>{inviteBusy ? "Generating…" : details?.school.enrolmentMode === "individual_codes" ? "Generate unique code" : "Create invitation"}</Text></Pressable>
        {generatedInvite ? <View style={styles.inviteResult}>
          <Text style={styles.inviteResultTitle}>Invitation code created</Text>
          <Text style={styles.inviteCode}>{generatedInvite.code}</Text>
          <Text style={styles.inviteMeta}>{generatedInvite.email} · {generatedInvite.role.replace("school_", " ")} · expires {new Date(generatedInvite.expiresAt).toLocaleDateString()}</Text>
          <Text style={styles.inviteDelivery}>{generatedInvite.emailStatus === "sent" ? "The code was also sent to the email address." : generatedInvite.emailStatus === "failed" ? "The code was created, but email delivery failed. Copy and share it manually." : "Automatic email is not configured yet. Copy and share the code manually."}</Text>
          <Pressable style={styles.copyButton} onPress={() => void Clipboard.setStringAsync(generatedInvite.code)}><Text style={styles.copyButtonText}>Copy code</Text></Pressable>
        </View> : null}
        <Text style={[styles.heading, { marginTop: 24 }]}>Members</Text>{details?.memberships.map((member) => <View key={member.membershipId} style={styles.member}><View style={styles.flex}><Text style={styles.memberName}>{member.displayName}</Text><Text style={styles.meta}>{member.email} · {member.role.replace("_", " ")} · {member.status}</Text></View>{member.status === "pending" || member.status === "invited" ? <Pressable style={styles.small} onPress={() => setStatus(member.membershipId, "active")}><Text style={styles.primaryText}>Approve</Text></Pressable> : member.status === "active" && member.role !== "school_admin" ? <Pressable style={styles.danger} onPress={() => setStatus(member.membershipId, "suspended")}><Text style={styles.dangerText}>Suspend</Text></Pressable> : null}</View>)}</View>
    </View>
  </AppBackground>;
}
const styles = StyleSheet.create({ hero: { backgroundColor: palette.navy, borderRadius: 26, padding: 24, marginBottom: 16 }, heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }, viewer: { alignItems: "flex-end", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }, viewerName: { color: "white", fontWeight: "900", fontSize: 16 }, viewerRole: { color: "#70E2D8", fontWeight: "800", marginTop: 3 }, eyebrow: { color: "#70E2D8", fontWeight: "900", letterSpacing: 1.5 }, title: { color: "white", fontSize: 30, fontWeight: "900", marginTop: 7 }, light: { color: "#D8E8EE", marginTop: 7, fontSize: 16 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 }, card: { flexGrow: 1, flexBasis: 450, backgroundColor: "white", borderRadius: 24, padding: 20, ...shadows.card }, heading: { color: palette.navy, fontSize: 21, fontWeight: "900", marginBottom: 8 }, copy: { color: "#587180", lineHeight: 21, marginBottom: 10 }, fieldRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomColor: "#E4ECF1", borderBottomWidth: 1 }, flex: { flex: 1 }, compactInput: { color: palette.navy, fontWeight: "800", paddingVertical: 4 }, meta: { color: "#667E8B", fontSize: 12, textTransform: "capitalize" }, switchBlock: { alignItems: "center" }, input: { borderWidth: 1, borderColor: "#D5E0E8", borderRadius: 13, padding: 13, marginVertical: 8 }, row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }, primary: { backgroundColor: palette.navy, borderRadius: 14, padding: 14, alignItems: "center", marginTop: 10 }, disabled: { opacity: 0.55 }, primaryText: { color: "white", fontWeight: "900", textTransform: "capitalize" }, secondary: { borderWidth: 1, borderColor: palette.navy, padding: 13, borderRadius: 13 }, secondaryText: { color: palette.navy, fontWeight: "800", textTransform: "capitalize" }, role: { flex: 1, minWidth: 90, backgroundColor: "#EDF3F6", borderRadius: 12, padding: 11, alignItems: "center" }, roleActive: { backgroundColor: palette.navy }, inviteResult: { marginTop: 12, borderRadius: 15, padding: 14, backgroundColor: "#E9F8F2", borderWidth: 1, borderColor: "#81C9AF" }, inviteResultTitle: { color: "#125C45", fontWeight: "900" }, inviteCode: { color: palette.navy, fontWeight: "900", fontSize: 25, letterSpacing: 2, marginTop: 8 }, inviteMeta: { color: "#41695D", marginTop: 7, lineHeight: 19 }, inviteDelivery: { color: "#41695D", marginTop: 7, lineHeight: 19, fontWeight: "700" }, copyButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#125C45", borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9, marginTop: 10 }, copyButtonText: { color: "#125C45", fontWeight: "900" }, member: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, borderTopColor: "#E4ECF1", borderTopWidth: 1 }, memberName: { color: palette.navy, fontWeight: "900" }, small: { backgroundColor: palette.navy, padding: 9, borderRadius: 10 }, danger: { backgroundColor: "#FFF0EE", padding: 9, borderRadius: 10 }, dangerText: { color: "#B42318", fontWeight: "800" }, error: { color: "#B42318", backgroundColor: "#FFF0EE", padding: 12, borderRadius: 12, marginBottom: 12 } });
