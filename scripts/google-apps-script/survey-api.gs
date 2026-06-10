/**
 * 남악고 설문 API — 스프레드시트에 바인딩 후 웹 앱으로 배포
 * 시트: Config (레거시), SurveyRegistry (공개 설문 목록), Responses (레거시)
 */
var CONFIG_SHEET = "Config";
var RESPONSES_SHEET = "Responses";
var REGISTRY_SHEET = "SurveyRegistry";
var REGISTRY_HEADERS = [
  "id",
  "label",
  "url",
  "viewMode",
  "resultsLayout",
  "categorySelectAll",
  "updatedAt",
  "registeredAt",
  "surveyStatus",
  "metaJson",
];

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "get") {
    return jsonOut(getSurvey_(e.parameter.id));
  }
  if (action === "listRegistry") {
    return jsonOut(listRegistry_());
  }
  return jsonOut({ ok: true, hint: "POST delete | upsertRegistry" });
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action || "";
    if (action === "delete") {
      return jsonOut(deleteSurvey_(body.surveyId || body.id));
    }
    if (action === "upsertRegistry") {
      return jsonOut(upsertRegistry_(body.entry || body));
    }
    if (action === "deleteRegistry") {
      return jsonOut(deleteRegistry_(body.surveyId || body.id));
    }
    return jsonOut({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function ensureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = ss.getSheetByName(CONFIG_SHEET);
  if (!config) {
    config = ss.insertSheet(CONFIG_SHEET);
    config.appendRow([
      "id",
      "label",
      "grade",
      "questionsJson",
      "categorySelectAll",
      "surveyStatus",
    ]);
  }
  var registry = ss.getSheetByName(REGISTRY_SHEET);
  if (!registry) {
    registry = ss.insertSheet(REGISTRY_SHEET);
    registry.appendRow(REGISTRY_HEADERS);
  } else if (registry.getLastRow() < 1) {
    registry.appendRow(REGISTRY_HEADERS);
  }
  return { config: config, registry: registry };
}

function isRegistrySpreadsheetId_(id) {
  return /^[a-zA-Z0-9_-]{20,60}$/.test(String(id || "").trim());
}

function registryRowToEntry_(row) {
  if (!row || !row[0] || !isRegistrySpreadsheetId_(row[0])) return null;
  var entry = {
    id: String(row[0]),
    label: row[1],
    url: row[2],
    viewMode: String(row[3] || "class"),
    resultsLayout: String(row[4] || row[3] || "class"),
    categorySelectAll: row[5] === false || row[5] === 0 || String(row[5]) === "0" || String(row[5]).toLowerCase() === "false" ? false : true,
    updatedAt: Number(row[6]) || 0,
    registeredAt: Number(row[7]) || 0,
    surveyStatus: String(row[8] || "active"),
    sourceType: "sheet",
    visibility: "public",
  };
  if (row[9]) {
    try {
      var meta = JSON.parse(String(row[9]));
      if (meta.tab) entry.tab = meta.tab;
      if (meta.categories) entry.categories = meta.categories;
      if (meta.classes) entry.classes = meta.classes;
      if (meta.listOrder != null) entry.listOrder = Number(meta.listOrder);
      if (meta.orderUpdatedAt != null) entry.orderUpdatedAt = Number(meta.orderUpdatedAt);
      if (meta.labelUpdatedAt != null) entry.labelUpdatedAt = Number(meta.labelUpdatedAt);
    } catch (e) { /* ignore */ }
  }
  return entry;
}

function listRegistry_() {
  var sheets = ensureSheets_();
  var registry = sheets.registry;
  var data = registry.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var entry = registryRowToEntry_(data[i]);
    if (entry) items.push(entry);
  }
  return { ok: true, registry: items };
}

function upsertRegistry_(entry) {
  entry = entry && entry.entry ? entry.entry : entry;
  if (!entry || !entry.id) throw new Error("entry.id required");
  if (!isRegistrySpreadsheetId_(entry.id)) throw new Error("invalid entry.id");
  var sheets = ensureSheets_();
  var registry = sheets.registry;
  var data = registry.getDataRange().getValues();
  var rowValues = [
    String(entry.id),
    entry.label || "",
    entry.url || "",
    entry.viewMode || entry.resultsLayout || "class",
    entry.resultsLayout || entry.viewMode || "class",
    entry.categorySelectAll === false ? false : true,
    Number(entry.updatedAt) || Date.now(),
    Number(entry.registeredAt) || Date.now(),
    entry.surveyStatus || "active",
    entry.metaJson || "",
  ];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(entry.id)) continue;
    registry.getRange(i + 1, 1, 1, rowValues.length).setValues([rowValues]);
    return { ok: true, updated: true };
  }
  registry.appendRow(rowValues);
  return { ok: true, created: true };
}

function deleteRegistry_(surveyId) {
  if (!surveyId) throw new Error("surveyId required");
  var sheets = ensureSheets_();
  var registry = sheets.registry;
  var data = registry.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) !== String(surveyId)) continue;
    registry.deleteRow(i + 1);
    return { ok: true };
  }
  return { ok: true, missing: true };
}

function deleteSurvey_(surveyId) {
  if (!surveyId) throw new Error("surveyId required");
  var sheets = ensureSheets_();
  var config = sheets.config;
  var data = config.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) !== String(surveyId)) continue;
    config.deleteRow(i + 1);
    return { ok: true };
  }
  return { ok: true, missing: true };
}

function getSurvey_(id) {
  if (!id) return { ok: false, error: "id required" };
  var sheets = ensureSheets_();
  var data = sheets.config.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(id)) continue;
    return {
      ok: true,
      survey: {
        id: data[i][0],
        label: data[i][1],
        grade: data[i][2],
        surveyStatus: String(data[i][5] || "active") === "completed" ? "completed" : "active",
      },
    };
  }
  return { ok: false, error: "survey not found" };
}
