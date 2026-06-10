/**
 * data/sheet-registry.json → Apps Script 웹앱 SurveyRegistry 시드
 * 사용: node scripts/seed-registry-via-webapp.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const configPath = join(repoRoot, "data", "survey-config.json");
const registryPath = join(repoRoot, "data", "sheet-registry.json");

const REGISTRY_ID_RE = /^[a-zA-Z0-9_-]{20,60}$/;

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function toSnapshot(entry) {
  if (!entry || !REGISTRY_ID_RE.test(String(entry.id || "").trim())) return null;
  const updatedAt = Number(entry.updatedAt) || Date.now();
  const snap = {
    id: entry.id,
    label: entry.label || "",
    url: entry.url || "",
    viewMode: entry.viewMode || entry.resultsLayout || "class",
    resultsLayout: entry.resultsLayout || entry.viewMode || "class",
    categorySelectAll: entry.categorySelectAll !== false,
    updatedAt,
    registeredAt: Number(entry.registeredAt) || updatedAt,
    surveyStatus: entry.surveyStatus || "active",
  };
  const meta = {};
  if (entry.tab) meta.tab = entry.tab;
  if (Array.isArray(entry.categories) && entry.categories.length) {
    meta.categories = entry.categories;
  }
  if (Array.isArray(entry.classes) && entry.classes.length) {
    meta.classes = entry.classes;
  }
  if (entry.listOrder != null && Number.isFinite(Number(entry.listOrder))) {
    meta.listOrder = Number(entry.listOrder);
  }
  if (entry.orderUpdatedAt != null) {
    meta.orderUpdatedAt = Number(entry.orderUpdatedAt) || 0;
  }
  if (entry.labelUpdatedAt != null) {
    meta.labelUpdatedAt = Number(entry.labelUpdatedAt) || 0;
  }
  if (Object.keys(meta).length) snap.metaJson = JSON.stringify(meta);
  return snap;
}

const config = loadJson(configPath);
const webAppUrl = String(config.webAppUrl || "").trim();
if (!webAppUrl.includes("script.google.com") || !/\/exec/.test(webAppUrl)) {
  console.error("data/survey-config.json에 유효한 webAppUrl이 필요합니다.");
  process.exit(1);
}

const registry = loadJson(registryPath);
if (!Array.isArray(registry) || !registry.length) {
  console.error("data/sheet-registry.json이 비어 있습니다.");
  process.exit(1);
}

let ok = 0;
let failed = 0;
for (const entry of registry) {
  const snap = toSnapshot(entry);
  if (!snap) continue;
  try {
    const res = await fetch(webAppUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "upsertRegistry", entry: snap }),
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      console.error("JSON 아님:", entry.id, text.slice(0, 120));
      failed++;
      continue;
    }
    if (!data || data.ok === false) {
      console.error("실패:", entry.id, (data && data.error) || "unknown");
      failed++;
      continue;
    }
    ok++;
    console.log("OK:", entry.label || entry.id);
  } catch (err) {
    console.error("오류:", entry.id, err.message || err);
    failed++;
  }
}

console.log(`완료: ${ok}건 성공, ${failed}건 실패`);
if (!ok) process.exit(1);
