import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const variants = ["children", "teens", "uni"];
const root = process.cwd();
const sourceRoot = join(root, "web-builds");
const targetRoot = join(root, "web-hosting");
const assetRoot = join(root, "assets", "images");
const variantWebAssets = {
  children: {
    title: "Quiks Children",
    svgLogo: "quiks-children-logo.svg",
    faviconPng: "quiks-children-playstore-icon-512.png",
  },
  teens: {
    title: "Quiks Teens",
    svgLogo: "quiks-teens-logo.svg",
    faviconPng: "quiks-teens-playstore-icon-512.png",
  },
  uni: {
    title: "Quiks Uni",
    svgLogo: "quiks-uni-logo.svg",
    faviconPng: "quiks-uni-playstore-icon-512.png",
  },
};

const variantRouteTitles = {
  children: "Quiks Children",
  teens: "Quiks Teens",
  uni: "Quiks Uni",
};

const hostedRouteWrappers = {
  children: [
    { route: "login", title: "Login" },
    { route: "signup", title: "Sign up" },
    { route: "select-profile", title: "Choose learner" },
    { route: "profile", title: "Profile" },
    { route: "profile-editor", title: "Create profile" },
    { route: "subscription", title: "Subscription" },
    { route: "classroom", title: "Classroom" },
    { route: "classroom-activity", title: "Classroom activity" },
    { route: "classroom-result", title: "Classroom results" },
    { route: "competition", title: "Competition" },
    { route: "session", title: "Session" },
    { route: "results", title: "Results" },
    { route: "breather", title: "Breather" },
    { route: "learning-hub", title: "Learning Hub" },
    { route: "certificate", title: "Certificate" },
  ],
  teens: [
    { route: "login", title: "Login" },
    { route: "signup", title: "Sign up" },
    { route: "select-profile", title: "Choose learner" },
    { route: "profile", title: "Profile" },
    { route: "profile-editor", title: "Create profile" },
    { route: "subscription", title: "Subscription" },
    { route: "classroom", title: "Classroom" },
    { route: "classroom-activity", title: "Classroom activity" },
    { route: "classroom-result", title: "Classroom results" },
    { route: "competition", title: "Competition" },
    { route: "session", title: "Session" },
    { route: "results", title: "Results" },
    { route: "breather", title: "Breather" },
    { route: "learning-hub", title: "Learning Hub" },
    { route: "certificate", title: "Certificate" },
  ],
  uni: [
    { route: "login", title: "Login" },
    { route: "signup", title: "Sign up" },
    { route: "select-profile", title: "Choose learner" },
    { route: "profile", title: "Profile" },
    { route: "profile-editor", title: "Create profile" },
    { route: "subscription", title: "Subscription" },
    { route: "classroom", title: "Classroom" },
    { route: "classroom-activity", title: "Classroom activity" },
    { route: "classroom-result", title: "Classroom results" },
    { route: "competition", title: "Competition" },
    { route: "session", title: "Session" },
    { route: "results", title: "Results" },
    { route: "breather", title: "Breather" },
    { route: "learning-hub", title: "Learning Hub" },
    { route: "certificate", title: "Certificate" },
  ],
};

function getEntryScriptName(expoDir) {
  const webDir = join(expoDir, "static", "js", "web");
  if (!existsSync(webDir)) {
    return null;
  }

  return readdirSync(webDir).find((file) => /^entry-.*\.js$/.test(file)) ?? null;
}

function createRouteWrapperHtml(variant, title, entryScriptName) {
  const appTitle = variantRouteTitles[variant];
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="quiks-variant" content="${variant}" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>${appTitle} | ${title}</title>
    <link rel="icon" type="image/png" sizes="512x512" href="../favicon.png" />
    <link rel="apple-touch-icon" href="../favicon.png" />
    <link rel="stylesheet" href="../variant-shell.css" />
    <style id="expo-reset">html,body{height:100%;}body{margin:0;}#root{display:flex;flex:1;min-height:100%;}</style>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="../expo/static/js/web/${entryScriptName}" defer></script>
  </body>
</html>
`;
}

function writeHostedRouteWrappers(targetDir, variant, entryScriptName) {
  const routes = hostedRouteWrappers[variant] ?? [];
  for (const route of routes) {
    const routeDir = join(targetDir, route.route);
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(routeDir, "index.html"), createRouteWrapperHtml(variant, route.title, entryScriptName), "utf8");
  }
}

function injectHeadMarkup(html, variant) {
  const assets = variantWebAssets[variant];
  const faviconMarkup = [
    `<meta name="quiks-variant" content="${variant}" />`,
    `<title>${assets.title}</title>`,
    '<link rel="icon" type="image/svg+xml" href="./logo.svg" />',
    '<link rel="icon" type="image/png" sizes="512x512" href="./favicon.png" />',
    '<link rel="apple-touch-icon" href="./favicon.png" />',
  ].join("");

  const withoutVariantMeta = html.replace(/\s*<meta name="quiks-variant" content="[^"]*"\s*\/?>/i, "");
  let updated = withoutVariantMeta.replace(/<title>.*?<\/title>/i, faviconMarkup);
  if (!/<link rel="icon"/i.test(updated)) {
    updated = updated.replace("</head>", `${faviconMarkup}</head>`);
  }

  return updated;
}

function stripHostedHeaderShell(html) {
  let updated = html.replace(/\s*<div class="variant-header-shell">[\s\S]*?<\/div>\s*/i, "\n");

  updated = updated.replace(
    /\s*<script>\s*\(function \(\) \{\s*var path = window\.location\.pathname \|\| "\/";[\s\S]*?\}\)\(\);\s*<\/script>\s*/i,
    "\n"
  );

  return updated;
}

function injectLocalFileGuard(html, variant) {
  const liveUrl = `https://${variant}.quiks.site`;
  const guardScript = `
    <script>
      (function () {
        if (window.location.protocol !== "file:") {
          return;
        }

        document.addEventListener("DOMContentLoaded", function () {
          document.body.innerHTML =
            '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#11444A 0%,#2BBFB5 55%,#EEF8F7 100%);font-family:Arial,sans-serif;padding:24px;">' +
              '<div style="max-width:720px;background:rgba(255,255,255,0.96);border-radius:28px;padding:32px;box-shadow:0 18px 50px rgba(8,17,31,0.14);color:#13202A;">' +
                '<h1 style="margin:0 0 14px;font-size:40px;line-height:1.08;">Local file preview is not supported</h1>' +
                '<p style="margin:0 0 16px;line-height:1.7;font-size:18px;">This exported Quiks variant app should be opened through a web server or its live domain, not directly with <strong>file://</strong>.</p>' +
                '<p style="margin:0 0 20px;line-height:1.7;">Use the live site below, or run a local server for this folder before testing.</p>' +
                '<div style="display:flex;flex-wrap:wrap;gap:12px;">' +
                  '<a href="${liveUrl}" style="display:inline-block;padding:14px 18px;border-radius:999px;background:#0A3F44;color:#fff;text-decoration:none;font-weight:700;">Open live site</a>' +
                '</div>' +
                '<p style="margin:20px 0 0;line-height:1.7;color:#48626B;">Example local test: serve this folder with a local web server, then open it over <strong>http://</strong>.</p>' +
              '</div>' +
            '</div>';
        });
      })();
    </script>
  `;

  return html.replace("</body>", `${guardScript}</body>`);
}

mkdirSync(targetRoot, { recursive: true });

for (const variant of variants) {
  const sourceDir = join(sourceRoot, variant);
  const targetDir = join(targetRoot, variant);
  const sourceExpoDir = join(sourceDir, "_expo");
  const targetExpoDir = join(targetDir, "expo");
  const indexFile = join(targetDir, "index.html");
  const classroomInviteFile = join(targetDir, "classroom-invite.html");
  const classroomInviteLauncher = existsSync(classroomInviteFile)
    ? readFileSync(classroomInviteFile, "utf8")
    : null;
  const assets = variantWebAssets[variant];

  if (!existsSync(sourceDir)) {
    continue;
  }

  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, { recursive: true });

  if (existsSync(sourceExpoDir)) {
    rmSync(targetExpoDir, { recursive: true, force: true });
    cpSync(sourceExpoDir, targetExpoDir, { recursive: true });
    rmSync(join(targetDir, "_expo"), { recursive: true, force: true });
  }

  const entryScriptName = getEntryScriptName(targetExpoDir);

  if (existsSync(indexFile)) {
    const original = readFileSync(indexFile, "utf8");
    const rewiredExpoPath = original.replace(/src="\/?_expo\/static\/js\/web\//g, 'src="./expo/static/js/web/');
    const cleaned = stripHostedHeaderShell(rewiredExpoPath);
    const updated = injectLocalFileGuard(injectHeadMarkup(cleaned, variant), variant);
    writeFileSync(indexFile, updated, "utf8");
  }

  cpSync(join(assetRoot, assets.svgLogo), join(targetDir, "logo.svg"));
  cpSync(join(assetRoot, assets.faviconPng), join(targetDir, "favicon.png"));
  if (classroomInviteLauncher) {
    writeFileSync(classroomInviteFile, classroomInviteLauncher, "utf8");
  }
  if (entryScriptName) {
    writeHostedRouteWrappers(targetDir, variant, entryScriptName);
  }
}

console.log("Prepared hostable web builds in web-hosting.");
