import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const buildsRoot = join(root, "web-builds");
const hostingRoot = join(root, "web-hosting");

const routesByVariant = {
  children: [
    ["login", "Login"],
    ["signup", "Sign up"],
    ["select-profile", "Choose learner"],
    ["profile", "Profile"],
    ["profile-editor", "Create profile"],
    ["subscription", "Subscription"],
    ["session", "Session"],
    ["results", "Results"],
    ["breather", "Breather"],
  ],
  teens: [
    ["login", "Login"],
    ["signup", "Sign up"],
    ["select-profile", "Choose learner"],
    ["profile", "Profile"],
    ["profile-editor", "Create profile"],
    ["subscription", "Subscription"],
    ["classroom", "Classroom"],
    ["classroom-activity", "Classroom activity"],
    ["classroom-result", "Classroom results"],
    ["competition", "Competition"],
    ["session", "Session"],
    ["results", "Results"],
    ["breather", "Breather"],
  ],
  uni: [
    ["login", "Login"],
    ["signup", "Sign up"],
    ["select-profile", "Choose learner"],
    ["profile", "Profile"],
    ["profile-editor", "Create profile"],
    ["subscription", "Subscription"],
    ["classroom", "Classroom"],
    ["classroom-activity", "Classroom activity"],
    ["classroom-result", "Classroom results"],
    ["competition", "Competition"],
    ["session", "Session"],
    ["results", "Results"],
    ["breather", "Breather"],
  ],
};

const titles = {
  children: "Quiks Children",
  teens: "Quiks Teens",
  uni: "Quiks Uni",
};

function getEntryScriptName(variant) {
  const webDir = join(buildsRoot, variant, "_expo", "static", "js", "web");
  if (!existsSync(webDir)) {
    return null;
  }

  return readdirSync(webDir).find((file) => /^entry-.*\.js$/.test(file)) ?? null;
}

function createWrapperHtml(variant, pageTitle, entryScriptName) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>${titles[variant]} | ${pageTitle}</title>
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

for (const variant of Object.keys(routesByVariant)) {
  const sourceExpoDir = join(buildsRoot, variant, "_expo");
  const targetExpoDir = join(hostingRoot, variant, "expo");
  const targetIndex = join(hostingRoot, variant, "index.html");
  const entryScriptName = getEntryScriptName(variant);

  if (!existsSync(sourceExpoDir) || !entryScriptName) {
    continue;
  }

  rmSync(targetExpoDir, { recursive: true, force: true });
  cpSync(sourceExpoDir, targetExpoDir, { recursive: true });

  if (existsSync(targetIndex)) {
    const original = readFileSync(targetIndex, "utf8");
    const updated = original.replace(
      /src="\.\/expo\/static\/js\/web\/entry-.*?\.js"/,
      `src="./expo/static/js/web/${entryScriptName}"`
    );
    writeFileSync(targetIndex, updated, "utf8");
  }

  for (const [route, pageTitle] of routesByVariant[variant]) {
    const routeDir = join(hostingRoot, variant, route);
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(routeDir, "index.html"), createWrapperHtml(variant, pageTitle, entryScriptName), "utf8");
  }
}

console.log("Hosted web bundles and route wrappers refreshed.");
