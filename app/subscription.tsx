import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { t } from "../lib/i18n";
import { ensurePaddleConfigured, hasPaddleClientToken, openPaddleCheckout } from "../lib/paddle";
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
import { normalizeSubscriptionPlanPeriod } from "../lib/web-checkout";
import type { AppLanguage, SubscriptionTier } from "../types/app";

export default function SubscriptionScreen() {
  const params = useLocalSearchParams<{ plan?: string }>();
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

    if (hasPaddleClientToken()) {
      void ensurePaddleConfigured().catch(() => undefined);
    }

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
      } else if (storeState.reason === "sdk_key_missing") {
        setStoreMessage("Subscription is not configured for this variant yet. Add the RevenueCat public SDK key and offering.");
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
      if (Platform.OS === "web" && hasPaddleClientToken()) {
        await openPaddleCheckout(productId);
        return;
      }

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

  const selectedPlanPeriod = normalizeSubscriptionPlanPeriod(params.plan);
  const visiblePlans =
    selectedPlanPeriod === null
      ? plans
      : [...plans].sort((left, right) => {
          const leftSelected = left.period === selectedPlanPeriod ? 0 : 1;
          const rightSelected = right.period === selectedPlanPeriod ? 0 : 1;
          return leftSelected - rightSelected;
        });

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
        <>
          {loadingStore ? <Text style={styles.storeMessage}>Loading store details...</Text> : null}
          {selectedPlanPeriod ? (
            <Text style={styles.storeMessage}>
              {selectedPlanPeriod === "yearly" ? "Checkout preference: yearly plan" : "Checkout preference: monthly plan"}
            </Text>
          ) : null}
          {storeMessage ? <Text style={styles.storeMessage}>{storeMessage}</Text> : null}
          {storeReady && visiblePlans.length > 0 ? (
            <View style={styles.planList}>
              {visiblePlans.map((plan) => {
                const isSelectedPlan = selectedPlanPeriod !== null && plan.period === selectedPlanPeriod;
                const actionLabel =
                  subscriptionTier === "pro"
                    ? t(language, "proPlan")
                    : isSelectedPlan
                      ? "Continue with selected plan"
                      : t(language, "upgradeToPro");

                return (
                  <View key={plan.productId} style={[styles.planCard, isSelectedPlan ? styles.selectedPlanCard : null]}>
                    {isSelectedPlan ? (
                      <View style={styles.selectedPlanHeader}>
                        <Text style={styles.selectedPlanBadge}>Selected plan</Text>
                        <Text style={styles.selectedPlanHint}>This matches the checkout option you picked on the web.</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.planTitle, isSelectedPlan ? styles.selectedPlanTitle : null]}>{getPlanLabel(plan)}</Text>
                    <Text style={[styles.planPrice, isSelectedPlan ? styles.selectedPlanPrice : null]}>
                      {plan.displayPrice || plan.productId}
                    </Text>
                    {plan.description ? <Text style={styles.planText}>{plan.description}</Text> : null}
                    <PrimaryButton
                      label={actionLabel}
                      onPress={() => subscribeToPlan(plan.productId)}
                      loading={activeProductId === plan.productId}
                      disabled={subscriptionTier === "pro"}
                      compact
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      </View>

      <View style={styles.actionColumn}>
        <>
          <PrimaryButton
            label={t(language, "restorePurchases")}
            variant="secondary"
            onPress={restorePurchases}
            loading={restoring}
          />
          <PrimaryButton label={t(language, "refreshStatus")} variant="secondary" onPress={load} disabled={loadingStore} />
        </>
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
  selectedPlanCard: {
    borderColor: palette.aqua,
    borderWidth: 2,
    backgroundColor: "#F1FCFA",
    shadowColor: "#0D6D73",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  selectedPlanHeader: {
    gap: 6,
  },
  selectedPlanBadge: {
    alignSelf: "flex-start",
    backgroundColor: palette.aqua,
    color: palette.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
  },
  selectedPlanHint: {
    color: palette.navy,
    lineHeight: 18,
    fontWeight: "600",
  },
  planTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  selectedPlanTitle: {
    color: palette.aqua,
  },
  planPrice: {
    color: palette.navy,
    fontSize: 15,
    fontWeight: "800",
  },
  selectedPlanPrice: {
    fontSize: 18,
  },
  planText: {
    color: palette.slate,
    lineHeight: 20,
  },
  storeMessage: {
    marginTop: 10,
    color: palette.slate,
    lineHeight: 20,
  },
});
