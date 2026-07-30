import { appVariant } from "./app-variant";

const variantMobileLinks = {
  children: {
    scheme: "quiks-children",
    packageName: "com.quiks.mobile",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.quiks.mobile",
    launcherUrl: "https://children.quiks.site/classroom-invite.html",
  },
  teens: {
    scheme: "quiks-teens",
    packageName: "com.quiks.teens",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.quiks.teens",
    launcherUrl: "https://teens.quiks.site/classroom-invite.html",
  },
  uni: {
    scheme: "quiks-uni",
    packageName: "com.quiks.uni",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.quiks.uni",
    launcherUrl: "https://uni.quiks.site/classroom-invite.html",
  },
} as const;

export function getVariantPlayStoreUrl() {
  return variantMobileLinks[appVariant.id].playStoreUrl;
}

export function createClassroomDeepLink(classCode: string, className?: string) {
  const normalizedCode = classCode.trim().toUpperCase();
  const query = new URLSearchParams({ joinCode: normalizedCode });
  if (className?.trim()) {
    query.set("className", className.trim());
  }
  return `${variantMobileLinks[appVariant.id].scheme}://classroom-invite?${query.toString()}`;
}

export function createClassroomInvitationLink(classCode: string, className?: string) {
  const mobileConfig = variantMobileLinks[appVariant.id];
  const normalizedCode = classCode.trim().toUpperCase();
  const query = new URLSearchParams({ joinCode: normalizedCode });
  if (className?.trim()) {
    query.set("className", className.trim());
  }
  return `${mobileConfig.launcherUrl}?${query.toString()}`;
}

export function createClassroomInvitationMessage(className: string, classCode: string) {
  const normalizedCode = classCode.trim().toUpperCase();
  const link = createClassroomInvitationLink(normalizedCode, className);
  return `You are invited to join my ${appVariant.appName} class "${className}". Open the invitation and choose Accept or Decline: ${link}\n\nIf ${appVariant.appName} is not installed, download it here: ${getVariantPlayStoreUrl()}\nClass code: ${normalizedCode}`;
}

export function readClassroomInvitationCodeFromLocation() {
  if (typeof globalThis === "undefined" || !("location" in globalThis) || !globalThis.location) {
    return null;
  }

  const code = new URLSearchParams(globalThis.location.search).get("joinCode")?.trim().toUpperCase();
  return code || null;
}
