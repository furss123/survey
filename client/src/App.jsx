/**
 * 상담 분석 MVP: Google Sheets URL 입력 → 조회 → 분석 결과
 */

import { useState, useMemo } from "react";
import { analyzeSheet } from "./api.js";
import AnalysisResult from "./components/AnalysisResult.jsx";
import SheetTabs from "./components/SheetTabs.jsx";

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [activeSheet, setActiveSheet] = useState(null);

  const activeAnalysis = useMemo(() => {
    if (!data?.sheets?.length) return data;
    const found = data.sheets.find((s) => s.sheetName === activeSheet);
    return found ?? data.sheets[0];
  }, [data, activeSheet]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setData(null);
    setActiveSheet(null);
    try {
      const result = await analyzeSheet(url);
      setData(result);
      setActiveSheet(result.activeSheet ?? result.sheets?.[0]?.sheetName ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            상담 분석
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Google 시트 주소를 입력하고 조회하면 상담·응답 데이터를 요약합니다.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <label className="block text-sm font-medium text-slate-700">
            Google Sheets URL
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "분석 중…" : "조회"}
            </button>
          </div>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {activeAnalysis?.meta && (
            <p className="mt-3 text-xs text-slate-500">
              데이터 출처: <strong>{data.source === "gviz" ? "공개 시트" : "API"}</strong>
              {data.sheetCount > 1 && activeSheet && (
                <>
                  {" "}
                  · 시트: <strong>{activeSheet}</strong>
                </>
              )}
              {activeAnalysis.meta.classColumn && (
                <>
                  {" "}
                  · 반: <strong>{activeAnalysis.meta.classColumn}</strong>
                </>
              )}
              {activeAnalysis.meta.numberColumn && (
                <>
                  {" "}
                  · 번호: <strong>{activeAnalysis.meta.numberColumn}</strong>
                </>
              )}
              {data.spreadsheetId && (
                <>
                  {" "}
                  · ID:{" "}
                  <code className="text-slate-600">{data.spreadsheetId}</code>
                </>
              )}
            </p>
          )}
        </form>

        {data?.sheets?.length > 1 && (
          <SheetTabs
            sheetCount={data.sheetCount ?? data.sheets.length}
            sheets={data.sheets}
            activeSheet={activeSheet}
            onSelect={setActiveSheet}
          />
        )}

        {activeAnalysis && (
          <AnalysisResult
            data={activeAnalysis}
            sheetName={activeSheet}
            multiSheet={data.sheets?.length > 1}
          />
        )}
      </main>
    </div>
  );
}
