/**
 * 상담 분석 결과: 학생별 카드 목록
 */

function StudentResponseHeader({ row }) {
  const classLabel = row.반 && row.반 !== "(미입력)" ? row.반 : "";
  const numLabel = row.번호 != null ? `${row.번호}번` : "";
  const nameLabel = row.이름 || row._raw?.이름 || "";
  if (!classLabel && !numLabel && !nameLabel) return null;
  return (
    <header className="student-response-header mb-3 flex shrink-0 flex-row flex-wrap items-start justify-between gap-2 border-b-2 border-slate-200 pb-3 font-semibold">
      <div className="header-meta flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        {classLabel ? (
          <span className="student-class text-[0.9375rem] font-bold text-teal-800">
            {classLabel}
          </span>
        ) : null}
        {numLabel ? (
          <span className="student-num text-sm font-semibold text-slate-600">
            {numLabel}
          </span>
        ) : null}
        {nameLabel ? (
          <span className="student-name text-lg font-extrabold tracking-tight text-slate-900">
            {nameLabel}
          </span>
        ) : null}
      </div>
      {row.완료 ? (
        <span className="status-badge shrink-0 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800">
          완료
        </span>
      ) : row.완료 === false ? (
        <span className="status-badge shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-400">
          미완료
        </span>
      ) : null}
    </header>
  );
}

function CategoryBlocks({ row }) {
  const items =
    row.categoryList?.length > 0
      ? row.categoryList.map((item) => ({
          title: item.label,
          body: item.value,
          fields: [],
        }))
      : (row.sections || []).filter(
          (sec) =>
            sec &&
            (sec.body?.trim() ||
              sec.fields?.length ||
              (sec.title && !/^[\s💌📚📖📝✏️🎯⭐🔖•\-]+$/.test(sec.title)))
        );

  if (!items.length) {
    return <p className="text-sm text-slate-400">분류할 내용 없음</p>;
  }

  return (
    <div className="category-blocks flex flex-col gap-2.5">
      {items.map((sec, idx) => (
        <div
          key={`${sec.title || "sec"}-${idx}`}
          className="category-block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
        >
          {sec.title ? (
            <p className="cat-title text-xs font-bold leading-snug text-teal-700">
              {sec.title}
            </p>
          ) : null}
          {sec.body ? (
            <p className="cat-body mt-1 whitespace-pre-wrap text-sm text-slate-700">
              {sec.body.length > 400
                ? `${sec.body.slice(0, 400).trim()}…`
                : sec.body}
            </p>
          ) : null}
          {sec.fields?.map((f) => (
            <p key={f.key} className="cat-field mt-1 text-sm text-slate-700">
              <span className="font-semibold text-slate-600">{f.key}</span>{" "}
              {f.value}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function StudentCard({ row, hasCategories }) {
  return (
    <article className="student-card flex flex-col items-stretch rounded-2xl border border-slate-200 bg-white px-4 pt-4 shadow-md sm:px-5 sm:pt-5">
      <StudentResponseHeader row={row} />
      <div className="student-response-body flex-1 pb-3.5">
        {hasCategories ? (
          <CategoryBlocks row={row} />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
            {row.미리보기 || row._raw?.미리보기 || "—"}
          </p>
        )}
      </div>
      <hr
        className="student-card-divider m-0 h-0 border-0 border-t-2 border-slate-200 last:border-slate-100"
        aria-hidden="true"
      />
    </article>
  );
}

export default function AnalysisResult({ data, sheetName, multiSheet }) {
  if (!data) return null;

  const { summary, rows, meta } = data;
  const isProfile = meta?.format === "profile";
  const hasCategories =
    isProfile || rows?.some((r) => r.sections?.length || r.categoryList?.length);

  if (!summary?.총응답) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
        {multiSheet && sheetName ? (
          <>
            <strong>{sheetName}</strong> 탭에 분석할 데이터가 없습니다.
          </>
        ) : (
          "이 탭에 분석할 데이터가 없습니다."
        )}
      </p>
    );
  }

  const list = rows?.slice(0, 50) ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">학생 응답</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {list.length}명 · 최대 50건 표시
        </p>
      </div>
      <div className="student-cards student-cards-list flex flex-col gap-5 [&>article:last-child_.student-card-divider]:border-slate-100">
        {list.map((row) => (
          <StudentCard key={row.id} row={row} hasCategories={hasCategories} />
        ))}
      </div>
    </div>
  );
}
