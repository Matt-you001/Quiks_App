import { appVariant } from "./app-variant";
import { calculateQuizTime, getDifficultyForLevel, GRADE_LEVEL_COUNT } from "./quiz";
import { SCORE_THRESHOLD } from "./subjects";
import type { GradeCertificate, SessionResult, UserProfile } from "../types/app";

export const CERTIFICATE_LEVEL_COUNT = GRADE_LEVEL_COUNT;

function isCertifyingResult(result: SessionResult, subjectId: string, grade: string) {
  return result.subjectId === subjectId &&
    result.grade === grade &&
    result.mode === "quiz" &&
    !result.competitionId &&
    !result.classroomActivityId &&
    result.level >= 1 &&
    result.level <= CERTIFICATE_LEVEL_COUNT &&
    result.difficulty === getDifficultyForLevel(result.level) &&
    result.score >= SCORE_THRESHOLD;
}

export function getBestCertifyingResults(results: SessionResult[], subjectId: string, grade: string, throughDate?: string) {
  const bestByLevel = new Map<number, SessionResult>();
  const throughTime = throughDate ? new Date(throughDate).getTime() : Number.POSITIVE_INFINITY;

  for (const result of results) {
    if (!isCertifyingResult(result, subjectId, grade) || new Date(result.date).getTime() > throughTime) continue;
    const existing = bestByLevel.get(result.level);
    if (!existing || result.score > existing.score || (result.score === existing.score && result.timeTakenSeconds < existing.timeTakenSeconds)) {
      bestByLevel.set(result.level, result);
    }
  }

  return bestByLevel;
}

export function getCertificateProgress(results: SessionResult[], subjectId: string, grade: string) {
  return getBestCertifyingResults(results, subjectId, grade).size;
}

function getCompletionResult(results: SessionResult[], subjectId: string, grade: string) {
  const ordered = results
    .filter((result) => isCertifyingResult(result, subjectId, grade))
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  const completedLevels = new Set<number>();

  for (const result of ordered) {
    completedLevels.add(result.level);
    if (completedLevels.size === CERTIFICATE_LEVEL_COUNT) return result;
  }

  return null;
}

function getExcellence(averageScore: number): GradeCertificate["excellence"] {
  if (averageScore >= 90) return "Outstanding";
  if (averageScore >= 80) return "Excellent";
  if (averageScore >= 70) return "Very Good";
  return "Accomplished";
}

function getSpeedAward(speedPercent: number): GradeCertificate["speedAward"] {
  if (speedPercent <= 50) return "Lightning Fast";
  if (speedPercent <= 75) return "Swift";
  return "Focused";
}

export function getGradeCertificate(
  profile: UserProfile,
  results: SessionResult[],
  subjectId: string,
  grade: string
): GradeCertificate | null {
  const completionResult = getCompletionResult(results, subjectId, grade);
  if (!completionResult) return null;
  const bestByLevel = getBestCertifyingResults(results, subjectId, grade, completionResult.date);
  if (bestByLevel.size !== CERTIFICATE_LEVEL_COUNT) return null;

  const certifyingResults = Array.from(bestByLevel.values());
  const averageScore = Math.round(certifyingResults.reduce((sum, result) => sum + result.score, 0) / certifyingResults.length);
  const averageTimeSeconds = Math.round(
    certifyingResults.reduce((sum, result) => sum + result.timeTakenSeconds, 0) / certifyingResults.length
  );
  const speedPercent = Math.round(
    certifyingResults.reduce((sum, result) => sum + (result.timeTakenSeconds / calculateQuizTime(result.level)) * 100, 0) /
      certifyingResults.length
  );

  return {
    id: `${appVariant.id}-${profile.id}-${subjectId}-${grade}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase(),
    profileId: profile.id,
    learnerName: profile.name,
    quiksId: profile.quiksId,
    age: profile.age,
    targetExam: profile.targetExam,
    preferredCurriculum: profile.preferredCurriculum,
    schoolName: profile.schoolName,
    subjectId,
    subjectName: completionResult.subjectName,
    grade,
    awardedAt: completionResult.date,
    completionResultId: completionResult.id,
    averageScore,
    averageTimeSeconds,
    speedPercent,
    excellence: getExcellence(averageScore),
    speedAward: getSpeedAward(speedPercent),
  };
}

export function getProfileCertificates(profile: UserProfile, results: SessionResult[]) {
  const combinations = new Map<string, { subjectId: string; grade: string }>();
  for (const result of results) {
    combinations.set(`${result.subjectId}::${result.grade}`, { subjectId: result.subjectId, grade: result.grade });
  }

  return Array.from(combinations.values())
    .map(({ subjectId, grade }) => getGradeCertificate(profile, results, subjectId, grade))
    .filter((certificate): certificate is GradeCertificate => Boolean(certificate))
    .sort((left, right) => new Date(right.awardedAt).getTime() - new Date(left.awardedAt).getTime());
}
