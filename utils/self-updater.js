const fs = require("fs");
const path = require("path");

const PATCH_DIR = path.join(__dirname, "../../self-patches");
const APPLIED_DIR = path.join(__dirname, "../../applied-patches");
const LOG_FILE = path.join(__dirname, "../../self-patch-history.json");

function ensureDirectories() {
  if (!fs.existsSync(APPLIED_DIR)) fs.mkdirSync(APPLIED_DIR);
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, "[]", "utf8");
  if (!fs.existsSync(PATCH_DIR)) {
    console.warn(" Patch directory not found. Skipping self-update.");
    return false;
  }
  return true;
}

function loadPatch(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(" Failed to parse patch file:", filePath, err.message);
    return null;
  }
}

function applyPatch(patch) {
  const filePath = path.join(__dirname, patch.targetFile);
  if (!fs.existsSync(filePath)) {
    console.warn(" Target file does not exist:", filePath);
    return false;
  }

  try {
    const original = fs.readFileSync(filePath, "utf8");
    const timestamp = Date.now();
    const backupPath = filePath + ".bak." + timestamp;

    fs.writeFileSync(backupPath, original, "utf8");
    const newContent = original + `\n\n// 🔧 Patch by AI @ ${patch.timestamp}\n// ${patch.context}\n// ${patch.suggestion}\n` + patch.proposedPatch;
    fs.writeFileSync(filePath, newContent, "utf8");
    return true;
  } catch (err) {
    console.error(" Failed to apply patch to:", patch.targetFile, err.message);
    return false;
  }
}

function logPatch(patch) {
  const history = JSON.parse(fs.readFileSync(LOG_FILE, "utf8"));
  history.push({ ...patch, appliedAt: new Date().toISOString() });
  fs.writeFileSync(LOG_FILE, JSON.stringify(history, null, 2), "utf8");
}

function run() {
  if (!ensureDirectories()) return;

  const files = fs.readdirSync(PATCH_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("ℹNo new patches to apply.");
    return;
  }

  files.forEach(file => {
    const filePath = path.join(PATCH_DIR, file);
    const patch = loadPatch(filePath);
    if (!patch) return;

    const approvedFiles = ["intent-ai.js", "server.js"];
    if (!approvedFiles.includes(patch.targetFile)) {
      console.warn(`Skipping patch for disallowed file: ${patch.targetFile}`);
      return;
    }

    const applied = applyPatch(patch);
    if (applied) {
      logPatch(patch);
      fs.renameSync(filePath, path.join(APPLIED_DIR, file));
      console.log(" AI patch applied:", patch.targetFile);
    }
  });
}

module.exports = { run };
