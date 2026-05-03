import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { t } from "../lib/i18n";
import { readAppState, setSubscriptionTier } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import type { AppLanguage, SubscriptionTier } from "../types/app";

export default function SubscriptionScreen() {
  const [subscriptionTier, setSubscriptionTierState] = useState<SubscriptionTier>("free");
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const state = await readAppState();
    setSubscriptionTierState(state.subscriptionTier);
    setLanguage(state.profiles.find((profile) => profile.id === state.currentProfileId)?.language ?? "en");
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const updatePlan = async (nextTier: SubscriptionTier) => {
    setSaving(true);
    await setSubscriptionTier(nextTier);
    setSubscriptionTierState(nextTier);
    setSaving(false);
  };

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.title}>{t(language, "manageSubscription")}</Text>
        <Text style={styles.subtitle}>{t(language, "subscriptionSubtitle")}</Text>
        <Text style={styles.planStatus}>
          {t(language, "currentPlan")}: {subscriptionTier === "pro" ? t(language, "proPlan") : t(language, "freePlan")}
        </Text>
        {appVariant.id === "children" ? <Text style={styles.note}>{t(language, "childrenAdFreeNote")}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(language, "freePlan")}</Text>
        <Text style={styles.cardText}>{t(language, "subscriptionFreeFeatures")}</Text>
        <Text style={styles.statusText}>{t(language, "freePlanStatus")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(language, "proPlan")}</Text>
        <Text style={styles.cardText}>{t(language, "subscriptionProFeatures")}</Text>
        <Text style={styles.statusText}>{t(language, "proPlanStatus")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardText}>{t(language, "localSubscriptionNote")}</Text>
      </View>

      <View style={styles.actionColumn}>
        {subscriptionTier === "free" ? (
          <PrimaryButton label={t(language, "upgradeToPro")} onPress={() => updatePlan("pro")} loading={saving} />
        ) : (
          <PrimaryButton label={t(language, "switchToFree")} variant="secondary" onPress={() => updatePlan("free")} loading={saving} />
        )}
        <PrimaryButton label={t(language, "backHome")} variant="ghost" onPress={() => router.replace("/")} />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 12,
    borderRadius: 28,
    padding: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  title: {
    color: palette.white,
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    color: "#E8F4FB",
    lineHeight: 22,
  },
  planStatus: {
    marginTop: 12,
    color: palette.white,
    fontWeight: "800",
  },
  note: {
    marginTop: 10,
    color: "#D8EDF8",
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
    marginBottom: 10,
  },
  cardText: {
    color: palette.slate,
    lineHeight: 22,
  },
  statusText: {
    marginTop: 10,
    color: palette.navy,
    fontWeight: "700",
  },
  actionColumn: {
    marginTop: 18,
    gap: 12,
  },
});
