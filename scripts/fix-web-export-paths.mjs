import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const variants = ["children", "teens", "uni"];
const root = process.cwd();

for (const variant of variants) {
  const file = join(root, "web-exports", variant, "index.html");
  if (!existsSync(file)) {
    continue;
  }

  const original = readFileSync(file, "utf8");
  const updated = original.replace(
    /src="\/_expo\/static\/js\/web\//g,
    'src="./_expo/static/js/web/'
  );

  if (updated !== original) {
    writeFileSync(file, updated, "utf8");
  }
}

console.log("Fixed variant web export bundle paths.");
