/**
 * SurveyRegistry → data/sheet-registry.json 동기화 (GitHub Actions용)
 * 1) Apps Script listRegistry (우선)
 * 2) gviz SurveyRegistry 탭 (헤더·ID 검증)
 */
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const configPath = join(repoRoot, "data", "survey-config.json");
const outPath = join(repoRoot, "data", "sheet-registry.json");

const REGISTRY_ID_RE = /^[a-zA-Z0-9_-]{20,60}$/;

function loadConfig() {
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

function isRegistrySheetHeaderRow(row) {
  if (!row || !row.length) return false;
  const h0 = String(row[0] || "").trim().toLowerCase();
  return h0 === "id" || h0 === "surveyid" || h0 === "sheetid";
}

function isRegistrySpreadsheetId(id) {
  return REGISTRY_ID_RE.test(String(id || "").trim());
}

function parseGviz(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("gviz parse failed");
  return JSON.parse(text.slice(start, end + 1));
}

function gvizToRows(gviz) {
  const table = gviz && gviz.table;
  if (!table || !table.cols || !table.rows) return [];
  const cols = table.cols.length;
  return table.rows.map((row) => {
    const cells = [];
    for (let i = 0; i < cols; i++) {
      const c = row.c && row.c[i];
      cells.push(c && c.v != null ? c.v : "");
    }
    return cells;
  });
}

function rowsToRegistry(rows) {
  if (!rows.length || !isRegistrySheetHeaderRow(rows[0])) return [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[0] || "").trim();
    if (!id || !isRegistrySpreadsheetId(id)) continue;
    const url = String(row[2] || "").trim();
    if (!url.includes("spreadsheets/d/")) continue;
    const entry = {
      id,
      label: row[1] || "",
      url,
      viewMode: String(row[3] || "class"),
      resultsLayout: String(row[4] || row[3] || "class"),
      categorySelectAll:
        row[5] === false ||
        row[5] === 0 ||
        String(row[5]).toLowerCase() === "false" ||
        String(row[5]).toLowerCase() === "0"
          ? false
          : true,
      updatedAt: Number(row[6]) || 0,
      registeredAt: Number(row[7]) || 0,
      surveyStatus: String(row[8] || "active"),
      sourceType: "sheet",
      visibility: "public",
    };
    const metaRaw = row[9];
    if (metaRaw) {
      try {
        const meta =
          typeof metaRaw === "string" ? JSON.parse(metaRaw) : metaRaw;
        if (meta && typeof meta === "object") {
          if (meta.tab) entry.tab = meta.tab;
          if (meta.categories) entry.categories = meta.categories;
          if (meta.classes) entry.classes = meta.classes;
          if (meta.listOrder != null && Number.isFinite(Number(meta.listOrder))) {
            entry.listOrder = Number(meta.listOrder);
          }
          if (meta.orderUpdatedAt != null) {
            entry.orderUpdatedAt = Number(meta.orderUpdatedAt) || 0;
          }
          if (meta.labelUpdatedAt != null) {
            entry.labelUpdatedAt = Number(meta.labelUpdatedAt) || 0;
          }
        }
      } catch {
        /* ignore */
      }
    }
    out.push(entry);
  }
  return out;
}

function normalizeWebAppRegistry(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((entry) => entry && isRegistrySpreadsheetId(entry.id))
    .map((entry) => ({
      id: entry.id,
      label: entry.label || "",
      url: entry.url || "",
      viewMode: entry.viewMode || entry.resultsLayout || "class",
      resultsLayout: entry.resultsLayout || entry.viewMode || "class",
      categorySelectAll: entry.categorySelectAll !== false,
      updatedAt: Number(entry.updatedAt) || 0,
      registeredAt: Number(entry.registeredAt) || 0,
      surveyStatus: entry.surveyStatus || "active",
      sourceType: "sheet",
      visibility: "public",
      ...(entry.listOrder != null ? { listOrder: Number(entry.listOrder) } : {}),
      ...(entry.orderUpdatedAt != null
        ? { orderUpdatedAt: Number(entry.orderUpdatedAt) || 0 }
        : {}),
      ...(entry.labelUpdatedAt != null
        ? { labelUpdatedAt: Number(entry.labelUpdatedAt) || 0 }
        : {}),
      ...(Array.isArray(entry.categories) ? { categories: entry.categories } : {}),
      ...(Array.isArray(entry.classes) ? { classes: entry.classes } : {}),
      ...(entry.tab ? { tab: entry.tab } : {}),
    }))
    .filter((entry) => entry.url.includes("spreadsheets/d/"));
}

async function fetchRegistryFromWebApp(webAppUrl) {
  const listUrl =
    webAppUrl +
    (webAppUrl.includes("?") ? "&" : "?") +
    "action=listRegistry";
  const res = await fetch(listUrl, { redirect: "follow" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data || data.ok === false || !Array.isArray(data.registry)) return [];
  return normalizeWebAppRegistry(data.registry);
}

async function fetchRegistryFromGviz(spreadsheetId) {
  const url =
    "https://docs.google.com/spreadsheets/d/" +
    encodeURIComponent(spreadsheetId) +
    "/gviz/tq?tqx=out:json&sheet=" +
    encodeURIComponent("SurveyRegistry");
  const res = await fetch(url);
  if (!res.ok) throw new Error("gviz fetch failed: " + res.status);
  const text = await res.text();
  const rows = gvizToRows(parseGviz(text));
  return rowsToRegistry(rows);
}

const config = loadConfig();
const spreadsheetId =
  String(config.responseSpreadsheetId || "").trim() ||
  "1oH3Er_9UF_A6HDQEK_1KjFxp54M_JJrU";
const webAppUrl = String(config.webAppUrl || "").trim();

let registry = [];
if (webAppUrl.includes("script.google.com") && /\/exec/.test(webAppUrl)) {
  try {
    registry = await fetchRegistryFromWebApp(webAppUrl);
    if (registry.length) {
      console.log("Loaded " + registry.length + " entries from web app.");
    }
  } catch (err) {
    console.warn("Web app listRegistry failed:", err.message || err);
  }
}

if (!registry.length) {
  try {
    registry = await fetchRegistryFromGviz(spreadsheetId);
    if (registry.length) {
      console.log("Loaded " + registry.length + " entries from gviz.");
    }
  } catch (err) {
    console.warn("gviz SurveyRegistry failed:", err.message || err);
  }
}

if (!registry.length) {
  console.log(
    "SurveyRegistry가 비어 있거나 잘못된 시트입니다 — sheet-registry.json 유지."
  );
  process.exit(0);
}

const json = JSON.stringify(registry, null, 2) + "\n";
const prev = readFileSync(outPath, "utf8");
if (prev === json) {
  console.log("sheet-registry.json already up to date.");
  process.exit(0);
}
writeFileSync(outPath, json, "utf8");
console.log("Updated sheet-registry.json (" + registry.length + " entries).");
