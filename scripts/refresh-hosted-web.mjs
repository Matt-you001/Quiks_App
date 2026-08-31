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
    ["classroom", "Classroom"],
    ["classroom-activity", "Classroom activity"],
    ["classroom-result", "Classroom results"],
    ["competition", "Competition"],
    ["session", "Session"],
    ["results", "Results"],
    ["breather", "Breather"],
    ["learning-hub", "Learning Hub"],
    ["certificate", "Certificate"],
    ["school", "Quiks School"],
    ["school-enrol", "School enrolment"],
    ["school-admin", "School administration"],
    ["school-owner", "School owner dashboard"],
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
    ["learning-hub", "Learning Hub"],
    ["certificate", "Certificate"],
    ["school", "Quiks School"],
    ["school-enrol", "School enrolment"],
    ["school-admin", "School administration"],
    ["school-owner", "School owner dashboard"],
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
    ["learning-hub", "Learning Hub"],
    ["certificate", "Certificate"],
    ["school", "Quiks School"],
    ["school-enrol", "School enrolment"],
    ["school-admin", "School administration"],
    ["school-owner", "School owner dashboard"],
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
    <meta name="quiks-variant" content="${variant}" />
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
    const withVariant = /<meta name="quiks-variant"/i.test(original)
      ? original.replace(/<meta name="quiks-variant" content="[^"]*"\s*\/?>/i, `<meta name="quiks-variant" content="${variant}" />`)
      : original.replace(/<meta charset="utf-8"\s*\/?>/i, `$&\n    <meta name="quiks-variant" content="${variant}" />`);
    const updated = withVariant.replace(
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

  const hostedWebDir = join(targetExpoDir, "static", "js", "web");
  const hostedEntries = readdirSync(hostedWebDir).filter((file) => /^entry-.*\.js$/.test(file));
  if (hostedEntries.length !== 1 || hostedEntries[0] !== entryScriptName) {
    throw new Error(
      `${variant} hosting must contain exactly ${entryScriptName}; found ${hostedEntries.join(", ") || "none"}.`
    );
  }

  const appPages = [
    targetIndex,
    ...routesByVariant[variant].map(([route]) => join(hostingRoot, variant, route, "index.html")),
  ];
  for (const appPage of appPages) {
    const html = readFileSync(appPage, "utf8");
    const referencedEntries = html.match(/entry-[^"']+\.js/g) ?? [];
    if (referencedEntries.length !== 1 || referencedEntries[0] !== entryScriptName) {
      throw new Error(`${appPage} points to a stale or missing web bundle.`);
    }
  }
}

console.log("Hosted web bundles and route wrappers refreshed.");
