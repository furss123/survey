/**

 * 공개 Google 시트용 gviz JSON 조회 (Service Account 없을 때 폴백).

 */



/**

 * @param {string} text

 */

function parseGvizJson(text) {

  const start = text.indexOf("{");

  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {

    throw new Error("gviz 응답을 파싱할 수 없습니다.");

  }

  return JSON.parse(text.slice(start, end + 1));

}



/**

 * @param {string} html

 * @returns {{ gid: string | null, title: string }[]}

 */

export function parseTabsFromHtml(html) {

  const tabs = [];

  const re =

    /docs-sheet-tab[^>]*data-sheet-id="(\d+)"[^>]*aria-label="([^"]+)"/g;

  let m;

  while ((m = re.exec(html)) !== null) {

    tabs.push({ gid: m[1], title: m[2] });

  }

  if (tabs.length) return tabs;



  const captionRe = /docs-sheet-tab-caption">([^<]+)</g;

  while ((m = captionRe.exec(html)) !== null) {

    tabs.push({ gid: null, title: m[1].trim() });

  }

  return tabs;

}



/**

 * @param {string} spreadsheetId

 * @returns {Promise<{ gid: string | null, title: string }[]>}

 */

export async function fetchSpreadsheetTabsGviz(spreadsheetId) {

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`;

  const res = await fetch(url);

  if (!res.ok) {

    throw new Error(

      `시트 메타 조회 실패 (HTTP ${res.status}). 공개 공유 설정을 확인하세요.`

    );

  }

  const html = await res.text();

  return parseTabsFromHtml(html);

}



/**

 * @param {string} spreadsheetId

 * @param {{ sheet?: string | null, gid?: string | null }} [tab]

 * @returns {Promise<string[][]>}

 */

export async function fetchSheetValuesGviz(spreadsheetId, tab = {}) {

  const params = new URLSearchParams({ tqx: "out:json" });

  if (tab.gid) params.set("gid", tab.gid);

  else if (tab.sheet) params.set("sheet", tab.sheet);



  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params}`;

  const res = await fetch(url);

  if (!res.ok) {

    throw new Error(`공개 시트 조회 실패 (HTTP ${res.status})`);

  }



  const text = await res.text();

  const json = parseGvizJson(text);

  const table = json?.table;

  if (!table?.rows?.length) {

    return [];

  }



  const headers = (table.cols || []).map((c) => String(c?.label ?? "").trim());

  const rows = table.rows.map((row) =>

    (row.c || []).map((cell) => {

      if (cell == null) return "";

      if (cell.v != null) return String(cell.v);

      if (cell.f != null) return String(cell.f);

      return "";

    })

  );



  return [headers, ...rows];

}



/**

 * @param {string} spreadsheetId

 * @returns {Promise<{ sheetName: string, values: string[][], gid: string | null }[]>}

 */

export async function fetchAllSheetValuesGviz(spreadsheetId) {

  let tabs = await fetchSpreadsheetTabsGviz(spreadsheetId);

  if (!tabs.length) {

    tabs = [{ gid: null, title: null }];

  }



  const results = await Promise.all(

    tabs.map(async (tab) => {

      const values = await fetchSheetValuesGviz(spreadsheetId, {

        sheet: tab.title,

        gid: tab.gid,

      });

      return {

        sheetName: tab.title || "시트1",

        gid: tab.gid,

        values,

      };

    })

  );



  return results;

}


