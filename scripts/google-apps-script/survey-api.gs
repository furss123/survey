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
    config.appendRow(["id", "label", "grade", "questionsJson", "categorySelectAll"]);
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

function buildSurveyConfigJson_(survey) {
  return JSON.stringify({
    questions: survey.questions || [],
    description: survey.description || "",
    rosterSpreadsheetId: survey.rosterSpreadsheetId || "",
    rosterSheetName: survey.rosterSheetName || "",
    rosterSource: survey.rosterSource || "",
    rosterLabel: survey.rosterLabel || "",
    rosterStudents: survey.rosterStudents || [],
    responseStorage: survey.responseStorage || "github",
    responseSpreadsheetId: survey.responseSpreadsheetId || "",
  });
}

function parseSurveyConfigJson_(raw) {
  if (!raw) return { questions: [] };
  try {
    var parsed = JSON.parse(raw);
    if (Object.prototype.toString.call(parsed) === "[object Array]") {
      return { questions: parsed };
    }
    return {
      questions: parsed.questions || [],
      description: parsed.description || "",
      rosterSpreadsheetId: parsed.rosterSpreadsheetId || "",
      rosterSheetName: parsed.rosterSheetName || "",
      rosterSource: parsed.rosterSource || "",
      rosterLabel: parsed.rosterLabel || "",
      rosterStudents: parsed.rosterStudents || [],
      responseStorage: parsed.responseStorage || "github",
      responseSpreadsheetId: parsed.responseSpreadsheetId || "",
    };
  } catch (e) {
    return { questions: [] };
  }
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
    buildSurveyConfigJson_(survey),
    survey.categorySelectAll ? "Y" : "",
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
  var labels = (survey.questions || [])
    .filter(function (q) {
      return q && q.type !== "section";
    })
    .map(function (q) {
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
    var cfg = parseSurveyConfigJson_(data[i][3]);
    return {
      ok: true,
      survey: {
        id: data[i][0],
        label: data[i][1],
        grade: data[i][2],
        questions: cfg.questions,
        description: cfg.description,
        rosterSpreadsheetId: cfg.rosterSpreadsheetId,
        rosterSheetName: cfg.rosterSheetName,
        rosterSource: cfg.rosterSource,
        rosterLabel: cfg.rosterLabel,
        rosterStudents: cfg.rosterStudents,
        responseStorage: cfg.responseStorage,
        responseSpreadsheetId: cfg.responseSpreadsheetId,
        categorySelectAll: String(data[i][4]).toUpperCase() === "Y",
      },
    };
  }
  return { ok: false, error: "survey not found" };
}

function githubGetConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty("GITHUB_TOKEN") || "",
    owner: props.getProperty("GITHUB_OWNER") || "furss123",
    repo: props.getProperty("GITHUB_REPO") || "survey",
    branch: props.getProperty("GITHUB_BRANCH") || "main",
  };
}

function githubApi_(method, path, payload) {
  var cfg = githubGetConfig_();
  if (!cfg.token) return { ok: false, error: "GITHUB_TOKEN not configured" };
  var url =
    "https://api.github.com/repos/" +
    cfg.owner +
    "/" +
    cfg.repo +
    "/contents/" +
    path;
  if (method === "GET") url += "?ref=" + encodeURIComponent(cfg.branch);
  var options = {
    method: method,
    headers: {
      Authorization: "Bearer " + cfg.token,
      Accept: "application/vnd.github+json",
      "User-Agent": "namak-survey-api",
    },
    muteHttpExceptions: true,
  };
  if (payload) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }
  var resp = UrlFetchApp.fetch(url, options);
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  var data = {};
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = {};
  }
  if (code >= 200 && code < 300) return { ok: true, data: data };
  if (code === 404 && method === "GET") return { ok: true, missing: true };
  return { ok: false, error: (data && data.message) || text, code: code };
}

function appendGithubResponse_(surveyId, record) {
  var path = "responses/" + surveyId + "/data.json";
  var got = githubApi_("GET", path);
  var list = [];
  var sha = null;
  if (got.ok && !got.missing && got.data && got.data.content) {
    var decoded = Utilities.newBlob(
      Utilities.base64Decode(String(got.data.content).replace(/\n/g, ""))
    ).getDataAsString("UTF-8");
    try {
      list = JSON.parse(decoded);
    } catch (e) {
      list = [];
    }
    if (Object.prototype.toString.call(list) !== "[object Array]") list = [];
    sha = got.data.sha;
  }
  list.push(record);
  var cfg = githubGetConfig_();
  var body = {
    message:
      "Add response: " +
      surveyId +
      " (" +
      (record["학번"] || record.submittedAt || "") +
      ")",
    content: Utilities.base64Encode(JSON.stringify(list, null, 2)),
    branch: cfg.branch,
  };
  if (sha) body.sha = sha;
  return githubApi_("PUT", path, body);
}

function usesSheetStorage_(survey) {
  return survey && String(survey.responseStorage || "").toLowerCase() === "sheet";
}

function submitResponse_(body) {
  if (!body.surveyId) throw new Error("surveyId required");
  var got = getSurvey_(body.surveyId);
  if (!got.ok) throw new Error(got.error || "survey not found");
  var survey = got.survey;
  var answers = body.answers || {};
  var record = {
    submittedAt: body.submittedAt || new Date().toISOString(),
    surveyId: body.surveyId,
    학번: body.학번 || "",
    반: body.반 || "",
    번호: body.번호 != null ? body.번호 : "",
    이름: body.이름 || "",
    answers: answers,
  };
  var githubResult = null;
  if (!usesSheetStorage_(survey)) {
    githubResult = appendGithubResponse_(body.surveyId, record);
    if (!githubResult.ok) {
      throw new Error(
        "GitHub 저장 실패: " +
          (githubResult.error || "unknown") +
          ". Apps Script 스크립트 속성에 GITHUB_TOKEN을 설정했는지 확인하세요."
      );
    }
  }
  if (usesSheetStorage_(survey)) {
    syncResponseHeaders_(survey);
    var sheets = ensureSheets_();
    var resp = sheets.responses;
    var header = resp.getRange(1, 1, 1, resp.getLastColumn()).getValues()[0];
    var row = [];
    header.forEach(function (h) {
      if (h === "제출시각") row.push(record.submittedAt);
      else if (h === "설문ID") row.push(body.surveyId);
      else if (h === "학번") row.push(record["학번"]);
      else if (h === "반") row.push(record["반"]);
      else if (h === "번호") row.push(record["번호"]);
      else if (h === "이름") row.push(record["이름"]);
      else {
        var q = (survey.questions || []).find(function (x) {
          return (x.label || x.id) === h;
        });
        row.push(q ? answers[q.id] || "" : "");
      }
    });
    resp.appendRow(row);
  }
  return {
    ok: true,
    storage: usesSheetStorage_(survey) ? "sheet" : "github",
    github: githubResult,
  };
}
