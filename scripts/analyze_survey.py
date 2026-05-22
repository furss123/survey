#!/usr/bin/env python3
"""
SMART 진로·학습 설문 CSV/Excel 자동 분석.
Google Forms 보내기 파일 → 반별 분류 + 전공 계열 Excel/Markdown 리포트.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

INVALID_STUDENT_VALUES = {"0", "d", "D", "", "nan", "none", "null", "테스트"}
CLASS_NAME_RE = re.compile(r"(\d+)\s*반")
NUM_NAME_RE = re.compile(r"^(\d+)\s+(.+)$")

# Google Forms 보내기 기본: 1행=카테고리(헤더), B열=학번, C열=이름
SURVEY_HEADER_ROW_INDEX = 0
SURVEY_COL_STUDENT_ID = 1
SURVEY_COL_NAME = 2


def detect_column_type(column_name: str) -> str:
    name = str(column_name).strip().lower()
    keywords = {
        "timestamp": ["타임스탬프", "timestamp", "제출", "submitted"],
        "student_id": ["학번", "student_id", "학생번호"],
        "name": ["이름", "name"],
        "major_field": ["전공 계열", "계열은", "최적화된 대학", "대학교 전공"],
        "major_detail": ["집중하고 싶은 전공", "중분류"],
        "college": ["단과대학", "학부군", "대분류 내에서", "단과대"],
        "class": ["반 선택", "반을 선택", "반을 고르"],
        "student_selector": ["번호와 이름을 선택", "번호와 이름"],
    }
    for col_type, keys in keywords.items():
        if any(k in name for k in keys):
            return col_type
    return "unknown"


def parse_student_id(student_id: str | Any) -> tuple[int | None, int | None, int | None]:
    """4자리 학번: 학년(1)+반(1)+번호(2). 예) 1101→1학년1반1번, 1320→1학년3반20번."""
    s = str(student_id).strip()
    if not s or s.lower() in INVALID_STUDENT_VALUES:
        return None, None, None
    cleaned = s.replace(",", "")
    try:
        num = float(cleaned)
        if num >= 0 and num == int(num):
            cleaned = str(int(num))
    except ValueError:
        pass
    digits = re.sub(r"\D", "", cleaned)
    if len(digits) == 4:
        return int(digits[0]), int(digits[1]), int(digits[2:])
    if len(digits) == 5:
        return int(digits[0]), int(digits[1:3]), int(digits[3:])
    if len(digits) == 3:
        return 1, int(digits[0]), int(digits[1:])
    return None, None, None


def parse_class_value(value: Any) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    if not text or text.lower() in INVALID_STUDENT_VALUES:
        return None
    m = CLASS_NAME_RE.search(text)
    if m:
        return int(m.group(1))
    if text.isdigit():
        return int(text)
    return None


def parse_num_name(value: Any) -> tuple[int | None, str | None]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None, None
    text = str(value).strip()
    if not text:
        return None, None
    m = NUM_NAME_RE.match(text)
    if m:
        return int(m.group(1)), m.group(2).strip()
    if text.isdigit():
        return int(text), None
    return None, text


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    text = str(value).strip()
    return not text or text.lower() in INVALID_STUDENT_VALUES


def collect_values(row: pd.Series, columns: list[str], split_commas: bool = True) -> list[str]:
    items: list[str] = []
    seen: set[str] = set()
    for col in columns:
        val = row.get(col)
        if is_empty(val):
            continue
        parts = [str(val).strip()]
        if split_commas:
            parts = []
            for chunk in str(val).split(","):
                chunk = chunk.strip()
                if chunk:
                    parts.append(chunk)
        for part in parts:
            if part and part not in seen:
                seen.add(part)
                items.append(part)
    return items


def classify_columns(df: pd.DataFrame) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {
        "timestamp": [],
        "student_id": [],
        "name": [],
        "major_field": [],
        "major_detail": [],
        "college": [],
        "class": [],
        "student_selector": [],
        "category": [],
    }
    for col in df.columns:
        col_type = detect_column_type(col)
        if col_type in groups:
            groups[col_type].append(col)
    return groups


def resolve_survey_columns(df: pd.DataFrame) -> dict[str, list[str]]:
    """키워드 탐지 + 기본 B=학번, C=이름 위치 적용."""
    cols = classify_columns(df)
    columns = list(df.columns)
    if len(columns) > SURVEY_COL_STUDENT_ID:
        col_b = columns[SURVEY_COL_STUDENT_ID]
        if col_b not in cols["student_id"]:
            cols["student_id"] = [col_b]
    if len(columns) > SURVEY_COL_NAME:
        col_c = columns[SURVEY_COL_NAME]
        if col_c not in cols["name"]:
            cols["name"] = [col_c]
    skip = set()
    for key in (
        "timestamp",
        "student_id",
        "name",
        "class",
        "student_selector",
        "major_field",
        "major_detail",
        "college",
    ):
        skip.update(cols.get(key) or [])
    cols["category"] = [c for c in columns if c not in skip]
    return cols


def extract_student_info(row: pd.Series, cols: dict[str, list[str]]) -> dict[str, Any]:
    ban: int | None = None
    num: int | None = None
    name: str | None = None

    if cols["student_id"]:
        sid = row.get(cols["student_id"][0])
        if not is_empty(sid):
            _grade, ban, num = parse_student_id(sid)

    if cols["name"]:
        nval = row.get(cols["name"][0])
        if not is_empty(nval):
            name = str(nval).strip()

    if cols["class"]:
        ban = ban or parse_class_value(row.get(cols["class"][0]))

    for sel_col in cols["student_selector"]:
        n, nm = parse_num_name(row.get(sel_col))
        if n is not None:
            num = num or n
        if nm and not name:
            name = nm

    if ban is None and cols["student_id"]:
        sid = row.get(cols["student_id"][0])
        if not is_empty(sid):
            grade, ban, num = parse_student_id(sid)

    return {"반": ban, "번호": num, "이름": name or "미확인"}


def row_is_invalid(student: dict[str, Any], cols: dict[str, list[str]], row: pd.Series) -> bool:
    if cols["student_id"]:
        sid = row.get(cols["student_id"][0])
        if str(sid).strip().lower() in INVALID_STUDENT_VALUES:
            return True
    if cols["name"]:
        nm = row.get(cols["name"][0])
        if str(nm).strip().lower() in INVALID_STUDENT_VALUES:
            return True
    if student["반"] is None and student["번호"] is None and student["이름"] in ("미확인", ""):
        return True
    return False


def parse_timestamp(row: pd.Series, ts_cols: list[str]) -> datetime | None:
    if not ts_cols:
        return None
    val = row.get(ts_cols[0])
    if is_empty(val):
        return None
    try:
        return pd.to_datetime(val).to_pydatetime()
    except Exception:
        return None


def build_records(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
    cols = resolve_survey_columns(df)
    records: list[dict[str, Any]] = []
    skipped = 0

    for _, row in df.iterrows():
        student = extract_student_info(row, cols)
        if row_is_invalid(student, cols, row):
            skipped += 1
            continue

        majors = collect_values(row, cols["major_detail"])
        if not majors:
            majors = collect_values(row, cols["category"])
        colleges = collect_values(row, cols["college"])
        major_field = ""
        if cols["major_field"]:
            v = row.get(cols["major_field"][0])
            if not is_empty(v):
                major_field = str(v).strip()

        records.append(
            {
                "반": student["반"],
                "번호": student["번호"],
                "이름": student["이름"],
                "대분류": major_field or "응답 없음",
                "희망전공(상세)": ", ".join(majors) if majors else "미정",
                "단과대/학부군": ", ".join(colleges) if colleges else "미정",
                "_ts": parse_timestamp(row, cols["timestamp"]),
                "_key": (
                    student["반"],
                    student["번호"],
                    student["이름"],
                ),
            }
        )

    meta: dict[str, Any] = {"skipped": skipped, "warnings": [], "duplicates": 0}
    if not records:
        return pd.DataFrame(), meta

    rdf = pd.DataFrame(records)
    dup_groups = rdf.groupby("_key", dropna=False)
    kept_rows = []
    for key, group in dup_groups:
        if len(group) > 1:
            meta["duplicates"] += len(group) - 1
            g = group.copy()
            g["_ts_sort"] = g["_ts"].apply(lambda t: t or datetime.min)
            best = g.sort_values("_ts_sort", ascending=False).iloc[0]
            ban, num, name = key
            meta["warnings"].append(
                f"중복 응답 발견: {name} ({ban}반 {num}번) - 최신 응답 유지"
            )
            kept_rows.append(best)
        else:
            kept_rows.append(group.iloc[0])

    out = pd.DataFrame(kept_rows).drop(columns=["_ts", "_key"], errors="ignore")
    out = out.sort_values(by=["반", "번호"], na_position="last")
    return out, meta


def class_label(ban: Any) -> str:
    if ban is None or (isinstance(ban, float) and pd.isna(ban)):
        return "미확인"
    return f"{int(ban)}반"


def write_excel(df: pd.DataFrame, path: Path) -> None:
    export = df.copy()
    export["반"] = export["반"].apply(class_label)
    with pd.ExcelWriter(path, engine="openpyxl") as writer:
        export.to_excel(writer, sheet_name="전체_요약", index=False)
        for ban in sorted(export["반"].unique(), key=lambda x: (x == "미확인", x)):
            sheet = str(ban).replace("/", "-")[:31]
            export[export["반"] == ban].to_excel(writer, sheet_name=sheet, index=False)


def top_counter(series: pd.Series, n: int = 10) -> list[tuple[str, int]]:
    counter: Counter[str] = Counter()
    for val in series:
        if not val or val in ("미정", "응답 없음"):
            continue
        for item in str(val).split(","):
            item = item.strip()
            if item:
                counter[item] += 1
    return counter.most_common(n)


def build_markdown_report(df: pd.DataFrame, meta: dict[str, Any], source: Path) -> str:
    lines = [
        "# SMART 진로·학습 설문 분석 리포트",
        "",
        f"- 생성 시각: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"- 원본 파일: `{source.name}`",
        f"- 분석 학생 수: **{len(df)}**명",
        "",
    ]

    if meta.get("warnings"):
        lines.append("## ⚠️ 경고")
        for w in meta["warnings"][:20]:
            lines.append(f"- {w}")
        if len(meta["warnings"]) > 20:
            lines.append(f"- … 외 {len(meta['warnings']) - 20}건")
        lines.append("")

    lines.append("## 📈 전체 분석")
    field_counts = df["대분류"].value_counts()
    total = max(len(df), 1)
    lines.append("### 대분류별 인원")
    for field, count in field_counts.items():
        pct = round(100 * count / total, 1)
        lines.append(f"- {field}: **{count}**명 ({pct}%)")
    lines.append("")

    lines.append("### 단과대/학부군 선호 순위")
    for rank, (name, count) in enumerate(top_counter(df["단과대/학부군"], 15), 1):
        lines.append(f"{rank}. {name} ({count}명)")
    lines.append("")

    lines.append("### 희망 전공 Top 10")
    for rank, (name, count) in enumerate(top_counter(df["희망전공(상세)"], 10), 1):
        lines.append(f"{rank}. {name} ({count}명)")
    lines.append("")

    lines.append("## 📋 반별 분석")
    for ban in sorted(df["반"].dropna().unique()):
        sub = df[df["반"] == ban].sort_values("번호", na_position="last")
        label = class_label(ban)
        lines.append(f"### {label}")
        lines.append(f"- 총 응답 학생: **{len(sub)}**명")
        dist = sub["대분류"].value_counts()
        dist_txt = " | ".join(f"{k} {v}명" for k, v in dist.items())
        lines.append(f"- 대분류 분포: {dist_txt or '—'}")
        lines.append("")
        lines.append("| 번호 | 이름 | 대분류 | 희망전공 |")
        lines.append("|------|------|--------|----------|")
        for _, r in sub.iterrows():
            num = "" if pd.isna(r["번호"]) else int(r["번호"])
            lines.append(
                f"| {num} | {r['이름']} | {r['대분류']} | {r['희망전공(상세)']} |"
            )
        lines.append("")

    unassigned = df[df["반"].isna()]
    if len(unassigned):
        lines.append("### 반 미확인")
        lines.append(f"- {len(unassigned)}명")
        lines.append("")

    return "\n".join(lines)


def load_input(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        for enc in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
            try:
                return pd.read_csv(path, encoding=enc)
            except UnicodeDecodeError:
                continue
        return pd.read_csv(path)
    if suffix in (".xlsx", ".xls"):
        return pd.read_excel(path)
    raise ValueError(f"지원하지 않는 형식: {suffix}")


def print_summary(df: pd.DataFrame, meta: dict[str, Any], excel_path: Path, report_path: Path | None) -> None:
    classes = sorted(
        {class_label(b) for b in df["반"].dropna().unique()},
        key=lambda x: (x == "미확인", x),
    )
    field_summary = df["대분류"].value_counts()
    print("🔍 파일 분석 중...")
    print(f"  - 유효 응답: {len(df)}명 (무효/테스트 {meta.get('skipped', 0)}행 제외)")
    print(f"  - 감지된 반: {classes}")
    if meta.get("warnings"):
        print("⚠️ 경고:")
        for w in meta["warnings"][:10]:
            print(f"  - {w}")
    print("✅ 분석 완료:")
    print("  - 대분류:", " | ".join(f"{k} {v}명" for k, v in field_summary.items()))
    print(f"  - Excel: {excel_path}")
    if report_path:
        print(f"  - 리포트: {report_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="SMART 진로 설문 CSV/Excel 분석")
    parser.add_argument("input", type=Path, help="설문 보내기 CSV 또는 Excel")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Excel 출력 경로 (기본: survey_result_YYYYMMDD.xlsx)",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Markdown 리포트 경로 (기본: 입력파일명_analysis.md)",
    )
    parser.add_argument("--no-report", action="store_true", help="Markdown 리포트 생략")
    args = parser.parse_args()

    if not args.input.exists():
        print(f"파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
        return 1

    raw = load_input(args.input)
    print(f"  - 총 행 수: {len(raw)}행")

    df, meta = build_records(raw)
    if df.empty:
        print("유효한 응답이 없습니다. 컬럼명·데이터 형식을 확인하세요.", file=sys.stderr)
        return 1

    stamp = datetime.now().strftime("%Y%m%d")
    out_xlsx = args.output or Path(f"survey_result_{stamp}.xlsx")
    report_path = None
    if not args.no_report:
        report_path = args.report or args.input.with_name(f"{args.input.stem}_analysis.md")

    write_excel(df, out_xlsx)
    if report_path:
        report_path.write_text(
            build_markdown_report(df, meta, args.input), encoding="utf-8"
        )

    print_summary(df, meta, out_xlsx, report_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
