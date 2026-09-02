import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "web-hosting");
const pages = ["", "login", "signup", "classroom", "classroom-activity", "classroom-result", "school", "school-enrol", "school-admin", "school-owner", "practice"];
for (const variant of ["children", "teens", "uni"]) {
  const base = join(root, variant);
  const jsDir = join(base, "expo", "static", "js", "web");
  const files = readdirSync(jsDir).filter(f => f.endsWith(".js"));
  const entries = files.filter(f => /^entry-/.test(f));
  assert.equal(entries.length, 1, `${variant}: exactly one current entry bundle`);
  const bundle = readFileSync(join(jsDir, entries[0]), "utf8");
  assert.ok(bundle.replaceAll("\\", "").includes(`"APP_VARIANT":"${variant}"`), `${variant}: compiled variant configuration`);
  for (const marker of ["https://quiks-app.onrender.com", "/school/admin/classes/create", "/school/admin/results/list", "Classes & records", "Open school class"]) {
    assert.ok(bundle.includes(marker), `${variant}: missing ${marker}`);
  }
  assert.ok(!bundle.includes("https://quiks-openai-proxy.onrender.com"), `${variant}: obsolete backend URL`);
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
