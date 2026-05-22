(function (global) {
  "use strict";

  var REGISTRY_KEY = "school-sheet-registry-v1";
  var ROSTER_SPREADSHEET_ID = "1GHbpOBkx2dLZvhiBzBIgpBgN5OBB80G-mQFcrfdpFXQ";
  var GRADE = 1;

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function coerceText(v) {
    return v == null ? "" : String(v).trim();
  }

  function loadRegistry() {
    try {
      var raw = localStorage.getItem(REGISTRY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveRegistry(list) {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
  }

  function findSurvey(id) {
    return (
      loadRegistry().find(function (item) {
        return item && item.id === id;
      }) || null
    );
  }

  function parseStudentId(value) {
    var s = coerceText(value).replace(/,/g, "");
    var n = Number(s);
    if (Number.isFinite(n) && n === Math.floor(n) && n >= 0) s = String(Math.floor(n));
    var digits = s.replace(/\D/g, "");
    if (digits.length === 4) {
      return {
        grade: parseInt(digits.charAt(0), 10),
        반: parseInt(digits.charAt(1), 10),
        번호: parseInt(digits.slice(2), 10),
        학번: digits,
      };
    }
    return { grade: null, 반: null, 번호: null, 학번: "" };
  }

  function formatStudentId(grade, ban, num) {
    var g = grade != null ? grade : GRADE;
    var b = ban != null ? ban : 0;
    var n = num != null ? num : 0;
    return String(g) + String(b) + String(n).padStart(2, "0");
  }

  function gvizTableToValues(gviz) {
    var table = gviz && gviz.table;
    if (!table || !table.cols || !table.rows) return [];
    var cols = table.cols.length;
    return table.rows.map(function (row) {
      var cells = [];
      for (var i = 0; i < cols; i++) {
        var c = row.c && row.c[i];
        cells.push(c && c.v != null ? c.v : "");
      }
      return cells;
    });
  }

  function parseGvizJson(text) {
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("응답 파싱 실패");
    return JSON.parse(text.slice(start, end + 1));
  }

  async function fetchRosterRows() {
    var url =
      "https://docs.google.com/spreadsheets/d/" +
      ROSTER_SPREADSHEET_ID +
      "/gviz/tq?tqx=out:json";
    var res = await fetch(url);
    if (!res.ok) throw new Error("명렬표 시트를 불러오지 못했습니다.");
    var values = gvizTableToValues(parseGvizJson(await res.text()));
    if (!values.length) return [];
    var header = values[0].map(coerceText);
    var banIdx = header.findIndex(function (h) {
      return /반/.test(h);
    });
    var numIdx = header.findIndex(function (h) {
      return /번호/.test(h);
    });
    var nameIdx = header.findIndex(function (h) {
      return /이름|성명/.test(h);
    });
    var rows = [];
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var banRaw = banIdx >= 0 ? coerceText(row[banIdx]) : "";
      var numRaw = numIdx >= 0 ? coerceText(row[numIdx]) : "";
      var name = nameIdx >= 0 ? coerceText(row[nameIdx]) : "";
      var banMatch = banRaw.match(/(\d+)/);
      var ban = banMatch ? parseInt(banMatch[1], 10) : null;
      var num = Number(numRaw);
      if (!Number.isFinite(num)) continue;
      rows.push({
        반: ban,
        번호: num,
        이름: name,
        학번: formatStudentId(GRADE, ban, num),
      });
    }
    return rows;
  }

  function deriveClassOptions(roster) {
    var map = {};
    roster.forEach(function (s) {
      if (s.반 == null) return;
      var key = String(s.반);
      if (!map[key]) map[key] = { 반: s.반, label: s.반 + "반", count: 0 };
      map[key].count += 1;
    });
    return Object.keys(map)
      .sort(function (a, b) {
        return Number(a) - Number(b);
      })
      .map(function (k) {
        return map[k];
      });
  }

  function lookupStudent(roster, ban, num) {
    return (
      roster.find(function (s) {
        return s.반 === ban && s.번호 === num;
      }) || null
    );
  }

  async function fetchSurveyConfig(entry) {
    if (!entry) return null;
    if (entry.webAppUrl) {
      var u =
        entry.webAppUrl +
        (entry.webAppUrl.indexOf("?") >= 0 ? "&" : "?") +
        "action=get&id=" +
        encodeURIComponent(entry.id);
      var res = await fetch(u);
      var data = await res.json();
      if (data && data.ok && data.survey) return data.survey;
      throw new Error((data && data.error) || "설문 정보를 불러오지 못했습니다.");
    }
    if (entry.type === "form" && entry.questions) return entry;
    return null;
  }

  async function submitSurveyResponse(entry, payload) {
    if (!entry || !entry.webAppUrl) {
      throw new Error(
        "제출 주소가 없습니다. 관리자에게 Apps Script 배포 URL을 등록해 달라고 요청하세요."
      );
    }
    var res = await fetch(entry.webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(
        Object.assign({ action: "submit", surveyId: entry.id }, payload)
      ),
    });
    var text = await res.text();
    var data = null;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { ok: res.ok };
    }
    if (data && data.ok === false) {
      throw new Error(data.error || "제출에 실패했습니다.");
    }
    if (!res.ok && !(data && data.ok)) {
      throw new Error("제출에 실패했습니다. (" + res.status + ")");
    }
    return data;
  }

  function generateSurveyId() {
    return "form-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function questionCategories(entry) {
    var qs = (entry && entry.questions) || [];
    return [{ id: "all", label: "모든 문항", enabled: true }].concat(
      qs.map(function (q) {
        return { id: q.id, label: q.label || q.id, enabled: true };
      })
    );
  }

  async function fetchGvizValues(spreadsheetId, sheetName) {
    var base =
      "https://docs.google.com/spreadsheets/d/" +
      encodeURIComponent(spreadsheetId) +
      "/gviz/tq?tqx=out:json";
    if (sheetName) base += "&sheet=" + encodeURIComponent(sheetName);
    var res = await fetch(base);
    if (!res.ok) throw new Error("응답 시트를 불러오지 못했습니다.");
    return gvizTableToValues(parseGvizJson(await res.text()));
  }

  function buildFormAnalysisFromValues(entry, roster, values) {
    if (!values || !values.length) {
      return {
        sheets: [
          {
            sheetName: "전체",
            rows: [],
            participation: { missingStudents: roster.slice() },
            meta: { format: "form", surveyId: entry.id },
            summary: { 총응답: 0 },
          },
        ],
      };
    }
    var header = values[0].map(coerceText);
    var sidIdx = header.findIndex(function (h) {
      return /설문\s*id|surveyid/i.test(h);
    });
    var idIdx = sidIdx >= 0 ? sidIdx : header.findIndex(function (h) {
      return h === "설문ID";
    });
    var 학번Idx = header.findIndex(function (h) {
      return /학번/.test(h);
    });
    var 반Idx = header.findIndex(function (h) {
      return /^반$/.test(h);
    });
    var 번호Idx = header.findIndex(function (h) {
      return /번호/.test(h);
    });
    var 이름Idx = header.findIndex(function (h) {
      return /이름|성명/.test(h);
    });
    var questions = entry.questions || [];
    var qColMap = {};
    questions.forEach(function (q) {
      var idx = header.findIndex(function (h) {
        return h === q.label || h === q.id;
      });
      if (idx >= 0) qColMap[q.id] = idx;
    });
    header.forEach(function (h, i) {
      if (qColMap[h]) return;
      questions.forEach(function (q) {
        if (!qColMap[q.id] && (h === q.label || h === q.id)) qColMap[q.id] = i;
      });
    });

    var respondedKeys = {};
    var rows = [];
    for (var r = 1; r < values.length; r++) {
      var cells = values[r];
      var surveyCell = idIdx >= 0 ? coerceText(cells[idIdx]) : "";
      if (idIdx >= 0 && surveyCell && surveyCell !== entry.id) continue;
      var 학번 = 학번Idx >= 0 ? coerceText(cells[학번Idx]) : "";
      var parsed = parseStudentId(학번);
      var banRaw = 반Idx >= 0 ? coerceText(cells[반Idx]) : "";
      var banMatch = banRaw.match(/(\d+)/);
      var 반 = banMatch ? banMatch[1] + "반" : parsed.반 ? parsed.반 + "반" : "";
      var 번호 = 번호Idx >= 0 ? Number(coerceText(cells[번호Idx])) : parsed.번호;
      var 이름 = 이름Idx >= 0 ? coerceText(cells[이름Idx]) : "";
      var sections = questions
        .map(function (q) {
          var ci = qColMap[q.id];
          var body = ci >= 0 ? coerceText(cells[ci]) : "";
          if (!body) return null;
          return { title: q.label || q.id, body: body, fields: [] };
        })
        .filter(Boolean);
      if (!sections.length) continue;
      var key = 학번 || 반 + "-" + 번호;
      respondedKeys[key] = true;
      rows.push({
        학번: 학번 || formatStudentId(entry.grade || GRADE, parsed.반, 번호),
        반: 반,
        번호: Number.isFinite(번호) ? 번호 : null,
        이름: 이름,
        sections: sections,
        _raw: {},
      });
    }

    var missingStudents = roster.filter(function (s) {
      var k = s.학번 || (s.반 != null ? s.반 + "반-" + s.번호 : "");
      return !respondedKeys[k] && !respondedKeys[s.학번];
    });

    return {
      sheets: [
        {
          sheetName: "전체",
          rows: rows,
          participation: { missingStudents: missingStudents },
          meta: { format: "form", surveyId: entry.id, sheetName: "전체" },
          summary: { 총응답: rows.length },
        },
      ],
    };
  }

  async function fetchFormResponsesAnalysis(entry, roster) {
    var sheetId =
      (entry && entry.responseSpreadsheetId) ||
      "1oH3Er_9UF_A6HDQEK_1KjFxp54M_JJrU";
    var tab = (entry && entry.responseTab) || "Responses";
    var values = await fetchGvizValues(sheetId, tab);
    return buildFormAnalysisFromValues(entry, roster, values);
  }

  async function registerSurveyOnServer(entry) {
    if (!entry || !entry.webAppUrl) return { ok: false, skipped: true };
    var res = await fetch(entry.webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        action: "register",
        survey: {
          id: entry.id,
          label: entry.label,
          grade: entry.grade || GRADE,
          questions: entry.questions || [],
          categorySelectAll: !!entry.categorySelectAll,
        },
      }),
    });
    return res.json();
  }

  global.SurveyForm = {
    REGISTRY_KEY: REGISTRY_KEY,
    ROSTER_SPREADSHEET_ID: ROSTER_SPREADSHEET_ID,
    GRADE: GRADE,
    esc: esc,
    loadRegistry: loadRegistry,
    saveRegistry: saveRegistry,
    findSurvey: findSurvey,
    parseStudentId: parseStudentId,
    formatStudentId: formatStudentId,
    fetchRosterRows: fetchRosterRows,
    deriveClassOptions: deriveClassOptions,
    lookupStudent: lookupStudent,
    fetchSurveyConfig: fetchSurveyConfig,
    submitSurveyResponse: submitSurveyResponse,
    registerSurveyOnServer: registerSurveyOnServer,
    generateSurveyId: generateSurveyId,
    questionCategories: questionCategories,
    fetchFormResponsesAnalysis: fetchFormResponsesAnalysis,
    buildFormAnalysisFromValues: buildFormAnalysisFromValues,
    fetchGvizValues: fetchGvizValues,
  };
})(typeof window !== "undefined" ? window : this);
