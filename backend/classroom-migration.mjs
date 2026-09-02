import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export const CLASSROOM_RESET_VERSION = "reset-test-data-v1";
const pathKey = (path) => process.platform === "win32" ? path.toLowerCase() : path;

async function canonicalTarget(path) {
  await mkdir(dirname(path), { recursive: true });
  return join(await realpath(dirname(path)), basename(path));
}

// Run once at process startup, BEFORE serving requests or caching the store.
// No authentication bypass, guessed identity mapping or school-store mutation.
export async function migrateClassroomTestData({ mode, classroomPath, schoolPath, emptyStore }) {
  if (!mode) return { status: "not_requested" };
  if (mode !== CLASSROOM_RESET_VERSION) throw new Error("Unsupported QUIKS_CLASSROOM_MIGRATION value. Remove it or use reset-test-data-v1.");
  if (!isAbsolute(classroomPath || "") || !isAbsolute(schoolPath || "")) {
    throw new Error("The classroom reset requires explicit absolute CLASSROOM_STORE_PATH and SCHOOL_STORE_PATH values.");
  }
  if (pathKey(resolve(classroomPath)) === pathKey(resolve(schoolPath))) throw new Error("Classroom and school store paths must be different. Nothing was reset.");
  const target = await canonicalTarget(classroomPath);
  const schoolTarget = await canonicalTarget(schoolPath);
  if (pathKey(target) === pathKey(schoolTarget)) throw new Error("Classroom and school store paths resolve to the same file. Nothing was reset.");
  let oldBytes;
  let info;
  try {
    info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("Refusing to reset a non-regular classroom store file.");
    try {
      const schoolInfo = await lstat(schoolTarget);
      if ((schoolInfo.dev === info.dev && schoolInfo.ino === info.ino) || await realpath(schoolTarget) === await realpath(target)) {
        throw new Error("Classroom store aliases the school store. Nothing was reset.");
      }
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    oldBytes = await readFile(target);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const oldStore = oldBytes ? JSON.parse(oldBytes.toString("utf8")) : null;
  if (oldStore?.migrations?.[CLASSROOM_RESET_VERSION]?.completedAt) return { status: "already_completed" };
  if (oldStore !== null && (typeof oldStore !== "object" || Array.isArray(oldStore))) throw new Error("Classroom store format is invalid; nothing was reset.");

  const lockPath = `${target}.identity-reset.lock`;
  await writeFile(lockPath, `${process.pid}\n`, { flag: "wx", mode: 0o600 });
  const suffix = `${Date.now()}-${randomUUID()}`;
  const backupPath = oldBytes ? `${target}.before-identity-reset-${suffix}.backup` : null;
  const temporaryPath = `${target}.identity-reset-${suffix}.tmp`;
  try {
    // Backup must succeed before replacement. Existing backups are never reused.
    if (backupPath) await writeFile(backupPath, oldBytes, { flag: "wx", mode: 0o600 });
    const freshStore = {
      ...structuredClone(emptyStore),
      migrations: { [CLASSROOM_RESET_VERSION]: { completedAt: new Date().toISOString(), backupFile: backupPath ? basename(backupPath) : null } },
    };
    await writeFile(temporaryPath, JSON.stringify(freshStore, null, 2), { flag: "wx", mode: 0o600 });
    await rename(temporaryPath, target);
    return { status: "completed", backupCreated: Boolean(backupPath) };
  } finally {
    await unlink(temporaryPath).catch((error) => { if (error.code !== "ENOENT") throw error; });
    await unlink(lockPath);
  }
}
