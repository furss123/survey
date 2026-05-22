/**
 * 시트 탭 선택 UI (캐시된 시트별 분석 결과 전환)
 */

export default function SheetTabs({
  sheetCount,
  sheets,
  activeSheet,
  onSelect,
}) {
  if (!sheets?.length) return null;

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
        <strong>시트 {sheetCount}개 인식됨</strong>
      </p>
      <p className="text-xs text-slate-500">시트 탭 ({sheetCount}개)</p>
      <div className="flex flex-wrap gap-2" role="tablist">
        {sheets.map((sheet) => {
          const active = sheet.sheetName === activeSheet;
          return (
            <button
              key={sheet.sheetName}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(sheet.sheetName)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                active
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:border-teal-500 hover:text-teal-700"
              }`}
            >
              {sheet.sheetName}
              <span className="ml-1.5 font-normal opacity-90">
                {sheet.summary?.총응답 ?? 0}건
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-sm text-slate-700">
        선택: <strong>{activeSheet}</strong>
      </p>
    </div>
  );
}
