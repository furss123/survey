(function (global) {
  "use strict";

  function bindAdminRoster(options) {
    if (!global.SurveyForm) return;
    options = options || {};

    var loadConfig = options.loadConfig || SurveyForm.loadGlobalRosterConfig;
    var saveConfig = options.saveConfig || SurveyForm.saveGlobalRosterConfig;
    var clearConfig = options.clearConfig || SurveyForm.clearGlobalRosterConfig;

    var elSummary = document.getElementById(options.summaryId || "rosterSummary");
    var elPanel = document.getElementById(options.panelId || "rosterPanel");
    var elToggle = document.getElementById(options.toggleId || "btnToggleRoster");
    var elSheetUrl = document.getElementById(options.sheetUrlId || "rosterSheetUrl");
    var elSheetName = document.getElementById(options.sheetNameId || "rosterSheetName");
    var elFile = document.getElementById(options.fileId || "rosterFile");
    var elPreview = document.getElementById(options.previewId || "rosterPreview");
    var elLoad = document.getElementById(options.loadId || "btnLoadRoster");
    var elClear = document.getElementById(options.clearId || "btnClearRoster");
    var onStatus = options.onStatus || function () {};

    var state = {
      source: "",
      spreadsheetId: "",
      sheetName: "",
      label: "",
      students: [],
    };

    function updateSummary() {
      if (!elSummary) return;
      if (!state.source) {
        elSummary.textContent =
          options.emptyText ||
          "등록된 명렬표 없음 — 기본 학교 명렬표 또는 반·번호 목록을 사용합니다.";
        return;
      }
      var sum = SurveyForm.summarizeRoster(state.students);
      elSummary.textContent =
        (state.label || "명렬표") +
        " · 학생 " +
        sum.count +
        "명 · " +
        sum.classes +
        "개 반 (" +
        sum.classLabels.join(", ") +
        ")";
    }

    function showPreview(text, ok) {
      if (!elPreview) return;
      elPreview.textContent = text || "";
      elPreview.hidden = !text;
      elPreview.className = (options.previewClass || "roster-preview") + (ok ? " ok" : text ? " err" : "");
    }

    function applyState(data) {
      state = {
        source: (data && data.rosterSource) || (data && data.source) || "",
        spreadsheetId: (data && data.rosterSpreadsheetId) || (data && data.spreadsheetId) || "",
        sheetName: (data && data.rosterSheetName) || (data && data.sheetName) || "",
        label: (data && data.rosterLabel) || (data && data.label) || "",
        students: (data && data.rosterStudents) || (data && data.students) || [],
      };
      if (elSheetUrl && state.spreadsheetId) {
        elSheetUrl.value =
          "https://docs.google.com/spreadsheets/d/" + state.spreadsheetId + "/edit";
      }
      if (elSheetName) elSheetName.value = state.sheetName || "";
      updateSummary();
    }

    function persist() {
      saveConfig({
        rosterSource: state.source,
        rosterSpreadsheetId: state.spreadsheetId,
        rosterSheetName: state.sheetName,
        rosterLabel: state.label,
        rosterStudents: state.source === "file" ? state.students : [],
        updatedAt: new Date().toISOString(),
      });
    }

    async function loadFromInputs() {
      var urlInput = elSheetUrl ? elSheetUrl.value.trim() : "";
      var sheetName = elSheetName ? elSheetName.value.trim() : "";
      var file = elFile && elFile.files && elFile.files[0];
      var grade = SurveyForm.GRADE;
      try {
        var students = [];
        var label = "";
        if (file) {
          students = SurveyForm.parseRosterFromCsv(await file.text(), grade);
          label = file.name;
          if (!students.length) throw new Error("파일에서 학생 정보를 찾지 못했습니다.");
          state = {
            source: "file",
            spreadsheetId: "",
            sheetName: "",
            label: label,
            students: students,
          };
        } else if (urlInput) {
          var sheetId = SurveyForm.parseSpreadsheetIdFromUrl(urlInput);
          students = await SurveyForm.fetchRosterFromSpreadsheet(sheetId, sheetName || null, grade);
          label = "구글 시트";
          state = {
            source: "sheet",
            spreadsheetId: sheetId,
            sheetName: sheetName,
            label: label,
            students: students,
          };
        } else {
          throw new Error("구글 시트 주소 또는 CSV 파일을 입력해 주세요.");
        }
        persist();
        updateSummary();
        var sum = SurveyForm.summarizeRoster(state.students);
        showPreview(
          "인식 완료: " + sum.count + "명, " + sum.classes + "개 반 (" + sum.classLabels.join(", ") + ")",
          true
        );
        onStatus("명렬표를 저장했습니다. 설문 응답에 적용됩니다.", true);
      } catch (err) {
        showPreview(err.message || "명렬표 불러오기 실패", false);
        onStatus(err.message || "명렬표 불러오기 실패", false);
      }
    }

    function clearRoster() {
      clearConfig();
      state = { source: "", spreadsheetId: "", sheetName: "", label: "", students: [] };
      if (elSheetUrl) elSheetUrl.value = "";
      if (elSheetName) elSheetName.value = "";
      if (elFile) elFile.value = "";
      showPreview("", false);
      updateSummary();
      onStatus("명렬표 설정을 제거했습니다.", true);
    }

    async function initFromStorage() {
      var cfg = loadConfig();
      if (!cfg || !cfg.rosterSource) {
        updateSummary();
        return;
      }
      applyState(cfg);
      if (elPanel) elPanel.hidden = false;
      if (elToggle) elToggle.textContent = options.closeLabel || "명렬표 입력 닫기";
      if (
        cfg.rosterSource === "sheet" &&
        cfg.rosterSpreadsheetId &&
        (!cfg.rosterStudents || !cfg.rosterStudents.length)
      ) {
        try {
          state.students = await SurveyForm.fetchRosterFromSpreadsheet(
            cfg.rosterSpreadsheetId,
            cfg.rosterSheetName || null,
            SurveyForm.GRADE
          );
          updateSummary();
        } catch (err) {
          /* optional preview */
        }
      }
    }

    if (elToggle && elPanel) {
      elToggle.addEventListener("click", function () {
        elPanel.hidden = !elPanel.hidden;
        elToggle.textContent = elPanel.hidden
          ? options.openLabel || "학생 명렬표 추가"
          : options.closeLabel || "명렬표 입력 닫기";
      });
    }
    if (elLoad) elLoad.addEventListener("click", loadFromInputs);
    if (elClear) elClear.addEventListener("click", clearRoster);

    initFromStorage();
  }

  global.AdminRosterUI = {
    bind: bindAdminRoster,
  };
})(typeof window !== "undefined" ? window : this);
