/**
 * SurveyRegistry 시트 → data/sheet-registry.json 동기화 (GitHub Actions용)
 */
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const configPath = join(repoRoot, "data", "survey-config.json");
const outPath = join(repoRoot, "data", "sheet-registry.json");

function loadConfig() {
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
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
  if (!rows.length) return [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const id = String(row[0] || "").trim();
    if (!id) continue;
    const entry = {
      id,
      label: row[1] || "",
      url: row[2] || "",
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

const config = loadConfig();
const spreadsheetId =
  String(config.responseSpreadsheetId || "").trim() ||
  "1oH3Er_9UF_A6HDQEK_1KjFxp54M_JJrU";
const url =
  "https://docs.google.com/spreadsheets/d/" +
  encodeURIComponent(spreadsheetId) +
  "/gviz/tq?tqx=out:json&sheet=" +
  encodeURIComponent("SurveyRegistry");

const res = await fetch(url);
if (!res.ok) {
  console.error("Failed to fetch SurveyRegistry:", res.status);
  process.exit(1);
}
const text = await res.text();
const rows = gvizToRows(parseGviz(text));
const registry = rowsToRegistry(rows);

if (!registry.length) {
  console.log("SurveyRegistry is empty — sheet-registry.json not updated.");
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
