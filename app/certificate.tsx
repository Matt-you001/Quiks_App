import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Platform, Share, StyleSheet, Text, View } from "react-native";
import { AppBackground } from "../components/AppBackground";
import { BackIconButton } from "../components/BackIconButton";
import { PrimaryButton } from "../components/PrimaryButton";
import { appVariant } from "../lib/app-variant";
import { getGradeCertificate } from "../lib/certificates";
import { getCertificateExcellenceLabel, getCertificateSpeedLabel, t } from "../lib/i18n";
import { readAppState } from "../lib/storage";
import { palette, shadows } from "../lib/theme";
import type { AppLanguage, GradeCertificate, UserProfile } from "../types/app";

const certificateLogos = {
  children: require("../assets/images/quiks-children-playstore-icon-512.png"),
  teens: require("../assets/images/quiks-teens-playstore-icon-512.png"),
  uni: require("../assets/images/quiks-uni-playstore-icon-512.png"),
} as const;

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function buildShareText(certificate: GradeCertificate) {
  return `${certificate.learnerName} earned a ${appVariant.appName} Certificate of Grade Completion in ${certificate.subjectName}, ${certificate.grade}, with ${certificate.excellence} achievement (${certificate.averageScore}%) and ${certificate.speedAward} speed. Certificate ID: ${certificate.id.toUpperCase()}`;
}

export default function CertificateScreen() {
  const params = useLocalSearchParams<{ profileId?: string; subjectId?: string; grade?: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [certificate, setCertificate] = useState<GradeCertificate | null>(null);
  const [loaded, setLoaded] = useState(false);
  const language: AppLanguage = profile?.language ?? "en";

  useEffect(() => {
    readAppState().then((state) => {
      const selectedProfile = state.profiles.find((entry) => entry.id === params.profileId) ?? null;
      const results = selectedProfile ? state.results[selectedProfile.id] ?? [] : [];
      setProfile(selectedProfile);
      setCertificate(
        selectedProfile && typeof params.subjectId === "string" && typeof params.grade === "string"
          ? getGradeCertificate(selectedProfile, results, params.subjectId, params.grade)
          : null
      );
      setLoaded(true);
    });
  }, [params.grade, params.profileId, params.subjectId]);

  const shareCertificate = async () => {
    if (!certificate) return;
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.print();
      return;
    }

    try {
      await Share.share({ title: t(language, "gradeCertificate"), message: buildShareText(certificate) });
    } catch {
      Alert.alert(t(language, "gradeCertificate"), t(language, "unableShareCertificate"));
    }
  };

  if (!loaded || !profile || !certificate) {
    return (
      <AppBackground webContentWidth="standard">
        <BackIconButton fallbackHref="/profile" />
        <View style={styles.fallbackCard}>
          <Text style={styles.fallbackTitle}>{loaded ? t(language, "certificateNotAvailable") : t(language, "preparingSession")}</Text>
          {loaded ? <PrimaryButton label={t(language, "backToProfile")} onPress={() => router.replace("/profile")} /> : null}
        </View>
      </AppBackground>
    );
  }

  const awardedDate = new Date(certificate.awardedAt).toLocaleDateString(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <AppBackground webContentWidth="wide">
      <BackIconButton fallbackHref="/profile" />
      <View style={styles.certificateShell}>
        <View style={styles.outerBorder}>
          <View style={styles.innerBorder}>
            <View style={styles.brandRow}>
              <Image source={certificateLogos[appVariant.id]} style={styles.logo} resizeMode="cover" />
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>{appVariant.appName}</Text>
                <Text style={styles.brandTag}>{t(language, "learnFastGrowSteady")}</Text>
              </View>
            </View>

            <Text style={styles.eyebrow}>{t(language, "officialAchievement")}</Text>
            <Text style={styles.certificateTitle}>{t(language, "gradeCompletionCertificate")}</Text>
            <Text style={styles.presentedTo}>{t(language, "presentedTo")}</Text>
            <Text style={styles.learnerName}>{certificate.learnerName}</Text>
            <Text style={styles.statement}>
              {t(language, "certificateStatement", {
                subject: certificate.subjectName,
                grade: certificate.grade,
                levels: 20,
              })}
            </Text>

            <View style={styles.achievementRow}>
              <View style={styles.achievementCard}>
                <Text style={styles.achievementLabel}>{t(language, "levelOfExcellence")}</Text>
                <Text style={styles.achievementValue}>{getCertificateExcellenceLabel(language, certificate.excellence)}</Text>
                <Text style={styles.achievementMeta}>{certificate.averageScore}% {t(language, "averageScore")}</Text>
              </View>
              <View style={styles.seal}>
                <Text style={styles.sealStar}>★</Text>
                <Text style={styles.sealText}>{t(language, "certified")}</Text>
              </View>
              <View style={styles.achievementCard}>
                <Text style={styles.achievementLabel}>{t(language, "speedAchievement")}</Text>
                <Text style={styles.achievementValue}>{getCertificateSpeedLabel(language, certificate.speedAward)}</Text>
                <Text style={styles.achievementMeta}>{formatDuration(certificate.averageTimeSeconds)} {t(language, "averageTime")}</Text>
              </View>
            </View>

            <View style={styles.detailsGrid}>
              <Text style={styles.detail}>{t(language, "quiksIdLabel")}: {certificate.quiksId}</Text>
              <Text style={styles.detail}>{t(language, "age")}: {certificate.age}</Text>
              <Text style={styles.detail}>{t(language, "targetExam")}: {certificate.targetExam || "-"}</Text>
              {certificate.preferredCurriculum ? <Text style={styles.detail}>{t(language, "preferredCurriculum")}: {certificate.preferredCurriculum}</Text> : null}
              {certificate.schoolName ? <Text style={styles.detail}>{t(language, "schoolName")}: {certificate.schoolName}</Text> : null}
            </View>

            <View style={styles.footerRow}>
              <View style={styles.footerBlock}>
                <Text style={styles.footerValue}>{awardedDate}</Text>
                <Text style={styles.footerLabel}>{t(language, "dateAwarded")}</Text>
              </View>
              <View style={styles.footerBlock}>
                <Text style={styles.signature}>Tech Solution Providers Ltd</Text>
                <Text style={styles.footerLabel}>{t(language, "certificateIssuer")}</Text>
              </View>
              <View style={styles.footerBlock}>
                <Text style={styles.footerValue} numberOfLines={1}>{certificate.id.toUpperCase()}</Text>
                <Text style={styles.footerLabel}>{t(language, "certificateId")}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label={Platform.OS === "web" ? t(language, "printSaveCertificate") : t(language, "shareCertificate")} onPress={shareCertificate} />
        <PrimaryButton label={t(language, "backToProfile")} variant="secondary" onPress={() => router.replace("/profile")} />
      </View>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  certificateShell: { width: "100%", maxWidth: 1040, alignSelf: "center", marginTop: 14, borderRadius: 28, backgroundColor: palette.white, padding: 12, ...shadows.card },
  outerBorder: { borderWidth: 5, borderColor: palette.navy, borderRadius: 22, padding: 7 },
  innerBorder: { borderWidth: 2, borderColor: palette.aqua, borderRadius: 15, padding: 28, alignItems: "center", backgroundColor: palette.paper, overflow: "hidden" },
  brandRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", justifyContent: "center", gap: 14 },
  logo: { width: 72, height: 72, borderRadius: 18 },
  brandCopy: { alignItems: "flex-start" },
  brandName: { color: palette.navy, fontSize: 24, fontWeight: "900" },
  brandTag: { color: palette.slate, marginTop: 4, fontWeight: "600" },
  eyebrow: { marginTop: 24, color: palette.aqua, textTransform: "uppercase", letterSpacing: 2.2, fontSize: 12, fontWeight: "900" },
  certificateTitle: { marginTop: 8, color: palette.ink, fontSize: 38, lineHeight: 46, textAlign: "center", fontWeight: "900" },
  presentedTo: { marginTop: 22, color: palette.slate, fontSize: 15 },
  learnerName: { marginTop: 8, color: palette.navy, fontSize: 36, lineHeight: 44, textAlign: "center", fontWeight: "900", borderBottomWidth: 2, borderBottomColor: palette.aqua, paddingHorizontal: 24, paddingBottom: 5 },
  statement: { maxWidth: 760, marginTop: 18, color: palette.slate, textAlign: "center", fontSize: 17, lineHeight: 27 },
  achievementRow: { marginTop: 26, width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 18 },
  achievementCard: { width: 250, minHeight: 116, borderRadius: 18, padding: 16, alignItems: "center", justifyContent: "center", backgroundColor: palette.white, borderWidth: 1, borderColor: palette.mist },
  achievementLabel: { color: palette.slate, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "800" },
  achievementValue: { color: palette.navy, fontSize: 22, textAlign: "center", fontWeight: "900", marginTop: 8 },
  achievementMeta: { color: palette.slate, marginTop: 5, textAlign: "center" },
  seal: { width: 112, height: 112, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: palette.navy, borderWidth: 5, borderColor: palette.aqua },
  sealStar: { color: palette.white, fontSize: 30 },
  sealText: { color: palette.white, fontSize: 11, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  detailsGrid: { width: "100%", maxWidth: 780, marginTop: 26, borderRadius: 16, padding: 16, backgroundColor: "rgba(255,255,255,0.72)", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  detail: { color: palette.slate, lineHeight: 22, marginHorizontal: 8 },
  footerRow: { width: "100%", marginTop: 30, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 18 },
  footerBlock: { flex: 1, minWidth: 190, alignItems: "center", borderTopWidth: 1, borderTopColor: palette.slate, paddingTop: 8 },
  footerValue: { color: palette.ink, fontSize: 13, fontWeight: "800", maxWidth: 250 },
  footerLabel: { color: palette.slate, marginTop: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },
  signature: { color: palette.navy, fontSize: 14, fontStyle: "italic", fontWeight: "800" },
  actions: { width: "100%", maxWidth: 520, alignSelf: "center", marginTop: 18, gap: 12 },
  fallbackCard: { marginTop: 18, borderRadius: 24, padding: 20, backgroundColor: palette.white, gap: 16, ...shadows.card },
  fallbackTitle: { color: palette.ink, fontSize: 24, fontWeight: "900" },
});
