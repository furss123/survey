(function (global) {
  "use strict";

  var REGISTRY_KEY = "school-sheet-registry-v1";
  var ROSTER_STORAGE_KEY = "school-roster-sheet-v1";
  var ROSTER_SESSION_KEY = "school-roster-sheet-session-v1";
  var DEFAULT_ROSTER_SPREADSHEET_ID = "1GHbpOBkx2dLZvhiBzBIgpBgN5OBB80G-mQFcrfdpFXQ";
  var SPREADSHEET_ID_PATTERN = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  var GRADE = 1;

  function parseSpreadsheetId(url) {
    var trimmed = coerceText(url);
    var match = trimmed.match(SPREADSHEET_ID_PATTERN);
    if (match && match[1]) return match[1];
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
    throw new Error("스프레드시트 ID를 URL에서 찾을 수 없습니다.");
  }

  function loadRosterConfig() {
    try {
      var raw = localStorage.getItem(ROSTER_STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.id && parsed.remember !== false) return parsed;
    } catch (e) { /* ignore */ }
    return null;
  }

  function loadSessionRosterConfig() {
    try {
      var raw = sessionStorage.getItem(ROSTER_SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.id) return parsed;
    } catch (e) { /* ignore */ }
    return null;
  }

  function getActiveRosterConfig() {
    return loadSessionRosterConfig() || loadRosterConfig();
  }

  function saveRosterConfig(config, remember) {
    var payload = Object.assign({}, config, {
      remember: !!remember,
      savedAt: Date.now(),
    });
    sessionStorage.setItem(ROSTER_SESSION_KEY, JSON.stringify(payload));
    if (remember) {
      localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(payload));
    } else {
      try {
        localStorage.removeItem(ROSTER_STORAGE_KEY);
      } catch (e) { /* ignore */ }
    }
  }

  function getRosterSpreadsheetId() {
    var cfg = getActiveRosterConfig();
    return (cfg && cfg.id) || DEFAULT_ROSTER_SPREADSHEET_ID;
  }

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

  function isSurveyCompleted(entry) {
    return !!(entry && entry.surveyStatus === "completed");
  }

  function setSurveyStatus(id, status) {
    var list = loadRegistry();
    var idx = list.findIndex(function (item) {
      return item && item.id === id;
    });
    if (idx < 0) throw new Error("설문을 찾을 수 없습니다.");
    var completed = status === "completed";
    list[idx] = Object.assign({}, list[idx], {
      surveyStatus: completed ? "completed" : "active",
      completedAt: completed ? Date.now() : null,
    });
    saveRegistry(list);
    return list[idx];
  }

  function partitionRegistryByStatus(registry) {
    var active = [];
    var completed = [];
    (registry || []).forEach(function (entry) {
      if (isSurveyCompleted(entry)) completed.push(entry);
      else active.push(entry);
    });
    return { active: active, completed: completed };
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

  function normalizeBan(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) {
      var n = Math.floor(value);
      return n >= 1 ? n : null;
    }
    var m = coerceText(value).match(/(\d+)/);
    if (!m) return null;
    var ban = parseInt(m[1], 10);
    return ban >= 1 ? ban : null;
  }

  function bansMatch(a, b) {
    var na = normalizeBan(a);
    var nb = normalizeBan(b);
    return na != null && nb != null && na === nb;
  }

  function coerceNumber(value) {
    var s = coerceText(value).replace(/,/g, "");
    var n = Number(s);
    if (Number.isFinite(n) && n === Math.floor(n) && n >= 0) return Math.floor(n);
    var m = s.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  function findColumnIndex(headers, aliases) {
    for (var i = 0; i < headers.length; i++) {
      var h = coerceText(headers[i]).toLowerCase();
      for (var j = 0; j < aliases.length; j++) {
        if (h.indexOf(String(aliases[j]).toLowerCase()) >= 0) return i;
      }
    }
    return -1;
  }

  function findColumnIndexExact(headers, aliases) {
    for (var i = 0; i < headers.length; i++) {
      var h = coerceText(headers[i]).toLowerCase();
      for (var j = 0; j < aliases.length; j++) {
        if (h === String(aliases[j]).toLowerCase()) return i;
      }
    }
    return -1;
  }

  function isMatrixClassRoster(rawValues) {
    if (!rawValues || !rawValues.length) return false;
    var headerRow = rawValues[0].map(coerceText);
    var classCols = 0;
    headerRow.forEach(function (h) {
      if (/^\d+\s*반$/.test(String(h || "").trim())) classCols += 1;
    });
    return classCols >= 2;
  }

  function parseMatrixClassRoster(rawValues) {
    if (!rawValues || !rawValues.length) return [];
    var headerRow = rawValues[0].map(coerceText);
    var dataRows = rawValues.slice(1).filter(function (row) {
      return row && row.some(function (cell) {
        return coerceText(cell) !== "";
      });
    });
    var numberIdx = findColumnIndexExact(headerRow, ["번호", "number", "no", "no."]);
    if (numberIdx < 0) numberIdx = findColumnIndex(headerRow, ["번호", "number", "no"]);
    if (numberIdx < 0) numberIdx = 0;

    var classColumns = [];
    headerRow.forEach(function (h, idx) {
      if (idx === numberIdx) return;
      var m = String(h || "").trim().match(/^(\d+)\s*반$/);
      if (m) classColumns.push({ idx: idx, ban: parseInt(m[1], 10) });
    });
    if (!classColumns.length) return [];

    var roster = [];
    dataRows.forEach(function (raw, rowIndex) {
      var numberVal = numberIdx >= 0 ? coerceNumber(raw[numberIdx]) : null;
      if (numberVal == null) numberVal = rowIndex + 1;
      classColumns.forEach(function (col) {
        var nameVal = coerceText(raw[col.idx]);
        if (!nameVal) return;
        roster.push({
          반: col.ban,
          번호: numberVal,
          이름: nameVal,
          학번: formatStudentId(GRADE, col.ban, numberVal),
        });
      });
    });
    return roster;
  }

  function parseListRoster(rawValues) {
    if (!rawValues || !rawValues.length) return [];
    if (isMatrixClassRoster(rawValues)) return parseMatrixClassRoster(rawValues);

    var header = rawValues[0].map(coerceText);
    var dataRows = rawValues.slice(1).filter(function (row) {
      return row && row.some(function (cell) {
        return coerceText(cell) !== "";
      });
    });

    var banIdx = findColumnIndexExact(header, ["반", "class", "학급"]);
    if (banIdx < 0) banIdx = findColumnIndex(header, ["반", "class", "학급", "반명"]);
    var numIdx = findColumnIndexExact(header, ["번호", "number", "no"]);
    if (numIdx < 0) numIdx = findColumnIndex(header, ["번호", "number", "no"]);
    var nameIdx = findColumnIndexExact(header, ["이름", "name", "성명", "성함"]);
    if (nameIdx < 0) nameIdx = findColumnIndex(header, ["이름", "name", "성명", "성함"]);
    var sidIdx = findColumnIndexExact(header, ["학번", "student_id", "학생번호"]);
    if (sidIdx < 0) sidIdx = findColumnIndex(header, ["학번", "student_id"]);

    var rows = [];
    dataRows.forEach(function (row, rowIndex) {
      var banRaw = banIdx >= 0 ? coerceText(row[banIdx]) : "";
      var numRaw = numIdx >= 0 ? coerceText(row[numIdx]) : "";
      var name = nameIdx >= 0 ? coerceText(row[nameIdx]) : "";
      var sidRaw = sidIdx >= 0 ? coerceText(row[sidIdx]) : "";
      var ban = normalizeBan(banRaw);
      var num = coerceNumber(numRaw);
      var parsedId = parseStudentId(sidRaw);
      if (ban == null && parsedId.반 != null) ban = parsedId.반;
      if (num == null && parsedId.번호 != null) num = parsedId.번호;
      if (num == null && !name && !sidRaw) return;
      if (num == null) num = rowIndex + 1;
      var 학번 = sidRaw || formatStudentId(GRADE, ban, num);
      if (ban == null) {
        var from학번 = parseStudentId(학번);
        if (from학번.반 != null) ban = from학번.반;
      }
      rows.push({
        반: ban,
        번호: num,
        이름: name,
        학번: 학번,
      });
    });
    return rows;
  }

  async function fetchRosterRows() {
    var spreadsheetId = getRosterSpreadsheetId();
    var probes = ["1반", "명단", "명렬표", "list", ""];
    for (var i = 0; i < probes.length; i++) {
      try {
        var values = await fetchGvizValues(spreadsheetId, probes[i] || undefined);
        var roster = parseListRoster(values);
        if (roster.length) return roster;
      } catch (err) { /* try next sheet */ }
    }
    return [];
  }

  function deriveClassOptions(roster) {
    var map = {};
    roster.forEach(function (s) {
      var ban = normalizeBan(s.반);
      if (ban == null || ban < 1) return;
      var key = String(ban);
      if (!map[key]) map[key] = { 반: ban, label: ban + "반", count: 0 };
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
        return bansMatch(s.반, ban) && s.번호 === num;
      }) || null
    );
  }

  function studentsInClass(roster, ban) {
    return roster
      .filter(function (s) {
        return bansMatch(s.반, ban);
      })
      .sort(function (a, b) {
        return (a.번호 || 0) - (b.번호 || 0);
      });
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
    ROSTER_STORAGE_KEY: ROSTER_STORAGE_KEY,
    ROSTER_SESSION_KEY: ROSTER_SESSION_KEY,
    DEFAULT_ROSTER_SPREADSHEET_ID: DEFAULT_ROSTER_SPREADSHEET_ID,
    getRosterSpreadsheetId: getRosterSpreadsheetId,
    getActiveRosterConfig: getActiveRosterConfig,
    loadRosterConfig: loadRosterConfig,
    loadSessionRosterConfig: loadSessionRosterConfig,
    saveRosterConfig: saveRosterConfig,
    parseSpreadsheetId: parseSpreadsheetId,
    GRADE: GRADE,
    esc: esc,
    loadRegistry: loadRegistry,
    saveRegistry: saveRegistry,
    isSurveyCompleted: isSurveyCompleted,
    setSurveyStatus: setSurveyStatus,
    partitionRegistryByStatus: partitionRegistryByStatus,
    findSurvey: findSurvey,
    parseStudentId: parseStudentId,
    formatStudentId: formatStudentId,
    fetchRosterRows: fetchRosterRows,
    deriveClassOptions: deriveClassOptions,
    lookupStudent: lookupStudent,
    studentsInClass: studentsInClass,
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
