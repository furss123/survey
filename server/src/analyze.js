/**
 * Google 시트 데이터 → 상담 분석 요약
 */

import groupBy from "lodash/groupBy.js";
import sumBy from "lodash/sumBy.js";
import {
  extractCommonThemes,
  isProfileSheetFormat,
  normalizeProfileSheet,
} from "./profileParse.js";

const CLASS_ALIASES = ["반", "class", "학급", "클래스", "반명"];
const NUMBER_ALIASES = ["번호", "number", "no", "no.", "학번", "순번"];
const NAME_ALIASES = ["이름", "name", "성명", "학생"];
const COMPLETION_ALIASES = [
  "완료",
  "제출",
  "응답",
  "status",
  "상태",
  "completed",
  "done",
  "체크",
];
const CONTENT_ALIASES = [
  "상담",
  "내용",
  "응답",
  "메모",
  "비고",
  "고민",
  "주제",
  "프로필",
  "기록",
  "comment",
  "note",
];

const THEME_KEYWORDS = [
  { key: "진로", label: "진로·진학" },
  { key: "친구", label: "대인관계" },
  { key: "가족", label: "가정" },
  { key: "스트레스", label: "스트레스·정서" },
  { key: "학습", label: "학습" },
  { key: "건강", label: "건강" },
  { key: "또래", label: "또래 관계" },
  { key: "불안", label: "불안" },
];

function normalizeHeader(cell) {
  return String(cell ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function findColumnIndex(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const key = normalizeHeader(alias);
    const idx = normalized.findIndex((h) => h === key || h.includes(key));
    if (idx >= 0) return idx;
  }
  return -1;
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function coerceText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isCompletedValue(value) {
  const v = coerceText(value).toLowerCase();
  if (!v) return false;
  if (
    [
      "y",
      "yes",
      "true",
      "1",
      "o",
      "완료",
      "제출",
      "응답완료",
      "done",
      "complete",
      "completed",
      "✓",
      "v",
    ].includes(v)
  ) {
    return true;
  }
  return v.includes("완료") || v.includes("제출");
}

/**
 * @param {string[][]} rawValues
 */
export function analyzeSheetData(rawValues) {
  if (!rawValues?.length) {
    return emptyAnalysis();
  }

  if (isProfileSheetFormat(rawValues)) {
    const profile = normalizeProfileSheet(rawValues);
    return buildAnalysisPayload(profile.headers, profile.rows, {
      ...profile.meta,
      format: "profile",
    });
  }

  const headerRow = rawValues[0].map(coerceText);
  const dataRows = rawValues.slice(1).filter((row) =>
    row.some((cell) => coerceText(cell) !== "")
  );

  let classIdx = findColumnIndex(headerRow, CLASS_ALIASES);
  let numberIdx = findColumnIndex(headerRow, NUMBER_ALIASES);
  let nameIdx = findColumnIndex(headerRow, NAME_ALIASES);
  let completionIdx = findColumnIndex(headerRow, COMPLETION_ALIASES);

  if (classIdx < 0 && headerRow.length > 0) classIdx = 0;
  if (numberIdx < 0 && headerRow.length > 1) numberIdx = 1;

  const rows = dataRows.map((raw, rowIndex) => {
    const cells = headerRow.map((_, i) => coerceText(raw[i]));
    const classVal = coerceText(raw[classIdx]);
    const numberVal = coerceNumber(raw[numberIdx]);
    const nameVal = nameIdx >= 0 ? coerceText(raw[nameIdx]) : "";
    const completionRaw =
      completionIdx >= 0
        ? raw[completionIdx]
        : inferCompletionFromRow(cells, classIdx, numberIdx, nameIdx);

    const contentPreview = pickContentPreview(headerRow, cells);

    return {
      id: rowIndex + 1,
      반: classVal || "(미입력)",
      번호: numberVal,
      이름: nameVal,
      완료: isCompletedValue(completionRaw),
      미리보기: contentPreview,
      _raw: Object.fromEntries(
        headerRow.map((h, i) => [h || `col_${i}`, cells[i]])
      ),
    };
  });

  return buildAnalysisPayload(headerRow, rows, {
    classColumn: headerRow[classIdx] ?? "반",
    numberColumn: headerRow[numberIdx] ?? "번호",
    nameColumn: nameIdx >= 0 ? headerRow[nameIdx] : null,
    completionColumn:
      completionIdx >= 0 ? headerRow[completionIdx] : "(자동 추론)",
    format: "table",
  });
}

function inferCompletionFromRow(cells, ...skipIndices) {
  const skip = new Set(skipIndices);
  return cells.some((c, i) => !skip.has(i) && isCompletedValue(c));
}

function pickContentPreview(headers, cells) {
  const contentIdx = findColumnIndex(headers, CONTENT_ALIASES);
  if (contentIdx >= 0) {
    const text = cells[contentIdx];
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  }
  const longest = cells
    .filter((c) => c.length > 8)
    .sort((a, b) => b.length - a.length)[0];
  if (!longest) return "";
  return longest.length > 120 ? `${longest.slice(0, 120)}…` : longest;
}

function buildAnalysisPayload(headers, rows, meta) {
  const grouped = groupBy(rows, (r) => r.반);
  const total = rows.length;
  const completed = sumBy(rows, (r) => (r.완료 ? 1 : 0));
  const withNumber = rows.filter((r) => r.번호 !== null).length;
  const withName = rows.filter((r) => r.이름).length;
  const missingClass = rows.filter((r) => r.반 === "(미입력)").length;

  const byClass = Object.entries(grouped)
    .map(([className, classRows]) => {
      const classTotal = classRows.length;
      const classCompleted = sumBy(classRows, (r) => (r.완료 ? 1 : 0));
      return {
        반: className,
        인원: classTotal,
        완료: classCompleted,
        완료율: classTotal
          ? Math.round((classCompleted / classTotal) * 1000) / 10
          : 0,
      };
    })
    .sort((a, b) => String(a.반).localeCompare(String(b.반), "ko"));

  const columnInsights = buildColumnInsights(headers, rows);
  const themes = detectThemes(rows);
  const commonThemes =
    meta.format === "profile" ? extractCommonThemes(rows) : [];

  return {
    summary: {
      총응답: total,
      완료건수: completed,
      완료율: total ? Math.round((completed / total) * 1000) / 10 : 0,
      학급수: Object.keys(grouped).length,
      번호입력: withNumber,
      이름입력: withName,
      반미입력: missingClass,
    },
    byClass,
    columnInsights,
    themes,
    commonThemes,
    headers,
    rows,
    meta: {
      ...meta,
      totalRows: total,
      classCount: Object.keys(grouped).length,
    },
  };
}

function buildColumnInsights(headers, rows) {
  if (!headers?.length || !rows.length) return [];

  return headers
    .map((name, colIdx) => {
      const filled = rows.filter((r) => {
        const val = Object.values(r._raw || {})[colIdx];
        return coerceText(val) !== "";
      }).length;
      const isContent = CONTENT_ALIASES.some((a) =>
        normalizeHeader(name).includes(normalizeHeader(a))
      );
      return {
        열: name || `열${colIdx + 1}`,
        입력건수: filled,
        입력률: rows.length
          ? Math.round((filled / rows.length) * 1000) / 10
          : 0,
        상담내용열: isContent,
      };
    })
    .filter((c) => c.입력건수 > 0)
    .sort((a, b) => b.입력건수 - a.입력건수)
    .slice(0, 8);
}

function detectThemes(rows) {
  const corpus = rows
    .map((r) => {
      const raw = r._raw || {};
      return Object.values(raw).join(" ");
    })
    .join(" ")
    .toLowerCase();

  const hits = THEME_KEYWORDS.map(({ key, label }) => {
    const regex = new RegExp(key, "gi");
    const count = (corpus.match(regex) || []).length;
    return { 주제: label, 언급수: count };
  }).filter((t) => t.언급수 > 0);

  hits.sort((a, b) => b.언급수 - a.언급수);
  return hits.slice(0, 6);
}

function emptyAnalysis() {
  return {
    summary: {
      총응답: 0,
      완료건수: 0,
      완료율: 0,
      학급수: 0,
      번호입력: 0,
      이름입력: 0,
      반미입력: 0,
    },
    byClass: [],
    columnInsights: [],
    themes: [],
    headers: [],
    rows: [],
    meta: { format: "empty" },
  };
}

/**
 * 여러 시트 탭을 각각 분석하고 전체 합산 결과를 반환합니다.
 * @param {{ sheetName: string, values: string[][] }[]} sheetInputs
 */
export function analyzeAllSheets(sheetInputs) {
  const sheetAnalyses = (sheetInputs || []).map(({ sheetName, values }) => {
    const analysis = analyzeSheetData(values);
    return {
      sheetName,
      ...analysis,
      meta: { ...analysis.meta, sheetName },
    };
  });

  const allRows = sheetAnalyses.flatMap((sheet) =>
    sheet.rows.map((row) => ({ ...row, 시트: sheet.sheetName }))
  );

  const combined = buildAnalysisPayload(
    sheetAnalyses[0]?.headers || [],
    allRows,
    {
      format: "multi",
      sheetCount: sheetAnalyses.length,
      sheetNames: sheetAnalyses.map((s) => s.sheetName),
    }
  );

  const withData = sheetAnalyses.filter((s) => s.summary.총응답 > 0);

  return {
    sheets: sheetAnalyses,
    combined,
    sheetsMeta: {
      total: sheetInputs.length,
      recognized: withData.length,
      names: sheetAnalyses.map((s) => s.sheetName),
      perSheet: sheetAnalyses.map((s) => ({
        name: s.sheetName,
        rows: s.summary.총응답,
      })),
    },
  };
}
