/**

 * Parse student profile blobs (e.g. "[8반] [1] [고유정] 학생 프로필").

 */



const PROFILE_PATTERN = /\[(\d+)반\]\s*\[(\d+)\]\s*\[([^\]]+)\]/;

const PROFILE_HEADER_PATTERN =

  /^\[\d+반\]\s*\[\d+\]\s*\[[^\]]+\]\s*학생\s*프로필\s*/i;



const CATEGORY_DEFS = [

  {

    key: "선생님께 한마디",

    patterns: [/선생님께/, /전하는\s*한마디/, /💗/],

  },

  {

    key: "과목별 학습 설문",

    patterns: [/영역별/, /과목별/, /학습\s*설문/, /📚/, /과목\s*\d/],

  },

  { key: "공부 시작 시기", patterns: [/공부\s*시작\s*시기/] },

  { key: "공부 방법", patterns: [/공부\s*방법/] },

  {

    key: "시험 전 자신감",

    patterns: [/시험\s*전\s*자신감/, /자신감\s*[:：]/],

  },

];



const FIELD_LINES = [

  { key: "공부 시작 시기", re: /^공부\s*시작\s*시기\s*[:：]\s*(.*)$/i },

  { key: "공부 방법", re: /^공부\s*방법\s*[:：]\s*(.*)$/i },

  { key: "시험 전 자신감", re: /^시험\s*전\s*자신감\s*[:：]\s*(.*)$/i },

];



export const CATEGORY_ORDER = [

  "선생님께 한마디",

  "과목별 학습 설문",

  "공부 시작 시기",

  "공부 방법",

  "시험 전 자신감",

  "기타",

];



const PROFILE_KEYWORD_THEMES = [

  { re: /국어|수학|영어|과학|사회|음악|체육|미술|역사|도덕|기술|정보/gi, label: "과목 언급" },

  { re: /자신감|불안|긴장|걱정/gi, label: "시험·정서" },

  { re: /친구|또래|관계/gi, label: "대인관계" },

  { re: /집중|복습|예습|필기/gi, label: "학습 습관" },

  { re: /선생님|감사|고맙/gi, label: "선생님·감사" },

];



function escapeRegex(s) {

  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

}



function detectCategory(line) {

  for (const def of CATEGORY_DEFS) {

    if (def.patterns.some((p) => p.test(line))) return def.key;

  }

  return null;

}



function appendChunk(target, key, chunk) {

  const v = String(chunk ?? "").trim();

  if (!v) return;

  target[key] = target[key] ? `${target[key]}\n${v}` : v;

}



/**

 * @param {string} text

 * @param {{ 반?: string, 번호?: number, 이름?: string } | null} [meta]

 */

export function stripProfileHeader(text, meta) {

  let s = String(text ?? "").trim();

  if (meta?.반 != null && meta?.번호 != null && meta?.이름) {

    const classNum = String(meta.반).replace(/반$/, "");

    const specific = new RegExp(

      `^\\[${escapeRegex(classNum)}반\\]\\s*\\[${meta.번호}\\]\\s*\\[${escapeRegex(meta.이름)}\\]\\s*학생\\s*프로필\\s*`,

      "i"

    );

    s = s.replace(specific, "");

  }

  return s.replace(PROFILE_HEADER_PATTERN, "").trim();

}



/**

 * @param {string} text

 * @param {{ 반?: string, 번호?: number, 이름?: string } | null} [meta]

 * @returns {Record<string, string>}

 */

export function parseProfileCategories(text, meta) {

  const body = stripProfileHeader(text, meta);

  if (!body) return {};



  const result = {};

  let current = null;

  let buffer = [];



  const flush = () => {

    if (current && buffer.length) {

      appendChunk(result, current, buffer.join("\n"));

      buffer = [];

    }

  };



  for (const rawLine of body.split(/\r?\n/)) {

    const line = rawLine.trim();

    if (!line) continue;



    let fieldHandled = false;

    for (const field of FIELD_LINES) {

      const m = line.match(field.re);

      if (m) {

        flush();

        current = null;

        appendChunk(result, field.key, m[1] || "");

        fieldHandled = true;

        break;

      }

    }

    if (fieldHandled) continue;



    const cat = detectCategory(line);

    if (cat) {

      flush();

      current = cat;

      const quoted = line.match(/[""]([^""]+)[""]/);

      if (quoted) {

        buffer.push(quoted[1]);

        continue;

      }

      const withoutEmoji = line
        .replace(/^[\s💗📚📝✏️🎯⭐🔖•\-]+\s*/, "")
        .trim();
      const shortHeader =
        /^(선생님께\s*전하는\s*한마디|영역별\s*\(과목별\)\s*학습\s*설문)\s*[:：]?\s*$/i.test(
          withoutEmoji
        );
      if (!shortHeader && withoutEmoji) buffer.push(withoutEmoji);

    } else if (current) {

      buffer.push(line);

    } else {

      appendChunk(result, "기타", line);

    }

  }

  flush();



  if (!Object.keys(result).length) {

    result["기타"] = body;

  }



  return result;

}



/**

 * @param {Array<{ categories?: Record<string, string>, _raw?: { 프로필?: string } }>} rows

 */

export function extractCommonThemes(rows) {

  const categoryFill = {};

  const keywordHits = {};



  for (const row of rows) {

    const cats =

      row.categories ||

      parseProfileCategories(row._raw?.프로필 || "", null);



    for (const [key, val] of Object.entries(cats)) {

      if (!val?.trim() || key === "기타") continue;

      categoryFill[key] = (categoryFill[key] || 0) + 1;

    }



    const corpus = Object.values(cats).join(" ");

    for (const { re, label } of PROFILE_KEYWORD_THEMES) {

      const matches = corpus.match(re);

      if (matches?.length) {

        keywordHits[label] = (keywordHits[label] || 0) + matches.length;

      }

    }

  }



  const themes = [

    ...Object.entries(categoryFill).map(([주제, 언급수]) => ({

      주제,

      언급수,

      유형: "category",

    })),

    ...Object.entries(keywordHits).map(([주제, 언급수]) => ({

      주제,

      언급수,

      유형: "keyword",

    })),

  ];



  themes.sort((a, b) => b.언급수 - a.언급수);

  return themes.slice(0, 10);

}



export function categoriesToList(categories) {

  const ordered = [];

  const seen = new Set();

  for (const key of CATEGORY_ORDER) {

    const val = categories[key];

    if (val?.trim()) {

      ordered.push({ label: key, value: val.trim() });

      seen.add(key);

    }

  }

  for (const [key, val] of Object.entries(categories)) {

    if (!seen.has(key) && val?.trim()) {

      ordered.push({ label: key, value: val.trim() });

    }

  }

  return ordered;

}



export function extractProfileMeta(text) {

  const match = String(text ?? "").match(PROFILE_PATTERN);

  if (!match) return null;

  return {

    반: `${match[1]}반`,

    번호: Number(match[2]),

    이름: match[3].trim(),

  };

}



export function isProfileSheetFormat(rawValues) {

  if (!rawValues?.length) return false;



  const sampleRows = rawValues.slice(0, Math.min(5, rawValues.length));

  let hits = 0;

  let checked = 0;



  for (const row of sampleRows) {

    const text = row?.map((c) => String(c ?? "").trim()).join(" ") || "";

    if (!text) continue;

    checked += 1;

    if (PROFILE_PATTERN.test(text)) hits += 1;

  }



  return checked > 0 && hits >= Math.ceil(checked / 2);

}



/**

 * @param {string[][]} rawValues

 */

export function normalizeProfileSheet(rawValues) {

  const dataRows = rawValues.filter((row) =>

    row?.some((cell) => String(cell ?? "").trim() !== "")

  );



  const rows = dataRows

    .map((raw, rowIndex) => {

      const text = raw.map((c) => String(c ?? "").trim()).join("\n").trim();

      const meta = extractProfileMeta(text);

      if (!meta) return null;



      const categories = parseProfileCategories(text, meta);

      const categoryList = categoriesToList(categories);



      return {

        id: rowIndex + 1,

        반: meta.반,

        번호: meta.번호,

        이름: meta.이름,

        categories,

        categoryList,

        _raw: {

          이름: meta.이름,

          프로필: text,

          본문: stripProfileHeader(text, meta),

        },

        완료: true,

      };

    })

    .filter(Boolean);



  rows.sort((a, b) => {

    const classCmp = String(a.반).localeCompare(String(b.반), "ko");

    if (classCmp !== 0) return classCmp;

    return (a.번호 ?? 0) - (b.번호 ?? 0);

  });



  return {

    headers: ["반", "번호", "이름"],

    rows,

    meta: {

      classColumn: "반",

      numberColumn: "번호",

      completionColumn: "(프로필 제출)",

      format: "profile",

    },

  };

}


