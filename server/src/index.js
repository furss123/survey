/**
 * Express API: Google 시트 URL → 상담 분석
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { parseSpreadsheetId } from "./parseUrl.js";
import { fetchAllSheetValues } from "./sheetsClient.js";
import { analyzeAllSheets } from "./analyze.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "namak2026-counseling" });
});

/**
 * POST /api/analyze
 * Body: { url: string }
 */
app.post("/api/analyze", async (req, res) => {
  try {
    const { url } = req.body ?? {};
    const spreadsheetId = parseSpreadsheetId(url);
    const { sheets, source } = await fetchAllSheetValues(spreadsheetId);
    const hasAnyData = sheets.some((s) => s.values?.length);
    if (!hasAnyData) {
      throw new Error(
        "시트에 데이터가 없습니다. 공개 공유 설정을 확인하세요."
      );
    }

    const multi = analyzeAllSheets(sheets);

    const first = multi.sheets[0] ?? multi.combined;

    res.json({
      ok: true,
      spreadsheetId,
      source,
      sheetCount: multi.sheetsMeta.total,
      sheetsMeta: multi.sheetsMeta,
      sheets: multi.sheets,
      activeSheet: first.sheetName,
      ...first,
    });
  } catch (err) {
    console.error("[analyze]", err.message);
    res.status(400).json({
      ok: false,
      error: err.message || "시트를 분석하지 못했습니다.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`상담 분석 API: http://localhost:${PORT}`);
});
