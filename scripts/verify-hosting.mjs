import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "web-hosting");
const appLinks = {
  children: {
    packageName: "com.quiks.mobile",
    fingerprints: ["7C:D4:83:7F:6D:DC:94:C9:B4:97:F2:33:6A:86:8B:04:6A:5E:A7:CD:10:AA:4F:4B:FD:B4:B1:9D:60:54:44:96"],
  },
  teens: {
    packageName: "com.quiks.teens",
    fingerprints: ["F1:99:EE:49:6C:A0:F8:EA:45:8C:F4:F7:E8:ED:2E:6E:ED:EB:D5:84:0F:42:77:7F:74:FB:66:B4:E4:36:CF:E2"],
  },
  uni: {
    packageName: "com.quiks.uni",
    fingerprints: [
      "D7:65:7F:3F:9A:7F:E8:6D:36:F6:7F:A0:5F:94:09:97:E0:74:AF:7A:6F:FD:14:2E:B4:8A:19:D6:F2:B8:11:76",
      "AA:A0:FA:E9:03:3E:42:5B:3E:BB:86:BF:4E:8B:91:BF:C1:F9:C7:AF:F8:F3:6F:EB:CA:E8:11:D6:3A:8E:0B:F1",
    ],
  },
};
const pages = ["", "login", "signup", "classroom", "classroom-activity", "classroom-result", "school", "school-enrol", "school-admin", "school-owner", "practice"];
for (const variant of ["children", "teens", "uni"]) {
  const base = join(root, variant);
  const jsDir = join(base, "expo", "static", "js", "web");
  const files = readdirSync(jsDir).filter(f => f.endsWith(".js"));
  const entries = files.filter(f => /^entry-/.test(f));
  assert.equal(entries.length, 1, `${variant}: exactly one current entry bundle`);
  const bundle = readFileSync(join(jsDir, entries[0]), "utf8");
  assert.ok(bundle.replaceAll("\\", "").includes(`"APP_VARIANT":"${variant}"`), `${variant}: compiled variant configuration`);
  for (const marker of ["https://quiks-app.onrender.com", "/school/admin/classes/create", "/school/admin/results/list", "/school/owner/individual-licence", "Classes & records", "Open school class", "Issue individual licence", "Individual licences", "Toggle school menu", "subscriptionProfileLimit"]) {
    assert.ok(bundle.includes(marker), `${variant}: missing ${marker}`);
  }
  assert.ok(!bundle.includes("Collapse Menu") && !bundle.includes("Collapse menu"), `${variant}: obsolete labelled menu control`);
  assert.ok(!bundle.includes("https://quiks-openai-proxy.onrender.com"), `${variant}: obsolete backend URL`);
  if (appLinks[variant]) {
    const assetLinksFile = join(base, ".well-known", "assetlinks.json");
    const statements = JSON.parse(readFileSync(assetLinksFile, "utf8"));
    assert.equal(statements[0]?.target?.package_name, appLinks[variant].packageName, `${variant}: app-links package`);
    for (const fingerprint of appLinks[variant].fingerprints) {
      assert.ok(
        statements[0]?.target?.sha256_cert_fingerprints?.includes(fingerprint),
        `${variant}: Play signing fingerprint ${fingerprint}`
      );
    }
    assert.ok(readFileSync(join(base, ".htaccess"), "utf8").includes("application/json"), `${variant}: JSON MIME type`);
  }
  for (const route of pages) {
    const page = join(base, route, "index.html");
    const html = readFileSync(page, "utf8");
    assert.ok(html.includes(`name="quiks-variant" content="${variant}"`), `${page}: variant metadata`);
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
    assert.equal(scripts.filter(s => s.includes(entries[0])).length, 1, `${page}: current bundle`);
    const assets = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g)].map(m => m[1]);
    for (const asset of assets) {
      if (/^(https?:|data:|\/\/)/.test(asset)) continue;
      const target = asset.startsWith("/") ? join(base, asset) : resolve(dirname(page), asset.split("?")[0]);
      assert.ok(existsSync(target) && statSync(target).isFile(), `${page}: missing ${asset}`);
    }
  }
  console.log(`${variant}: ${pages.length} pages checked; ${files.length} JS files; ${entries[0]}; backend correct; new classroom/results features present.`);
}
