import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { deleteProfile, getProfileResults, readAppState, setCurrentProfile, upsertProfile } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import type { SessionResult, UserProfile } from "../types/app";

const defaultForm = {
  name: "",
  age: "",
  targetExam: "General school prep",
  dailyGoalMinutes: "20",
};

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ProfileScreen() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [currentProfileId, setCurrentProfileIdState] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === currentProfileId) ?? null,
    [profiles, currentProfileId]
  );

  const load = useCallback(async () => {
    const state = await readAppState();
    setProfiles(state.profiles);
    setCurrentProfileIdState(state.currentProfileId);
    const profile = state.profiles.find((item) => item.id === state.currentProfileId) ?? null;
    if (profile) {
      setEditingId(profile.id);
      setForm({
        name: profile.name,
        age: String(profile.age),
        targetExam: profile.targetExam,
        dailyGoalMinutes: String(profile.dailyGoalMinutes),
      });
      setResults(await getProfileResults(profile.id));
    } else {
      setEditingId(null);
      setForm(defaultForm);
      setResults([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const saveProfile = async () => {
    if (!form.name.trim()) {
      Alert.alert("Name required", "Please enter a learner name.");
      return;
    }

    const age = Number(form.age);
    const goal = Number(form.dailyGoalMinutes);
    if (!Number.isFinite(age) || age < 3) {
      Alert.alert("Invalid age", "Please enter a valid age.");
      return;
    }

    if (!Number.isFinite(goal) || goal < 5) {
      Alert.alert("Invalid goal", "Please enter at least 5 minutes for the daily goal.");
      return;
    }

    setSaving(true);
    const profile: UserProfile = {
      id: editingId ?? createId(),
      name: form.name.trim(),
      age,
      targetExam: form.targetExam.trim() || "General school prep",
      dailyGoalMinutes: goal,
    };
    await upsertProfile(profile);
    await load();
    setSaving(false);
  };

  const switchProfile = async (profileId: string) => {
    await setCurrentProfile(profileId);
    await load();
  };

  const removeProfile = async (profileId: string) => {
    await deleteProfile(profileId);
    await load();
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultForm);
  };

  const totalCoins = results.reduce((sum, result) => sum + result.coinsEarned, 0);

  return (
    <AppBackground>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>Learner profile</Text>
        <Text style={styles.headerText}>
          Personalize the study experience, keep progress per learner, and prepare for a store-ready family-friendly app
          flow.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{editingId ? "Edit active learner" : "Create learner"}</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          value={form.name}
          onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
          style={styles.input}
          placeholder="Enter learner name"
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>Age</Text>
        <TextInput
          value={form.age}
          onChangeText={(value) => setForm((current) => ({ ...current, age: value }))}
          style={styles.input}
          placeholder="Age"
          keyboardType="number-pad"
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>Target exam</Text>
        <TextInput
          value={form.targetExam}
          onChangeText={(value) => setForm((current) => ({ ...current, targetExam: value }))}
          style={styles.input}
          placeholder="WAEC, school prep, olympiad..."
          placeholderTextColor="#7C8EA3"
        />

        <Text style={styles.label}>Daily goal in minutes</Text>
        <TextInput
          value={form.dailyGoalMinutes}
          onChangeText={(value) => setForm((current) => ({ ...current, dailyGoalMinutes: value }))}
          style={styles.input}
          placeholder="20"
          keyboardType="number-pad"
          placeholderTextColor="#7C8EA3"
        />

        <View style={styles.row}>
          <PrimaryButton label="Save profile" onPress={saveProfile} loading={saving} style={styles.flex} />
          <PrimaryButton label="New learner" variant="secondary" onPress={resetForm} style={styles.flex} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Saved learners</Text>
        {profiles.length === 0 ? (
          <Text style={styles.emptyText}>No learner profiles yet.</Text>
        ) : (
          profiles.map((profile) => (
            <View key={profile.id} style={styles.profileRow}>
              <View style={styles.profileMeta}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Text style={styles.profileSubtext}>
                  Age {profile.age} • {profile.targetExam} • {profile.dailyGoalMinutes} mins/day
                </Text>
              </View>
              <View style={styles.profileButtons}>
                <PrimaryButton
                  label={profile.id === currentProfileId ? "Active" : "Use"}
                  variant={profile.id === currentProfileId ? "primary" : "secondary"}
                  onPress={() => switchProfile(profile.id)}
                  style={styles.smallButton}
                />
                <PrimaryButton label="Delete" variant="ghost" onPress={() => removeProfile(profile.id)} style={styles.smallButton} />
              </View>
            </View>
          ))
        )}
      </View>

      {activeProfile ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Progress snapshot</Text>
          <Text style={styles.metricText}>Coins earned: {totalCoins}</Text>
          <Text style={styles.metricText}>Sessions completed: {results.length}</Text>
          <Text style={styles.metricText}>
            Latest score: {results[0] ? `${results[0].score}% in ${results[0].subjectName}` : "No sessions yet"}
          </Text>

          <Pressable onPress={() => router.back()} style={styles.linkButton}>
            <Text style={styles.linkText}>Return to home</Text>
          </Pressable>
        </View>
      ) : null}
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginTop: 12,
    borderRadius: 28,
    padding: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    color: palette.white,
    fontSize: 30,
    fontWeight: "800",
  },
  headerText: {
    marginTop: 10,
    color: "#E8F4FB",
    lineHeight: 22,
  },
  card: {
    marginTop: 18,
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 18,
    ...shadows.card,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 14,
  },
  label: {
    color: palette.slate,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 10,
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
  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  flex: {
    flex: 1,
  },
  emptyText: {
    color: palette.slate,
  },
  profileRow: {
    borderWidth: 1,
    borderColor: "#E3EAF1",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  profileMeta: {
    marginBottom: 10,
  },
  profileName: {
    color: palette.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  profileSubtext: {
    color: palette.slate,
    marginTop: 4,
  },
  profileButtons: {
    flexDirection: "row",
    gap: 10,
  },
  smallButton: {
    flex: 1,
    minHeight: 46,
  },
  metricText: {
    color: palette.slate,
    lineHeight: 24,
  },
  linkButton: {
    marginTop: 12,
    paddingVertical: 10,
  },
  linkText: {
    color: palette.navy,
    fontWeight: "700",
  },
});
