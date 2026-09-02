import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { appVariant } from "../lib/app-variant";
import { getAuthenticatedAccount } from "../lib/firebase";
import { syncAdministrativeProfileForAccount } from "../lib/school-identity";
import { setCurrentProfile } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import { enrolInSchool, getSchoolPublicDetails } from "../services/ai";
import type { SchoolMemberRole, SchoolProfileFieldDefinition, SchoolPublicDetails } from "../types/app";

export default function SchoolEnrolScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(String(params.code ?? "").toUpperCase());
  const [school, setSchool] = useState<SchoolPublicDetails | null>(null);
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const formRole = school?.invitationRole && school.invitationRole !== "student" ? "teacher" : role;
  const fields = useMemo(() => school?.profileFields.filter((field) => field.enabled && field.roles.includes(formRole)) ?? [], [formRole, school]);

  useEffect(() => {
    const account = getAuthenticatedAccount();
    if (account) setValues((current) => ({ ...current, fullName: current.fullName || account.name, email: current.email || account.email }));
    if (code) void lookup();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup() {
    setBusy(true);
    try { setSchool(await getSchoolPublicDetails(code)); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "School not found."); setSchool(null); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!school) return;
    setBusy(true);
    try {
      const result = await enrolInSchool({ schoolCode: school.schoolCode, role, appVariant: appVariant.id, profileData: values, invitationCode: school.invitationCode });
      const account = getAuthenticatedAccount();
      if (account && result.membership.status === "active") {
        await syncAdministrativeProfileForAccount(account).catch(() => undefined);
        await setCurrentProfile(`school-${appVariant.id}-${result.membership.membershipId}`);
      }
      Alert.alert("Quiks School", result.membership.status === "active" ? "You have joined the school." : "Your request has been sent to the school administrator for approval.");
      router.replace("/school" as never);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to enrol."); }
    finally { setBusy(false); }
  }

  return <AppBackground webContentWidth="narrow">
    <View style={styles.card}><Text style={styles.eyebrow}>QUIKS SCHOOL ENROLMENT</Text><Text style={styles.title}>{school?.name ?? "Find your school"}</Text>
      {!school ? <><TextInput value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="School or individual invitation code" style={styles.input}/><Pressable style={styles.button} onPress={lookup}><Text style={styles.buttonText}>{busy ? "Checking…" : "Find school"}</Text></Pressable></> : !school.enrolmentOpen && !school.invitationCode ? <>
        <Text style={styles.notice}>This school uses a unique code for every person. Ask the school administrator for your individual invitation code.</Text>
        <Pressable style={styles.button} onPress={() => { setSchool(null); setCode(""); }}><Text style={styles.buttonText}>Enter individual code</Text></Pressable>
      </> : <>
        {school.invitationRole ? <Text style={styles.notice}>Invitation role: {school.invitationRole.replace("school_", " ")}</Text> : <><Text style={styles.label}>I am joining as</Text><View style={styles.row}>{(["student", "teacher"] as const).map((item) => <Pressable key={item} onPress={() => setRole(item)} style={[styles.choice, role === item && styles.choiceActive]}><Text style={[styles.choiceText, role === item && styles.choiceTextActive]}>{item === "student" ? "Student" : "Teacher"}</Text></Pressable>)}</View></>}
        {fields.map((field) => <DynamicField key={field.id} field={field} value={values[field.id]} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))}/>) }
        <Pressable style={styles.button} onPress={submit}><Text style={styles.buttonText}>{busy ? "Submitting…" : "Submit enrolment"}</Text></Pressable>
      </>}{error ? <Text style={styles.error}>{error}</Text> : null}</View>
  </AppBackground>;
}

function DynamicField({ field, value, onChange }: { field: SchoolProfileFieldDefinition; value: string | boolean | undefined; onChange: (value: string | boolean) => void }) {
  if (field.type === "boolean") return <View style={styles.switchRow}><Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text><Switch value={Boolean(value)} onValueChange={onChange}/></View>;
  return <View><Text style={styles.label}>{field.label}{field.required ? " *" : ""}</Text>{field.type === "select" ? <View style={styles.wrap}>{field.options?.map((option) => <Pressable key={option} onPress={() => onChange(option)} style={[styles.pill, value === option && styles.choiceActive]}><Text style={value === option ? styles.choiceTextActive : styles.choiceText}>{option}</Text></Pressable>)}</View> : <TextInput value={String(value ?? "")} onChangeText={onChange} keyboardType={field.type === "email" ? "email-address" : field.type === "phone" || field.type === "number" ? "phone-pad" : "default"} autoCapitalize={field.type === "email" ? "none" : "sentences"} style={styles.input}/>}</View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: "white", borderRadius: 26, padding: 22, ...shadows.card }, eyebrow: { color: palette.navy, fontWeight: "900", letterSpacing: 1.5 }, title: { fontSize: 29, color: palette.navy, fontWeight: "900", marginVertical: 12 }, notice: { color: palette.navy, backgroundColor: "#EEF8FA", borderRadius: 13, padding: 13, lineHeight: 21, fontWeight: "700" }, label: { color: palette.navy, fontWeight: "800", marginTop: 14, marginBottom: 7 }, input: { borderWidth: 1, borderColor: "#D5E0E8", backgroundColor: "#F7F9FB", borderRadius: 14, padding: 15, fontSize: 16 }, button: { marginTop: 18, backgroundColor: palette.navy, borderRadius: 15, padding: 16, alignItems: "center" }, buttonText: { color: "white", fontWeight: "900", fontSize: 16 }, row: { flexDirection: "row", gap: 10 }, choice: { flex: 1, padding: 13, borderRadius: 13, backgroundColor: "#EEF3F6", alignItems: "center" }, choiceActive: { backgroundColor: palette.navy }, choiceText: { color: palette.navy, fontWeight: "800" }, choiceTextActive: { color: "white", fontWeight: "800" }, switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, pill: { padding: 11, borderRadius: 12, backgroundColor: "#EEF3F6" }, error: { color: "#B42318", marginTop: 12 } });
