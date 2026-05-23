/**
 * 남악고 설문 API — 스프레드시트에 바인딩 후 웹 앱으로 배포
 * 시트: Config (설문 정의), Responses (응답 누적)
 */
var CONFIG_SHEET = "Config";
var RESPONSES_SHEET = "Responses";

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";
  if (action === "get") {
    return jsonOut(getSurvey_(e.parameter.id));
  }
  return jsonOut({ ok: true, hint: "POST register | submit" });
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action || "";
    if (action === "register") {
      return jsonOut(registerSurvey_(body.survey));
    }
    if (action === "submit") {
      return jsonOut(submitResponse_(body));
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
    config.appendRow(["id", "label", "grade", "questionsJson", "categorySelectAll", "surveyStatus"]);
  }
  var resp = ss.getSheetByName(RESPONSES_SHEET);
  if (!resp) {
    resp = ss.insertSheet(RESPONSES_SHEET);
    resp.appendRow([
      "제출시각",
      "설문ID",
      "학번",
      "반",
      "번호",
      "이름",
    ]);
  }
  return { config: config, responses: resp };
}

function registerSurvey_(survey) {
  if (!survey || !survey.id) throw new Error("survey.id required");
  var sheets = ensureSheets_();
  var config = sheets.config;
  var data = config.getDataRange().getValues();
  var row = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(survey.id)) {
      row = i + 1;
      break;
    }
  }
  var line = [
    survey.id,
    survey.label || "",
    survey.grade || 1,
    JSON.stringify(survey.questions || []),
    survey.categorySelectAll ? "Y" : "",
    survey.surveyStatus === "completed" ? "completed" : "active",
  ];
  if (row > 0) config.getRange(row, 1, 1, line.length).setValues([line]);
  else config.appendRow(line);
  syncResponseHeaders_(survey);
  return { ok: true };
}

function syncResponseHeaders_(survey) {
  var sheets = ensureSheets_();
  var resp = sheets.responses;
  var header = resp.getRange(1, 1, 1, resp.getLastColumn()).getValues()[0];
  var base = ["제출시각", "설문ID", "학번", "반", "번호", "이름"];
  var labels = (survey.questions || []).map(function (q) {
    return q.label || q.id;
  });
  var merged = base.concat(labels);
  if (header.join("|") !== merged.join("|")) {
    resp.clear();
    resp.appendRow(merged);
  }
}

function getSurvey_(id) {
  if (!id) return { ok: false, error: "id required" };
  var sheets = ensureSheets_();
  var data = sheets.config.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(id)) continue;
    var questions = [];
    try {
      questions = JSON.parse(data[i][3] || "[]");
    } catch (e) {}
    return {
      ok: true,
      survey: {
        id: data[i][0],
        label: data[i][1],
        grade: data[i][2],
        questions: questions,
        categorySelectAll: String(data[i][4]).toUpperCase() === "Y",
        surveyStatus: String(data[i][5] || "active") === "completed" ? "completed" : "active",
      },
    };
  }
  return { ok: false, error: "survey not found" };
}

function submitResponse_(body) {
  if (!body.surveyId) throw new Error("surveyId required");
  var got = getSurvey_(body.surveyId);
  if (!got.ok) throw new Error(got.error || "survey not found");
  var survey = got.survey;
  syncResponseHeaders_(survey);
  var sheets = ensureSheets_();
  var resp = sheets.responses;
  var header = resp.getRange(1, 1, 1, resp.getLastColumn()).getValues()[0];
  var answers = body.answers || {};
  var row = [];
  header.forEach(function (h) {
    if (h === "제출시각") row.push(body.submittedAt || new Date().toISOString());
    else if (h === "설문ID") row.push(body.surveyId);
    else if (h === "학번") row.push(body.학번 || "");
    else if (h === "반") row.push(body.반 || "");
    else if (h === "번호") row.push(body.번호 != null ? body.번호 : "");
    else if (h === "이름") row.push(body.이름 || "");
    else {
      var q = (survey.questions || []).find(function (x) {
        return (x.label || x.id) === h;
      });
      row.push(q ? answers[q.id] || "" : "");
    }
  });
  resp.appendRow(row);
  return { ok: true };
}
