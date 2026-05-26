/**
 * 남악고 설문 API — 스프레드시트에 바인딩 후 웹 앱으로 배포
 * 시트: Config (레거시 설문 행 삭제용), Responses (레거시)
 */
var CONFIG_SHEET = "Config";
var RESPONSES_SHEET = "Responses";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "get") {
    return jsonOut(getSurvey_(e.parameter.id));
  }
  return jsonOut({ ok: true, hint: "POST delete" });
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
  return { config: config };
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
