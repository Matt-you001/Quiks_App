import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { t } from "../lib/i18n";
import { areSubscriptionRestrictionsEnabled } from "../lib/subscription";
import {
  endPurchaseConnection,
  loadSubscriptionStoreState,
  purchaseProSubscription,
  purchaseRuntimeAvailable,
  restoreProSubscription,
  type SubscriptionPlan,
} from "../lib/purchases";
import { readAppState } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import type { AppLanguage, SubscriptionTier } from "../types/app";

const SHOW_SUBSCRIPTION_PURCHASES = false;

export default function SubscriptionScreen() {
  const [subscriptionTier, setSubscriptionTierState] = useState<SubscriptionTier>("free");
  const [language, setLanguage] = useState<AppLanguage>("en");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [storeReady, setStoreReady] = useState(false);

  const load = useCallback(async () => {
    const state = await readAppState();
    const nextLanguage = state.profiles.find((profile) => profile.id === state.currentProfileId)?.language ?? "en";
    setLanguage(nextLanguage);
    setSubscriptionTierState(state.subscriptionTier);

    if (!purchaseRuntimeAvailable()) {
      setStoreReady(false);
      setStoreMessage(t(nextLanguage, "subscriptionNotSupported"));
      setLoadingStore(false);
      return;
    }

    setLoadingStore(true);
    try {
      const storeState = await loadSubscriptionStoreState();
      setPlans(storeState.plans);
      setStoreReady(storeState.available);
      setSubscriptionTierState(storeState.active ? "pro" : "free");

      if (storeState.reason === "products_unavailable") {
        setStoreMessage(t(nextLanguage, "subscriptionProductsUnavailable"));
      } else if (!storeState.available) {
        setStoreMessage(t(nextLanguage, "subscriptionSyncFailedMessage"));
      } else {
        setStoreMessage(null);
      }
    } catch (error) {
      setStoreReady(false);
      setStoreMessage(t(nextLanguage, "subscriptionSyncFailedMessage"));
    } finally {
      setLoadingStore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        void endPurchaseConnection();
      };
    }, [load])
  );

  const subscribeToPlan = async (productId: string) => {
    setActiveProductId(productId);
    try {
      const result = await purchaseProSubscription(productId);
      if (result.active) {
        setSubscriptionTierState("pro");
        Alert.alert(t(language, "purchaseSuccessTitle"), t(language, "purchaseSuccessMessage"));
        return;
      }

      Alert.alert(t(language, "purchasePendingTitle"), t(language, "purchasePendingMessage"));
    } catch (error) {
      Alert.alert(
        t(language, "purchaseFailedTitle"),
        error instanceof Error ? error.message : t(language, "subscriptionSyncFailedMessage")
      );
    } finally {
      setActiveProductId(null);
    }
  };

  const restorePurchases = async () => {
    setRestoring(true);
    try {
      const result = await restoreProSubscription();
      setSubscriptionTierState(result.active ? "pro" : "free");
      Alert.alert(
        result.active ? t(language, "restoreSuccessTitle") : t(language, "restoreFreeTitle"),
        result.active ? t(language, "restoreSuccessMessage") : t(language, "restoreFreeMessage")
      );
    } catch (error) {
      Alert.alert(
        t(language, "subscriptionSyncFailedTitle"),
        error instanceof Error ? error.message : t(language, "subscriptionSyncFailedMessage")
      );
    } finally {
      setRestoring(false);
    }
  };

  const getPlanLabel = (plan: SubscriptionPlan) => {
    if (plan.period === "monthly") {
      return t(language, "monthlyPlan");
    }

    if (plan.period === "yearly") {
      return t(language, "yearlyPlan");
    }

    return plan.title;
  };

  return (
    <AppBackground>
      <View style={styles.heroCard}>
        <Text style={styles.title}>{t(language, "manageSubscription")}</Text>
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

      <View style={styles.actionColumn}>
        {SHOW_SUBSCRIPTION_PURCHASES && areSubscriptionRestrictionsEnabled() ? (
          <>
            <PrimaryButton
              label={t(language, "restorePurchases")}
              variant="secondary"
              onPress={restorePurchases}
              loading={restoring}
            />
            <PrimaryButton label={t(language, "refreshStatus")} variant="secondary" onPress={load} disabled={loadingStore} />
          </>
        ) : null}
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
  planList: {
    gap: 12,
    marginTop: 10,
  },
  planCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DEE7EF",
    padding: 14,
    gap: 8,
  },
  planTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  planPrice: {
    color: palette.navy,
    fontSize: 15,
    fontWeight: "800",
  },
  planText: {
    color: palette.slate,
    lineHeight: 20,
  },
});
