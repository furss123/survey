/**
 * 설문 목록: localStorage · 공개 data/sheet-registry.json (GitHub Pages)
 */
(function (global) {
  "use strict";

  var REGISTRY_KEY = "school-sheet-registry-v1";
  var DELETED_SURVEYS_KEY = "school-sheet-deleted-surveys-v1";
  var WEBAPP_STORAGE_KEY = "school-survey-webapp-v1";
  var WEBAPP_SESSION_KEY = "school-survey-webapp-session-v1";
  var MASTER_ROSTER_SPREADSHEET_ID = "1GHbpOBkx2dLZvhiBzBIgpBgN5OBB80G-mQFcrfdpFXQ";
  var MASTER_ROSTER_SPREADSHEET_URL =
    "https://docs.google.com/spreadsheets/d/1GHbpOBkx2dLZvhiBzBIgpBgN5OBB80G-mQFcrfdpFXQ/edit?usp=sharing";
  var DEFAULT_ROSTER_SPREADSHEET_ID = MASTER_ROSTER_SPREADSHEET_ID;
  var DEFAULT_RESPONSE_SPREADSHEET_ID = "1oH3Er_9UF_A6HDQEK_1KjFxp54M_JJrU";
  var BUNDLED_REGISTRY_PATH = "data/sheet-registry.json";
  var SPREADSHEET_ID_PATTERN = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  var GRADE = 1;

  function parseSpreadsheetId(url) {
    var trimmed = coerceText(url);
    var match = trimmed.match(SPREADSHEET_ID_PATTERN);
    if (match && match[1]) return match[1];
    if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
    throw new Error("스프레드시트 ID를 URL에서 찾을 수 없습니다.");
  }

  function getRosterSpreadsheetId() {
    return MASTER_ROSTER_SPREADSHEET_ID;
  }

  function getMasterRosterSpreadsheetUrl() {
    return MASTER_ROSTER_SPREADSHEET_URL;
  }

  function loadWebAppUrl() {
    try {
      return coerceText(localStorage.getItem(WEBAPP_STORAGE_KEY));
    } catch (e) {
      return "";
    }
  }

  function saveWebAppUrl(url) {
    var trimmed = coerceText(url);
    if (trimmed) localStorage.setItem(WEBAPP_STORAGE_KEY, trimmed);
    else localStorage.removeItem(WEBAPP_STORAGE_KEY);
  }

  function loadWebAppUrlSession() {
    try {
      return coerceText(sessionStorage.getItem(WEBAPP_SESSION_KEY));
    } catch (e) {
      return "";
    }
  }

  function saveWebAppUrlSession(url) {
    var trimmed = coerceText(url);
    if (trimmed && isValidWebAppUrl(trimmed)) {
      sessionStorage.setItem(WEBAPP_SESSION_KEY, trimmed);
    }
  }

  function isValidWebAppUrl(url) {
    url = coerceText(url);
    return (
      url.indexOf("script.google.com") >= 0 &&
      /\/exec\/?(\?|$)/i.test(url)
    );
  }

  function resolveWebAppUrl(entry) {
    var fromEntry = entry && coerceText(entry.webAppUrl);
    var fromSession = loadWebAppUrlSession();
    var global = loadWebAppUrl();
    if (fromEntry && isValidWebAppUrl(fromEntry)) return fromEntry;
    if (fromSession && isValidWebAppUrl(fromSession)) return fromSession;
    if (global && isValidWebAppUrl(global)) return global;
    return "";
  }

  function getResponseSpreadsheetId(entry) {
    return (
      (entry && entry.responseSpreadsheetId) ||
      DEFAULT_RESPONSE_SPREADSHEET_ID
    );
  }

  async function readJsonResponse(res) {
    var text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      if (/^\s*<!DOCTYPE/i.test(text) || /^\s*<html/i.test(text)) {
        throw new Error(
          "서버가 HTML을 반환했습니다. Apps Script 웹 앱 URL(/exec)이 맞는지 확인하세요."
        );
      }
      throw new Error("서버 응답을 JSON으로 읽을 수 없습니다.");
    }
  }

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function coerceText(v) {
    return v == null ? "" : String(v).trim();
  }

  function countHangulChars(text) {
    return (String(text || "").match(/[\uAC00-\uD7A3]/g) || []).length;
  }

  function decodeHtmlEntities(text) {
    var s = String(text || "");
    s = s
      .replace(/\\u([0-9a-fA-F]{4})/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/\\x([0-9a-fA-F]{2})/g, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      });
    s = s
      .replace(/&#x([0-9a-fA-F]+);/gi, function (_, hex) {
        return String.fromCharCode(parseInt(hex, 16));
      })
      .replace(/&#(\d+);/g, function (_, num) {
        return String.fromCharCode(parseInt(num, 10));
      });
    if (typeof document !== "undefined" && /&[#a-zA-Z0-9]+;/.test(s)) {
      var ta = document.createElement("textarea");
      ta.innerHTML = s;
      s = ta.value;
    }
    return s;
  }

  function repairUtf8FromLatin1(text) {
    var s = String(text || "");
    if (!s) return s;
    try {
      var bytes = new Uint8Array(s.length);
      for (var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
      var repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (repaired && countHangulChars(repaired) > countHangulChars(s)) return repaired;
    } catch (e) { /* ignore */ }
    try {
      var viaEscape = decodeURIComponent(escape(s));
      if (viaEscape && countHangulChars(viaEscape) > countHangulChars(s)) return viaEscape;
    } catch (e2) { /* ignore */ }
    return s;
  }

  function normalizeDisplayText(text) {
    var s = coerceText(decodeHtmlEntities(text));
    if (!s) return "";
    s = repairUtf8FromLatin1(s);
    return s.replace(/\s+/g, " ").trim();
  }

  function normalizeRegistryEntry(entry) {
    if (!entry) return entry;
    var out = Object.assign({}, entry);
    if (out.label != null) out.label = normalizeDisplayText(out.label) || out.label;
    if (Array.isArray(out.categories)) {
      out.categories = out.categories.map(function (c) {
        if (!c) return c;
        return Object.assign({}, c, {
          label: c.label != null ? normalizeDisplayText(c.label) || c.label : c.label,
        });
      });
    }
    return out;
  }

  function hasSheetSource(entry) {
    if (!entry) return false;
    if (entry.sourceType === "md") return false;
    if (String(entry.id || "").indexOf("md-") === 0) return false;
    if (entry.sourceType === "sheet") return !!coerceText(entry.url);
    var url = coerceText(entry.url);
    if (!url || url.indexOf("spreadsheets/d/") < 0) return false;
    try {
      var parsedId = parseSpreadsheetId(url);
      return String(parsedId).indexOf("md-") !== 0;
    } catch (e) {
      return false;
    }
  }

  function ensureSurveyFullyPublic(entry) {
    if (!entry || !hasSheetSource(entry)) return entry;
    entry = normalizeRegistryEntry(entry);
    var out = Object.assign({}, entry, {
      sourceType: "sheet",
      categorySelectAll: true,
      visibility: "public",
    });
    if (Array.isArray(out.categories)) {
      out.categories = out.categories.map(function (c) {
        return Object.assign({}, c, { enabled: true });
      });
    }
    if (Array.isArray(out.classes)) {
      out.classes = out.classes.map(function (c) {
        return Object.assign({}, c, { enabled: true });
      });
    }
    return out;
  }

  function isSheetRegistryEntry(entry) {
    return entry && entry.type !== "form" && hasSheetSource(entry);
  }

  function filterSheetEntriesOnly(list) {
    return (list || []).filter(isSheetRegistryEntry);
  }

  function dedupeRegistryEntries(list) {
    var byId = {};
    (list || []).forEach(function (entry) {
      if (!entry || !entry.id) return;
      if (!isSheetRegistryEntry(entry)) return;
      if (isSurveyDeleted(entry.id)) return;
      byId[entry.id] = ensureSurveyFullyPublic(entry);
    });
    return Object.keys(byId).map(function (id) {
      return byId[id];
    });
  }

  function loadRegistry() {
    try {
      var raw = localStorage.getItem(REGISTRY_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      var list = dedupeRegistryEntries(parsed);
      var normalized = list.map(normalizeRegistryEntry);
      var changed = JSON.stringify(normalized) !== JSON.stringify(list);
      if (changed) saveRegistry(normalized, { silent: true });
      return changed ? normalized : list;
    } catch (e) {
      return [];
    }
  }

  function saveRegistry(list, options) {
    options = options || {};
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(dedupeRegistryEntries(list)));
    if (options.silent) return;
    try {
      window.dispatchEvent(new CustomEvent("survey-registry-updated"));
    } catch (e) { /* ignore */ }
  }

  function loadDeletedSurveyIds() {
    try {
      var raw = localStorage.getItem(DELETED_SURVEYS_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function markSurveyDeleted(id) {
    if (!id) return;
    var map = loadDeletedSurveyIds();
    map[id] = Date.now();
    localStorage.setItem(DELETED_SURVEYS_KEY, JSON.stringify(map));
  }

  function unmarkSurveyDeleted(id) {
    if (!id) return;
    var map = loadDeletedSurveyIds();
    delete map[id];
    localStorage.setItem(DELETED_SURVEYS_KEY, JSON.stringify(map));
  }

  function isSurveyDeleted(id) {
    return id ? !!loadDeletedSurveyIds()[id] : false;
  }

  function isSurveyCompleted(entry) {
    if (!entry) return false;
    if (entry.surveyStatus === "completed") return true;
    if (entry.surveyStatus === "active") return false;
    return false;
  }

  function defaultSurveyStatus() {
    return "active";
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

  async function setSurveyStatusAsync(id, status) {
    return setSurveyStatus(id, status);
  }

  function mergeRemoteAndLocalRegistry(remote, local) {
    var byId = {};
    (remote || []).forEach(function (entry) {
      if (entry && entry.id) byId[entry.id] = entry;
    });
    (local || []).forEach(function (entry) {
      if (!entry || !entry.id || isSurveyDeleted(entry.id)) return;
      var prev = byId[entry.id];
      if (!prev) {
        byId[entry.id] = entry;
        return;
      }
      /* 같은 ID는 로컬(관리자 수정)이 서버 JSON보다 우선 — 새로고침 시 제목이 되돌아가지 않음 */
      byId[entry.id] = Object.assign({}, prev, entry, {
        label: coerceText(entry.label) ? entry.label : prev.label,
        url: coerceText(entry.url) ? entry.url : prev.url,
      });
    });
    return dedupeRegistryEntries(
      Object.keys(byId).map(function (id) {
        return byId[id];
      })
    );
  }

  function expandBundledRegistryEntry(entry) {
    if (!entry || !entry.id) return null;
    if (String(entry.id).indexOf("md-") === 0) return null;
    var out = ensureSurveyFullyPublic(Object.assign({}, entry, { sourceType: "sheet" }));
    return hasSheetSource(out) ? out : null;
  }

  async function fetchBundledSheetRegistry() {
    try {
      var res = await fetch(BUNDLED_REGISTRY_PATH + "?v=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return [];
      var buf = await res.arrayBuffer();
      var text = new TextDecoder("utf-8").decode(buf);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      var data = JSON.parse(text);
      if (!Array.isArray(data)) {
        if (data && typeof data === "object" && data.id) data = [data];
        else return [];
      }
      return data
        .map(expandBundledRegistryEntry)
        .filter(function (entry) {
          return entry && entry.id && !isSurveyDeleted(entry.id);
        });
    } catch (e) {
      return [];
    }
  }

  async function refreshRegistryFromServer(options) {
    options = options || {};
    var local = loadRegistry();
    var published = await fetchBundledSheetRegistry();
    var merged = mergeRemoteAndLocalRegistry(published, local);
    saveRegistry(merged, { silent: options.silent });
    return merged;
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
    if (/^\s*<!DOCTYPE/i.test(text) || /^\s*<html/i.test(text)) {
      throw new Error(
        "시트를 불러올 수 없습니다. 공유 설정(링크가 있는 사용자 → 보기)을 확인하세요."
      );
    }
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("응답 파싱 실패");
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e) {
      throw new Error("시트 응답을 읽을 수 없습니다.");
    }
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

  async function fetchRosterRows(overrideSpreadsheetId) {
    var spreadsheetId = overrideSpreadsheetId || getRosterSpreadsheetId();
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

  async function fetchSurveyFromConfigSheet(surveyId, spreadsheetId) {
    if (!surveyId) return null;
    spreadsheetId = spreadsheetId || DEFAULT_RESPONSE_SPREADSHEET_ID;
    try {
      var values = await fetchGvizValues(spreadsheetId, "Config");
      if (!values || values.length < 2) return null;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(surveyId)) {
          return { id: values[i][0], responseSpreadsheetId: spreadsheetId };
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  async function deleteSurveyOnServer(entryOrId) {
    var id =
      typeof entryOrId === "string"
        ? entryOrId
        : entryOrId && entryOrId.id
          ? entryOrId.id
          : "";
    if (!id) return { ok: false, error: "surveyId required" };
    var local =
      typeof entryOrId === "object" && entryOrId
        ? entryOrId
        : findSurvey(id) || { id: id };
    var webAppUrl = resolveWebAppUrl(local);
    if (!webAppUrl) return { ok: true, skipped: true, reason: "no-webapp" };
    var res = await fetch(webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action: "delete", surveyId: id }),
    });
    var data = await readJsonResponse(res);
    if (!data || data.ok === false) {
      return {
        ok: false,
        error: (data && data.error) || "서버 삭제에 실패했습니다.",
      };
    }
    return data;
  }

  async function purgeSurveyFromServer(entryOrId) {
    var id =
      typeof entryOrId === "string"
        ? entryOrId
        : entryOrId && entryOrId.id
          ? entryOrId.id
          : "";
    if (!id) return { ok: false, localOnly: true, warnings: ["설문 ID 없음"] };
    markSurveyDeleted(id);
    var result = await deleteSurveyOnServer(entryOrId);
    var warnings = [];
    if (result && result.skipped) {
      warnings.push(
        "웹 앱 URL이 없어 Config 시트에서는 삭제되지 않았습니다. 관리자에서 URL을 저장한 뒤 다시 삭제하거나, Config 시트에서 해당 행을 직접 지워 주세요."
      );
    } else if (result && result.ok === false) {
      warnings.push(
        (result.error || "서버 삭제 실패") +
          " — Apps Script를 최신 survey-api.gs로 재배포했는지 확인하세요."
      );
    } else {
      var still = await fetchSurveyFromConfigSheet(
        id,
        getResponseSpreadsheetId(
          typeof entryOrId === "object" && entryOrId ? entryOrId : { id: id }
        )
      );
      if (still) {
        warnings.push(
          "Config 시트에 설문 행이 남아 있습니다. 시트에서 직접 삭제하거나 웹 앱을 재배포한 뒤 다시 시도하세요."
        );
      }
    }
    return { ok: true, warnings: warnings };
  }

  global.SurveyForm = {
    REGISTRY_KEY: REGISTRY_KEY,
    MASTER_ROSTER_SPREADSHEET_ID: MASTER_ROSTER_SPREADSHEET_ID,
    MASTER_ROSTER_SPREADSHEET_URL: MASTER_ROSTER_SPREADSHEET_URL,
    DEFAULT_ROSTER_SPREADSHEET_ID: DEFAULT_ROSTER_SPREADSHEET_ID,
    DEFAULT_RESPONSE_SPREADSHEET_ID: DEFAULT_RESPONSE_SPREADSHEET_ID,
    BUNDLED_REGISTRY_PATH: BUNDLED_REGISTRY_PATH,
    WEBAPP_STORAGE_KEY: WEBAPP_STORAGE_KEY,
    getRosterSpreadsheetId: getRosterSpreadsheetId,
    getMasterRosterSpreadsheetUrl: getMasterRosterSpreadsheetUrl,
    loadWebAppUrl: loadWebAppUrl,
    saveWebAppUrl: saveWebAppUrl,
    resolveWebAppUrl: resolveWebAppUrl,
    getResponseSpreadsheetId: getResponseSpreadsheetId,
    isValidWebAppUrl: isValidWebAppUrl,
    saveWebAppUrlSession: saveWebAppUrlSession,
    fetchSurveyFromConfigSheet: fetchSurveyFromConfigSheet,
    parseSpreadsheetId: parseSpreadsheetId,
    GRADE: GRADE,
    esc: esc,
    coerceText: coerceText,
    normalizeDisplayText: normalizeDisplayText,
    decodeHtmlEntities: decodeHtmlEntities,
    repairUtf8FromLatin1: repairUtf8FromLatin1,
    normalizeRegistryEntry: normalizeRegistryEntry,
    hasSheetSource: hasSheetSource,
    ensureSurveyFullyPublic: ensureSurveyFullyPublic,
    loadRegistry: loadRegistry,
    saveRegistry: saveRegistry,
    fetchBundledSheetRegistry: fetchBundledSheetRegistry,
    isSurveyCompleted: isSurveyCompleted,
    defaultSurveyStatus: defaultSurveyStatus,
    setSurveyStatus: setSurveyStatus,
    setSurveyStatusAsync: setSurveyStatusAsync,
    refreshRegistryFromServer: refreshRegistryFromServer,
    partitionRegistryByStatus: partitionRegistryByStatus,
    findSurvey: findSurvey,
    parseStudentId: parseStudentId,
    formatStudentId: formatStudentId,
    fetchRosterRows: fetchRosterRows,
    deriveClassOptions: deriveClassOptions,
    lookupStudent: lookupStudent,
    studentsInClass: studentsInClass,
    deleteSurveyOnServer: deleteSurveyOnServer,
    purgeSurveyFromServer: purgeSurveyFromServer,
    dedupeRegistryEntries: dedupeRegistryEntries,
    filterSheetEntriesOnly: filterSheetEntriesOnly,
    isSheetRegistryEntry: isSheetRegistryEntry,
    markSurveyDeleted: markSurveyDeleted,
    unmarkSurveyDeleted: unmarkSurveyDeleted,
    isSurveyDeleted: isSurveyDeleted,
    fetchGvizValues: fetchGvizValues,
  };
})(typeof window !== "undefined" ? window : this);

