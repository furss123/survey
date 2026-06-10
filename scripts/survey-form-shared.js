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
  var BUNDLED_CONFIG_PATH = "data/survey-config.json";
  var bundledSurveyConfig = null;
  var bundledSurveyConfigPromise = null;
  var SPREADSHEET_ID_PATTERN = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  var REGISTRY_SPREADSHEET_ID_RE = /^[a-zA-Z0-9_-]{20,60}$/;
  var GRADE = 1;

  function isRegistrySpreadsheetId(id) {
    return REGISTRY_SPREADSHEET_ID_RE.test(coerceText(id));
  }

  function isRegistrySheetHeaderRow(row) {
    if (!row || !row.length) return false;
    var h0 = coerceText(row[0]).toLowerCase();
    return h0 === "id" || h0 === "surveyid" || h0 === "sheetid";
  }

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

  function getBundledWebAppUrl() {
    var config = bundledSurveyConfig;
    if (!config) return "";
    var url = coerceText(config.webAppUrl);
    return isValidWebAppUrl(url) ? url : "";
  }

  function resolveWebAppUrl(entry) {
    var fromEntry = entry && coerceText(entry.webAppUrl);
    var fromSession = loadWebAppUrlSession();
    var global = loadWebAppUrl();
    var fromBundled = getBundledWebAppUrl();
    if (fromEntry && isValidWebAppUrl(fromEntry)) return fromEntry;
    if (fromSession && isValidWebAppUrl(fromSession)) return fromSession;
    if (global && isValidWebAppUrl(global)) return global;
    if (fromBundled) return fromBundled;
    return "";
  }

  async function fetchBundledSurveyConfig() {
    if (bundledSurveyConfig) return bundledSurveyConfig;
    if (bundledSurveyConfigPromise) return bundledSurveyConfigPromise;
    bundledSurveyConfigPromise = (async function () {
      try {
        var res = await fetch(BUNDLED_CONFIG_PATH + "?v=" + Date.now(), {
          cache: "no-store",
        });
        if (!res.ok) return {};
        var data = await res.json();
        bundledSurveyConfig = data && typeof data === "object" ? data : {};
        return bundledSurveyConfig;
      } catch (e) {
        return {};
      }
    })();
    return bundledSurveyConfigPromise;
  }

  async function initSurveyConfig(options) {
    options = options || {};
    var config = await fetchBundledSurveyConfig();
    var webAppUrl = coerceText(config.webAppUrl);
    if (webAppUrl && isValidWebAppUrl(webAppUrl)) {
      if (!loadWebAppUrl() || options.forceWebAppUrl) saveWebAppUrl(webAppUrl);
      saveWebAppUrlSession(webAppUrl);
    }
    return config;
  }

  function getResponseSpreadsheetId(entry) {
    return (
      (entry && entry.responseSpreadsheetId) ||
      DEFAULT_RESPONSE_SPREADSHEET_ID
    );
  }

  function explainWebAppHtmlError(text) {
    if (!text) return "";
    if (/script function not found|doGet|doPost|συνάρτηση|関数が見つかりません/i.test(text)) {
      return (
        "Apps Script에 survey-api.gs 코드(doGet/doPost)가 없습니다. " +
        "스프레드시트 → 확장 프로그램 → Apps Script에 scripts/google-apps-script/survey-api.gs 전체를 붙여넣고 「새 배포」 후 같은 /exec URL을 쓰세요."
      );
    }
    if (/Authorization|권한|authorize|sign in|로그인/i.test(text)) {
      return (
        "웹 앱 권한이 아직 허용되지 않았습니다. 배포한 Google 계정으로 웹 앱 URL을 브라우저에서 한 번 열고 「허용」을 눌러 주세요."
      );
    }
    return "";
  }

  async function readJsonResponse(res) {
    var text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      if (/^\s*<!DOCTYPE/i.test(text) || /^\s*<html/i.test(text)) {
        var hint = explainWebAppHtmlError(text);
        throw new Error(
          hint ||
            "서버가 HTML을 반환했습니다. Apps Script 웹 앱 URL(/exec)과 재배포를 확인하세요."
        );
      }
      throw new Error("서버 응답을 JSON으로 읽을 수 없습니다.");
    }
  }

  async function postToWebApp(webAppUrl, payload) {
    var body = JSON.stringify(payload);
    try {
      var res = await fetch(webAppUrl, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: body,
      });
      return { response: res, opaque: false };
    } catch (err) {
      try {
        await fetch(webAppUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: body,
        });
        return { response: null, opaque: true, networkError: err };
      } catch (noCorsErr) {
        throw err;
      }
    }
  }

  async function probeWebAppHealth(webAppUrl) {
    webAppUrl = coerceText(webAppUrl);
    if (!isValidWebAppUrl(webAppUrl)) {
      return { ok: false, reason: "invalid-url" };
    }
    try {
      var testUrl =
        webAppUrl +
        (webAppUrl.indexOf("?") >= 0 ? "&" : "?") +
        "action=listRegistry";
      var res = await fetch(testUrl, { redirect: "follow" });
      var text = await res.text();
      var htmlHint = explainWebAppHtmlError(text);
      if (htmlHint) return { ok: false, error: htmlHint };
      try {
        var data = JSON.parse(text);
        if (data && data.ok !== false) return { ok: true, data: data };
        return {
          ok: false,
          error: (data && data.error) || "웹 앱 응답이 올바르지 않습니다.",
        };
      } catch (parseErr) {
        return { ok: false, error: "웹 앱이 JSON이 아닌 응답을 반환했습니다." };
      }
    } catch (err) {
      return {
        ok: false,
        error: (err && err.message) || "웹 앱에 연결하지 못했습니다.",
      };
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

  function applyKoreanOrthography(text, options) {
    if (typeof global.KoreanOrthography !== "undefined" && global.KoreanOrthography.apply) {
      return global.KoreanOrthography.apply(text, options);
    }
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeDisplayText(text) {
    var s = coerceText(decodeHtmlEntities(text));
    if (!s) return "";
    s = repairUtf8FromLatin1(s);
    s = s.replace(/\s+/g, " ").trim();
    return applyKoreanOrthography(s, { light: true });
  }

  /** 설문 답변: 국립국어원 표준 맞춤법·띄어쓰기 (서울대 교육 표기 기준과 동일 계열) */
  function applyKoreanAnswerSpacing(text) {
    return applyKoreanOrthography(text, { light: false });
  }

  function normalizeSurveyAnswerText(text, options) {
    options = options || {};
    var s = coerceText(decodeHtmlEntities(text));
    if (!s) return "";
    s = repairUtf8FromLatin1(s);
    s = s.replace(/\s+/g, " ").trim();
    if (options.singleLine) {
      s = s.replace(/[\r\n\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
    }
    return applyKoreanOrthography(s, { light: false });
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

  function registryLabelRevision(entry) {
    if (!entry) return 0;
    var labelAt = Number(entry.labelUpdatedAt);
    if (Number.isFinite(labelAt) && labelAt > 0) return labelAt;
    var n = Number(entry.updatedAt);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function registryOrderRevision(entry) {
    if (!entry) return 0;
    var n = Number(entry.orderUpdatedAt);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function registryListOrder(entry) {
    if (!entry) return 999999;
    var n = Number(entry.listOrder);
    return Number.isFinite(n) ? n : 999999;
  }

  function pickRegistryListOrder(local, remote) {
    var localRev = registryOrderRevision(local);
    var remoteRev = registryOrderRevision(remote);
    var localHas =
      local &&
      local.listOrder != null &&
      Number.isFinite(Number(local.listOrder));
    var remoteHas =
      remote &&
      remote.listOrder != null &&
      Number.isFinite(Number(remote.listOrder));
    if (localHas && (!remoteHas || localRev >= remoteRev)) {
      return {
        listOrder: Number(local.listOrder),
        orderUpdatedAt: localRev || remoteRev || undefined,
      };
    }
    if (remoteHas) {
      return {
        listOrder: Number(remote.listOrder),
        orderUpdatedAt: remoteRev || localRev || undefined,
      };
    }
    if (localHas) {
      return {
        listOrder: Number(local.listOrder),
        orderUpdatedAt: localRev || undefined,
      };
    }
    return {};
  }

  function sortRegistryEntriesForDisplay(entries) {
    return (entries || []).slice().sort(function (a, b) {
      var ac = isSurveyCompleted(a) ? 1 : 0;
      var bc = isSurveyCompleted(b) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      var orderDiff = registryListOrder(a) - registryListOrder(b);
      if (orderDiff !== 0) return orderDiff;
      return String(a.label || "").localeCompare(String(b.label || ""), "ko");
    });
  }

  function nextRegistryListOrder(registry) {
    var max = -1;
    (registry || []).forEach(function (entry) {
      var n = registryListOrder(entry);
      if (n < 999999 && n > max) max = n;
    });
    return max + 1;
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
        byId[entry.id] = ensureSurveyFullyPublic(entry);
        return;
      }
      var remoteRev = registryLabelRevision(prev);
      var localRev = registryLabelRevision(entry);
      var localWinsLabel = localRev >= remoteRev;
      if (
        !entry.labelUpdatedAt &&
        prev.labelUpdatedAt &&
        remoteRev > 0 &&
        (remoteRev > localRev ||
          (coerceText(entry.label) &&
            coerceText(prev.label) &&
            entry.label !== prev.label))
      ) {
        localWinsLabel = false;
      }
      var orderPick = pickRegistryListOrder(entry, prev);
      if (localWinsLabel) {
        byId[entry.id] = Object.assign({}, prev, entry, {
          label: coerceText(entry.label) ? entry.label : prev.label,
          url: coerceText(entry.url) ? entry.url : prev.url,
          updatedAt: localRev || remoteRev,
          labelUpdatedAt: entry.labelUpdatedAt || entry.updatedAt || localRev || remoteRev,
          listOrder: orderPick.listOrder,
          orderUpdatedAt: orderPick.orderUpdatedAt,
        });
        return;
      }
      byId[entry.id] = Object.assign({}, entry, prev, {
        label: coerceText(prev.label) ? prev.label : entry.label,
        url: coerceText(prev.url) ? prev.url : entry.url,
        updatedAt: prev.updatedAt || entry.updatedAt,
        labelUpdatedAt: prev.labelUpdatedAt || prev.updatedAt || remoteRev || localRev,
        listOrder: orderPick.listOrder,
        orderUpdatedAt: orderPick.orderUpdatedAt,
        categories: entry.categories || prev.categories,
        classes: entry.classes || prev.classes,
        categorySelectAll:
          entry.categorySelectAll != null
            ? entry.categorySelectAll
            : prev.categorySelectAll,
        surveyStatus: entry.surveyStatus || prev.surveyStatus,
        completedAt: entry.completedAt != null ? entry.completedAt : prev.completedAt,
      });
    });
    (remote || []).forEach(function (entry) {
      if (!entry || !entry.id || isSurveyDeleted(entry.id) || byId[entry.id]) return;
      byId[entry.id] = entry;
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

  /** GitHub Pages 공개 목록에 반드시 포함할 설문 (다른 PC 목록 누락 방지) */
  var REQUIRED_PUBLIC_SHEET_SURVEYS = [
    {
      id: "1E_YTgoLt5ti6eNBv6H9A-mAmZVjpBR2RKhUN_yAJNXM",
      label: "SMART 학습검사 피드백 설문",
      url: "https://docs.google.com/spreadsheets/d/1E_YTgoLt5ti6eNBv6H9A-mAmZVjpBR2RKhUN_yAJNXM/edit?usp=sharing",
      sourceType: "sheet",
      visibility: "public",
      viewMode: "class",
      resultsLayout: "class",
      categorySelectAll: true,
      updatedAt: 1767225600001,
    },
  ];

  function appendRequiredPublicSurveys(list) {
    var byId = {};
    (list || []).forEach(function (entry) {
      if (entry && entry.id) byId[entry.id] = entry;
    });
    REQUIRED_PUBLIC_SHEET_SURVEYS.forEach(function (required) {
      var built = expandBundledRegistryEntry(required);
      if (!built) return;
      var prev = byId[built.id];
      if (!prev) {
        byId[built.id] = built;
        return;
      }
      var remoteRev = registryLabelRevision(built);
      var localRev = registryLabelRevision(prev);
      var stamp = Math.max(remoteRev, localRev);
      byId[built.id] = Object.assign({}, built, prev, {
        label: coerceText(prev.label) ? prev.label : built.label,
        url: coerceText(prev.url) ? prev.url : built.url,
        viewMode: prev.viewMode || built.viewMode,
        resultsLayout: prev.resultsLayout || built.resultsLayout,
        updatedAt: stamp,
        categorySelectAll:
          prev.categorySelectAll != null ? prev.categorySelectAll : built.categorySelectAll,
      });
    });
    return Object.keys(byId).map(function (id) {
      return byId[id];
    });
  }

  var PUBLIC_REGISTRY_SHEET = "SurveyRegistry";

  function toPublicRegistrySnapshot(entry) {
    if (!entry || !entry.id) return null;
    var updatedAt = registryLabelRevision(entry) || Date.now();
    var snap = {
      id: entry.id,
      label: normalizeDisplayText(entry.label) || entry.label,
      url: coerceText(entry.url),
      sourceType: "sheet",
      visibility: "public",
      viewMode: entry.viewMode || entry.resultsLayout || "class",
      resultsLayout: entry.resultsLayout || entry.viewMode || "class",
      categorySelectAll:
        entry.categorySelectAll != null ? entry.categorySelectAll : true,
      updatedAt: updatedAt,
      registeredAt: entry.registeredAt || updatedAt,
      surveyStatus: entry.surveyStatus || defaultSurveyStatus(),
      completedAt: entry.completedAt != null ? entry.completedAt : null,
    };
    var meta = {};
    if (entry.tab) meta.tab = entry.tab;
    if (Array.isArray(entry.categories) && entry.categories.length) {
      meta.categories = entry.categories;
    }
    if (Array.isArray(entry.classes) && entry.classes.length) {
      meta.classes = entry.classes;
    }
    if (entry.listOrder != null && Number.isFinite(Number(entry.listOrder))) {
      meta.listOrder = Number(entry.listOrder);
    }
    if (entry.orderUpdatedAt != null) {
      meta.orderUpdatedAt = Number(entry.orderUpdatedAt) || 0;
    }
    if (entry.labelUpdatedAt != null) {
      meta.labelUpdatedAt = Number(entry.labelUpdatedAt) || 0;
    }
    if (Object.keys(meta).length) snap.metaJson = JSON.stringify(meta);
    return snap;
  }

  function parseRegistrySheetValues(values) {
    if (!values || values.length < 2) return [];
    if (!isRegistrySheetHeaderRow(values[0])) return [];
    var out = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var id = coerceText(row[0]);
      if (!id || !isRegistrySpreadsheetId(id)) continue;
      var entry = {
        id: id,
        label: row[1],
        url: row[2],
        viewMode: coerceText(row[3]) || "class",
        resultsLayout: coerceText(row[4]) || coerceText(row[3]) || "class",
        categorySelectAll:
          row[5] === false ||
          row[5] === 0 ||
          String(row[5]).toLowerCase() === "false" ||
          String(row[5]).toLowerCase() === "0"
            ? false
            : true,
        updatedAt: Number(row[6]) || 0,
        registeredAt: Number(row[7]) || 0,
        surveyStatus: coerceText(row[8]) || defaultSurveyStatus(),
        sourceType: "sheet",
        visibility: "public",
      };
      var metaRaw = row[9];
      if (metaRaw) {
        try {
          var meta =
            typeof metaRaw === "string" ? JSON.parse(metaRaw) : metaRaw;
          if (meta && typeof meta === "object") {
            if (meta.tab) entry.tab = meta.tab;
            if (meta.categories) entry.categories = meta.categories;
            if (meta.classes) entry.classes = meta.classes;
            if (meta.listOrder != null && Number.isFinite(Number(meta.listOrder))) {
              entry.listOrder = Number(meta.listOrder);
            }
            if (meta.orderUpdatedAt != null) {
              entry.orderUpdatedAt = Number(meta.orderUpdatedAt) || 0;
            }
            if (meta.labelUpdatedAt != null) {
              entry.labelUpdatedAt = Number(meta.labelUpdatedAt) || 0;
            }
          }
        } catch (e) { /* ignore */ }
      }
      var built = expandBundledRegistryEntry(entry);
      if (built && !isSurveyDeleted(built.id)) out.push(built);
    }
    return out;
  }

  function getLiveRegistrySpreadsheetId() {
    var config = bundledSurveyConfig;
    var fromConfig =
      config && coerceText(config.responseSpreadsheetId)
        ? coerceText(config.responseSpreadsheetId)
        : "";
    return fromConfig || DEFAULT_RESPONSE_SPREADSHEET_ID;
  }

  async function fetchLiveRegistryFromSheet() {
    try {
      var values = await fetchGvizValues(
        getLiveRegistrySpreadsheetId(),
        PUBLIC_REGISTRY_SHEET
      );
      return parseRegistrySheetValues(values);
    } catch (e) {
      return [];
    }
  }

  async function fetchLiveRegistryFromWebApp() {
    try {
      var webAppUrl = resolveWebAppUrl({});
      if (!webAppUrl) return [];
      var listUrl =
        webAppUrl +
        (webAppUrl.indexOf("?") >= 0 ? "&" : "?") +
        "action=listRegistry";
      var res = await fetch(listUrl, { redirect: "follow" });
      var data = await readJsonResponse(res);
      if (!data || data.ok === false || !Array.isArray(data.registry)) return [];
      return data.registry
        .map(function (entry) {
          if (!entry || !isRegistrySpreadsheetId(entry.id)) return null;
          return expandBundledRegistryEntry(entry);
        })
        .filter(function (entry) {
          return entry && entry.id && !isSurveyDeleted(entry.id);
        });
    } catch (e) {
      return [];
    }
  }

  async function fetchLiveRegistry() {
    var fromWebApp = await fetchLiveRegistryFromWebApp();
    if (fromWebApp.length) return fromWebApp;
    return fetchLiveRegistryFromSheet();
  }

  function combineRemoteRegistrySources() {
    var merged = [];
    for (var i = 0; i < arguments.length; i++) {
      merged = mergeRemoteAndLocalRegistry(merged, arguments[i] || []);
    }
    return merged;
  }

  async function publishRegistryEntry(entry) {
    var snap = toPublicRegistrySnapshot(entry);
    if (!snap) return { ok: false, error: "invalid entry" };
    unmarkSurveyDeleted(snap.id);
    var webAppUrl = resolveWebAppUrl(entry);
    if (!webAppUrl) {
      return { ok: true, skipped: true, reason: "no-webapp" };
    }
    var posted = await postToWebApp(webAppUrl, {
      action: "upsertRegistry",
      entry: snap,
    });
    if (posted.opaque) {
      await new Promise(function (resolve) {
        setTimeout(resolve, 900);
      });
      var live = await fetchLiveRegistry();
      var found = live.find(function (item) {
        return item && item.id === snap.id;
      });
      if (found && coerceText(found.label)) {
        return { ok: true, opaque: true, verified: true };
      }
      return {
        ok: false,
        error:
          "서버에 요청은 보냈으나 SurveyRegistry에 반영 여부를 확인하지 못했습니다. Apps Script에 survey-api.gs를 붙여넣고 재배포했는지 확인하세요.",
      };
    }
    var data = await readJsonResponse(posted.response);
    if (!data || data.ok === false) {
      throw new Error(
        (data && data.error) || "공개 설문 목록(SurveyRegistry) 반영에 실패했습니다."
      );
    }
    return data;
  }

  async function removeRegistryEntryFromLive(id) {
    if (!id) return { ok: false, error: "id required" };
    var webAppUrl = resolveWebAppUrl({ id: id });
    if (!webAppUrl) return { ok: true, skipped: true, reason: "no-webapp" };
    var posted = await postToWebApp(webAppUrl, {
      action: "deleteRegistry",
      surveyId: id,
      id: id,
    });
    if (posted.opaque) {
      return { ok: true, opaque: true };
    }
    var data = await readJsonResponse(posted.response);
    if (!data || data.ok === false) {
      return {
        ok: false,
        error: (data && data.error) || "공개 목록에서 삭제하지 못했습니다.",
      };
    }
    return data;
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
    var bundled = appendRequiredPublicSurveys(await fetchBundledSheetRegistry());
    var live = await fetchLiveRegistry();
    var published = combineRemoteRegistrySources(live, bundled);
    var merged = mergeRemoteAndLocalRegistry(published, local);
    if (options.preferLiveRegistry && live.length) {
      merged = mergeRemoteAndLocalRegistry(merged, live);
    }
    if (options.preferLocalEntries && options.preferLocalEntries.length) {
      merged = applyRegistryEntriesPreferLocal(
        merged,
        options.preferLocalEntries,
        options.preferLocalOptions
      );
    }
    saveRegistry(merged, { silent: options.silent });
    return merged;
  }

  async function syncRegistryAllToServer() {
    if (!resolveWebAppUrl({})) {
      return { ok: true, skipped: true, reason: "no-webapp", published: 0 };
    }
    var list = dedupeRegistryEntries(loadRegistry());
    var results = [];
    for (var i = 0; i < list.length; i++) {
      try {
        results.push(await publishRegistryEntry(list[i]));
      } catch (err) {
        results.push({
          ok: false,
          error: (err && err.message) || String(err),
        });
      }
    }
    var failed = results.filter(function (item) {
      return item && item.ok === false;
    });
    return {
      ok: !failed.length,
      skipped: false,
      published: list.length,
      failed: failed.length,
      results: results,
    };
  }

  function applyRegistryEntriesPreferLocal(registry, preferEntries, options) {
    options = options || {};
    var bumpLabelRevision = options.bumpLabelRevision !== false;
    var byId = {};
    (registry || []).forEach(function (entry) {
      if (entry && entry.id) byId[entry.id] = entry;
    });
    (preferEntries || []).forEach(function (local) {
      if (!local || !local.id) return;
      var prev = byId[local.id];
      var normalized = ensureSurveyFullyPublic(normalizeRegistryEntry(local));
      var labelRev = Math.max(
        registryLabelRevision(normalized),
        registryLabelRevision(prev),
        bumpLabelRevision ? Date.now() : 0
      );
      var orderRev = Math.max(
        registryOrderRevision(normalized),
        registryOrderRevision(prev),
        Date.now()
      );
      byId[local.id] = Object.assign({}, prev, normalized, {
        label: coerceText(normalized.label)
          ? normalized.label
          : prev && prev.label,
        url: coerceText(normalized.url) ? normalized.url : prev && prev.url,
        listOrder:
          normalized.listOrder != null
            ? normalized.listOrder
            : prev && prev.listOrder,
        orderUpdatedAt: orderRev,
        labelUpdatedAt: bumpLabelRevision
          ? labelRev
          : normalized.labelUpdatedAt != null
            ? normalized.labelUpdatedAt
            : prev && prev.labelUpdatedAt,
        updatedAt: bumpLabelRevision
          ? labelRev
          : prev && prev.updatedAt,
      });
    });
    return dedupeRegistryEntries(
      Object.keys(byId).map(function (id) {
        return byId[id];
      })
    );
  }

  function pinRegistryEntryAfterEdit(registry, entry) {
    if (!entry || !entry.id) return registry || [];
    var list = (registry || []).slice();
    var idx = list.findIndex(function (item) {
      return item && item.id === entry.id;
    });
    var label = coerceText(entry.label);
    var url = coerceText(entry.url);
    var stamp = Math.max(registryLabelRevision(entry), Date.now());
    var pinned = ensureSurveyFullyPublic(
      normalizeRegistryEntry(Object.assign({}, entry, { updatedAt: stamp }))
    );
    if (idx < 0) {
      list.push(pinned);
      return dedupeRegistryEntries(list);
    }
    list[idx] = Object.assign({}, list[idx], pinned, {
      label: label || list[idx].label,
      url: url || list[idx].url,
      updatedAt: stamp,
      labelUpdatedAt: stamp,
    });
    return dedupeRegistryEntries(list);
  }

  async function syncRegistryEntryAfterEdit(entry) {
    if (!entry || !entry.id) throw new Error("저장할 설문 정보가 없습니다.");
    var stamp = Date.now();
    var saved = ensureSurveyFullyPublic(
      normalizeRegistryEntry(
        Object.assign({}, entry, {
          updatedAt: stamp,
          labelUpdatedAt: stamp,
        })
      )
    );
    var list = dedupeRegistryEntries(loadRegistry());
    var idx = list.findIndex(function (item) {
      return item && item.id === saved.id;
    });
    if (idx >= 0) list[idx] = Object.assign({}, list[idx], saved);
    else list.push(saved);
    saveRegistry(list, { silent: true });

    var publishResult = { ok: true, skipped: true, reason: "no-webapp" };
    try {
      publishResult = await publishRegistryEntry(saved);
    } catch (pubErr) {
      publishResult = {
        ok: false,
        error: (pubErr && pubErr.message) || String(pubErr),
      };
    }

    var merged = list;
    try {
      merged = await refreshRegistryFromServer({
        silent: true,
        preferLocalEntries: [saved],
      });
    } catch (refreshErr) {
      merged = applyRegistryEntriesPreferLocal(loadRegistry(), [saved], {
        bumpLabelRevision: true,
      });
      merged = pinRegistryEntryAfterEdit(merged, saved);
      saveRegistry(merged);
      return {
        entry: saved,
        publish: publishResult,
        registry: merged,
        refreshError: (refreshErr && refreshErr.message) || String(refreshErr),
      };
    }

    merged = applyRegistryEntriesPreferLocal(merged, [saved], {
      bumpLabelRevision: true,
    });
    merged = pinRegistryEntryAfterEdit(merged, saved);
    saveRegistry(merged);
    var bulkPublish = { ok: true, skipped: true, reason: "no-webapp", published: 0 };
    try {
      bulkPublish = await syncRegistryAllToServer();
    } catch (bulkErr) {
      bulkPublish = {
        ok: false,
        error: (bulkErr && bulkErr.message) || String(bulkErr),
        published: 0,
      };
    }
    var pinned = merged.find(function (item) {
      return item && item.id === saved.id;
    });
    return {
      entry: pinned || saved,
      publish: publishResult,
      bulkPublish: bulkPublish,
      registry: merged,
    };
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
    var posted = await postToWebApp(webAppUrl, {
      action: "delete",
      surveyId: id,
    });
    if (posted.opaque) {
      return { ok: true, opaque: true };
    }
    var data = await readJsonResponse(posted.response);
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
    var liveResult = await removeRegistryEntryFromLive(id);
    var warnings = [];
    if (liveResult && liveResult.skipped) {
      warnings.push(
        "웹 앱 URL이 없어 SurveyRegistry 시트에는 반영되지 않았습니다. 다른 PC 목록은 GitHub 공개 JSON·시트 동기화에 의존합니다."
      );
    } else if (liveResult && liveResult.ok === false) {
      warnings.push(liveResult.error || "SurveyRegistry 삭제 실패");
    }
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
    normalizeSurveyAnswerText: normalizeSurveyAnswerText,
    applyKoreanAnswerSpacing: applyKoreanAnswerSpacing,
    applyKoreanOrthography: applyKoreanOrthography,
    decodeHtmlEntities: decodeHtmlEntities,
    repairUtf8FromLatin1: repairUtf8FromLatin1,
    normalizeRegistryEntry: normalizeRegistryEntry,
    hasSheetSource: hasSheetSource,
    ensureSurveyFullyPublic: ensureSurveyFullyPublic,
    loadRegistry: loadRegistry,
    saveRegistry: saveRegistry,
    fetchBundledSheetRegistry: fetchBundledSheetRegistry,
    fetchLiveRegistryFromSheet: fetchLiveRegistryFromSheet,
    fetchLiveRegistryFromWebApp: fetchLiveRegistryFromWebApp,
    fetchLiveRegistry: fetchLiveRegistry,
    isRegistrySpreadsheetId: isRegistrySpreadsheetId,
    publishRegistryEntry: publishRegistryEntry,
    removeRegistryEntryFromLive: removeRegistryEntryFromLive,
    toPublicRegistrySnapshot: toPublicRegistrySnapshot,
    sortRegistryEntriesForDisplay: sortRegistryEntriesForDisplay,
    nextRegistryListOrder: nextRegistryListOrder,
    isSurveyCompleted: isSurveyCompleted,
    defaultSurveyStatus: defaultSurveyStatus,
    setSurveyStatus: setSurveyStatus,
    setSurveyStatusAsync: setSurveyStatusAsync,
    initSurveyConfig: initSurveyConfig,
    fetchBundledSurveyConfig: fetchBundledSurveyConfig,
    probeWebAppHealth: probeWebAppHealth,
    syncRegistryAllToServer: syncRegistryAllToServer,
    refreshRegistryFromServer: refreshRegistryFromServer,
    applyRegistryEntriesPreferLocal: applyRegistryEntriesPreferLocal,
    syncRegistryEntryAfterEdit: syncRegistryEntryAfterEdit,
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

