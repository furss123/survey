import fs from "fs";

const spreadsheetId = "1oH3Er_9UF_A6HDQEK_1KjFxp54M_JJrU";
const htmlPath = process.argv[2];

function parseGvizJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("gviz parse fail");
  return JSON.parse(text.slice(start, end + 1));
}

function parseTabsFromHtml(html) {
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
  if (tabs.length) return tabs;

  const re2 = /"sheetId":(\d+)[^}]*"title":"([^"]+)"/g;
  while ((m = re2.exec(html)) !== null) {
    tabs.push({ gid: m[1], title: m[2] });
  }
  return tabs;
}

async function fetchTabsFromHtml() {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`;
  const res = await fetch(url);
  const html = await res.text();
  return parseTabsFromHtml(html);
}

async function fetchTabData(tab) {
  const params = new URLSearchParams({ tqx: "out:json" });
  if (tab.gid) params.set("gid", tab.gid);
  else if (tab.title) params.set("sheet", tab.title);
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params}`;
  const res = await fetch(url);
  const text = await res.text();
  const json = parseGvizJson(text);
  const rows = json?.table?.rows?.length ?? 0;
  return { ...tab, rows, ok: res.ok };
}

const tabs = htmlPath
  ? parseTabsFromHtml(fs.readFileSync(htmlPath, "utf8"))
  : await fetchTabsFromHtml();

console.log("tabs found:", tabs.length);
console.log(tabs);

const results = await Promise.all(tabs.map(fetchTabData));
console.log("\nper-tab rows:");
for (const r of results) {
  console.log(`  ${r.title} (gid=${r.gid}): ${r.rows} rows`);
}
