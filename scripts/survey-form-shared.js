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
    var list = Object.keys(map)
      .sort(function (a, b) {
        return Number(a) - Number(b);
      })
      .map(function (k) {
        return map[k];
      });
    if (list.length) return list;
    return defaultClassOptions();
  }

  function defaultClassOptions() {
    var out = [];
    for (var i = 1; i <= 8; i++) out.push({ 반: i, label: i + "반", count: 0 });
    return out;
  }

  function deriveNumberOptions(roster, ban) {
    var banNum = Number(ban);
    if (!Number.isFinite(banNum)) return [];
    var seen = {};
    var nums = [];
    roster.forEach(function (s) {
      if (s.반 !== banNum || !Number.isFinite(s.번호)) return;
      var key = String(s.번호);
      if (seen[key]) return;
      seen[key] = true;
      nums.push(s.번호);
    });
    nums.sort(function (a, b) {
      return a - b;
    });
    if (nums.length) return nums;
    for (var i = 1; i <= 45; i++) nums.push(i);
    return nums;
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

  var QUESTION_TYPE_GROUPS = [
    {
      label: "텍스트",
      types: [
        { value: "text", label: "단답형" },
        { value: "textarea", label: "장문형" },
        { value: "number", label: "숫자" },
        { value: "email", label: "이메일" },
      ],
    },
    {
      label: "선택",
      types: [
        { value: "radio", label: "객관식 (단일 선택)" },
        { value: "checkbox", label: "체크박스 (복수 선택)" },
        { value: "dropdown", label: "드롭다운" },
        { value: "rank", label: "순위형" },
      ],
    },
    {
      label: "척도·등급",
      types: [
        { value: "likert", label: "선형 배율 (리커트)" },
        { value: "rating", label: "별점 등급" },
      ],
    },
    {
      label: "표 (그리드)",
      types: [
        { value: "radio_grid", label: "객관식 그리드" },
        { value: "checkbox_grid", label: "체크박스 그리드" },
      ],
    },
    {
      label: "날짜·시간",
      types: [
        { value: "date", label: "날짜" },
        { value: "time", label: "시간" },
      ],
    },
    {
      label: "구성",
      types: [{ value: "section", label: "섹션 (구분·안내)" }],
    },
  ];

  var QUESTION_TYPES = [];
  QUESTION_TYPE_GROUPS.forEach(function (g) {
    QUESTION_TYPES = QUESTION_TYPES.concat(g.types);
  });

  function isSectionQuestion(q) {
    return q && q.type === "section";
  }

  function isAnswerableQuestion(q) {
    return q && !isSectionQuestion(q);
  }

  function answerableQuestions(questions) {
    return (questions || []).filter(isAnswerableQuestion);
  }

  function questionNeedsOptions(type) {
    return type === "radio" || type === "dropdown" || type === "checkbox" || type === "rank";
  }

  function questionNeedsGrid(type) {
    return type === "radio_grid" || type === "checkbox_grid";
  }

  function normalizeGridRows(q) {
    if (q && q.gridRows && q.gridRows.length) {
      return normalizeOptions(q.gridRows);
    }
    return normalizeOptions(q && q.options);
  }

  function normalizeGridColumns(q) {
    if (q && q.gridColumns && q.gridColumns.length) {
      return normalizeOptions(q.gridColumns);
    }
    return [];
  }

  function defaultRatingConfig() {
    return { ratingMax: 5 };
  }

  function questionTypeLabel(type) {
    var found = QUESTION_TYPES.find(function (t) {
      return t.value === type;
    });
    return found ? found.label : type || "문항";
  }

  function renderQuestionTypeOptions(selected) {
    return QUESTION_TYPE_GROUPS.map(function (group) {
      return (
        '<optgroup label="' +
        esc(group.label) +
        '">' +
        group.types
          .map(function (t) {
            return (
              '<option value="' +
              t.value +
              '"' +
              (selected === t.value ? " selected" : "") +
              ">" +
              esc(t.label) +
              "</option>"
            );
          })
          .join("") +
        "</optgroup>"
      );
    }).join("");
  }

  function parseGridAnswer(saved) {
    var out = {};
    if (!saved) return out;
    saved.split("|").forEach(function (part) {
      var idx = part.indexOf(":");
      if (idx < 0) return;
      var row = part.slice(0, idx).trim();
      var val = part.slice(idx + 1).trim();
      if (row) out[row] = val;
    });
    return out;
  }

  function formatGridAnswer(map) {
    return Object.keys(map)
      .filter(function (k) {
        return map[k];
      })
      .map(function (k) {
        return k + ": " + map[k];
      })
      .join(" | ");
  }

  function parseCheckboxGridAnswer(saved) {
    var out = {};
    if (!saved) return out;
    saved.split("|").forEach(function (part) {
      var idx = part.indexOf(":");
      if (idx < 0) return;
      var row = part.slice(0, idx).trim();
      var val = part.slice(idx + 1).trim();
      if (row) out[row] = val;
    });
    return out;
  }

  function normalizeOptions(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map(coerceText).filter(Boolean);
    }
    return String(raw)
      .split(/\r?\n/)
      .map(coerceText)
      .filter(Boolean);
  }

  function defaultLikertConfig() {
    return {
      likertMin: 1,
      likertMax: 5,
      likertMinLabel: "전혀 그렇지 않다",
      likertMaxLabel: "매우 그렇다",
    };
  }

  function likertPoints(q) {
    var cfg = Object.assign(defaultLikertConfig(), q || {});
    var min = Number(cfg.likertMin);
    var max = Number(cfg.likertMax);
    if (!Number.isFinite(min)) min = 1;
    if (!Number.isFinite(max)) max = 5;
    if (max < min) max = min;
    var points = [];
    for (var i = min; i <= max; i++) points.push(i);
    return points;
  }

  function collectAnswerFromElement(q, root) {
    root = root || document;
    if (!q || isSectionQuestion(q)) return "";
    var type = q.type || "textarea";
    if (type === "checkbox") {
      var boxes = root.querySelectorAll('[data-qid="' + q.id + '"]:checked');
      var vals = [];
      Array.prototype.forEach.call(boxes, function (el) {
        if (el.value !== "__other__") vals.push(el.value);
      });
      var otherEl = root.querySelector('[data-other-for="' + q.id + '"]');
      if (otherEl && otherEl.value.trim()) vals.push("기타: " + otherEl.value.trim());
      return vals.join(", ");
    }
    if (type === "radio" || type === "likert" || type === "rating") {
      var picked = root.querySelector('[name="' + q.id + '"]:checked');
      if (!picked) return "";
      if (picked.value === "__other__") {
        var other = root.querySelector('[data-other-for="' + q.id + '"]');
        return other && other.value.trim() ? "기타: " + other.value.trim() : "";
      }
      return coerceText(picked.value);
    }
    if (type === "radio_grid") {
      var rows = normalizeGridRows(q);
      var cols = normalizeGridColumns(q);
      var map = {};
      rows.forEach(function (row, ri) {
        var sel = root.querySelector('[name="' + q.id + "_row_" + ri + '"]:checked');
        if (sel) map[row] = sel.value;
      });
      if (!cols.length) return "";
      return formatGridAnswer(map);
    }
    if (type === "checkbox_grid") {
      var gridRows = normalizeGridRows(q);
      var map2 = {};
      gridRows.forEach(function (row, ri) {
        var checked = root.querySelectorAll('[data-grid-row="' + q.id + "_" + ri + '"]:checked');
        var parts = Array.prototype.map.call(checked, function (el) {
          return el.value;
        });
        if (parts.length) map2[row] = parts.join(", ");
      });
      return formatGridAnswer(map2);
    }
    if (type === "rank") {
      var items = root.querySelectorAll('[data-rank-item="' + q.id + '"]');
      var ordered = Array.prototype.map.call(items, function (el) {
        return { label: el.getAttribute("data-label") || "", order: Number(el.getAttribute("data-order")) || 0 };
      });
      ordered.sort(function (a, b) {
        return a.order - b.order;
      });
      return ordered
        .map(function (x) {
          return x.label;
        })
        .filter(Boolean)
        .join(" > ");
    }
    var el = root.querySelector('[name="' + q.id + '"]');
    return el ? coerceText(el.value) : "";
  }

  function isQuestionAnswered(q, root) {
    if (!q) return true;
    if (q.required === false || isSectionQuestion(q)) return true;
    var type = q.type || "textarea";
    if (type === "checkbox") {
      if (root.querySelector('[data-qid="' + q.id + '"]:checked')) return true;
      var otherOnly = root.querySelector('[data-other-for="' + q.id + '"]');
      return !!(otherOnly && otherOnly.value.trim());
    }
    if (type === "radio" || type === "likert" || type === "rating") {
      var picked = root.querySelector('[name="' + q.id + '"]:checked');
      if (!picked) return false;
      if (picked.value === "__other__") {
        var other = root.querySelector('[data-other-for="' + q.id + '"]');
        return !!(other && other.value.trim());
      }
      return true;
    }
    if (type === "radio_grid") {
      var rows = normalizeGridRows(q);
      if (!rows.length) return true;
      for (var i = 0; i < rows.length; i++) {
        if (!root.querySelector('[name="' + q.id + "_row_" + i + '"]:checked')) return false;
      }
      return true;
    }
    if (type === "checkbox_grid") {
      var gridRows = normalizeGridRows(q);
      if (!gridRows.length) return true;
      for (var j = 0; j < gridRows.length; j++) {
        if (!root.querySelector('[data-grid-row="' + q.id + "_" + j + '"]:checked')) return false;
      }
      return true;
    }
    if (type === "rank") {
      var options = normalizeOptions(q.options);
      if (!options.length) return true;
      var items = root.querySelectorAll('[data-rank-item="' + q.id + '"]');
      return items.length === options.length;
    }
    if (type === "email") {
      var emailVal = collectAnswerFromElement(q, root);
      return !!emailVal && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal);
    }
    if (type === "number") {
      var numVal = collectAnswerFromElement(q, root);
      if (!numVal) return false;
      var n = Number(numVal);
      if (!Number.isFinite(n)) return false;
      if (q.numberMin != null && n < Number(q.numberMin)) return false;
      if (q.numberMax != null && n > Number(q.numberMax)) return false;
      return true;
    }
    var value = collectAnswerFromElement(q, root);
    return !!value;
  }

  function isAnswerValueValid(q, value) {
    if (!q || q.required === false || isSectionQuestion(q)) return true;
    value = coerceText(value);
    if (!value) return false;
    if (q.type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (q.type === "number") {
      var n = Number(value);
      if (!Number.isFinite(n)) return false;
      if (q.numberMin != null && n < Number(q.numberMin)) return false;
      if (q.numberMax != null && n > Number(q.numberMax)) return false;
      return true;
    }
    if (q.type === "radio_grid" || q.type === "checkbox_grid") {
      var rows = normalizeGridRows(q);
      if (!rows.length) return true;
      return value.split("|").filter(Boolean).length >= rows.length;
    }
    if (q.type === "rank") {
      var options = normalizeOptions(q.options);
      if (!options.length) return true;
      return value.split(" > ").filter(Boolean).length >= options.length;
    }
    return true;
  }
    if (!q || !q.description) return "";
    return '<p class="q-desc">' + esc(q.description) + "</p>";
  }

  function renderRankListHtml(q, saved) {
    var options = normalizeOptions(q.options);
    var order = [];
    if (saved && saved.indexOf(" > ") >= 0) {
      order = saved.split(" > ").map(function (s) {
        return s.trim();
      }).filter(Boolean);
    }
    options.forEach(function (opt) {
      if (order.indexOf(opt) < 0) order.push(opt);
    });
    return (
      '<div class="rank-list" data-rank-group="' +
      esc(q.id) +
      '">' +
      order
        .map(function (opt, idx) {
          return (
            '<div class="rank-item" data-rank-item="' +
            esc(q.id) +
            '" data-label="' +
            esc(opt) +
            '" data-order="' +
            idx +
            '"><span class="rank-badge">' +
            (idx + 1) +
            '</span><span class="rank-label">' +
            esc(opt) +
            '</span><div class="rank-actions"><button type="button" data-rank-up aria-label="위로">↑</button><button type="button" data-rank-down aria-label="아래로">↓</button></div></div>'
          );
        })
        .join("") +
      '</div><p class="rank-hint">↑ ↓ 버튼으로 순위를 바꿀 수 있습니다.</p>'
    );
  }

  function renderQuestionFieldHtml(q, saved) {
    saved = saved == null ? "" : String(saved);
    if (isSectionQuestion(q)) {
      return (
        '<div class="section-block">' +
        '<p class="section-title">' +
        esc(q.label || "섹션") +
        "</p>" +
        (q.description ? '<p class="section-desc">' + esc(q.description) + "</p>" : "") +
        "</div>"
      );
    }
    var type = q.type || "textarea";
    var options = normalizeOptions(q.options);
    var html = renderQuestionDescription(q);

    if (type === "textarea" || !type) {
      return html + '<textarea id="q_' + esc(q.id) + '" name="' + esc(q.id) + '" rows="4">' + esc(saved) + "</textarea>";
    }
    if (type === "text") {
      return html + '<input type="text" id="q_' + esc(q.id) + '" name="' + esc(q.id) + '" value="' + esc(saved) + '" />';
    }
    if (type === "number") {
      var minAttr = q.numberMin != null ? ' min="' + esc(q.numberMin) + '"' : "";
      var maxAttr = q.numberMax != null ? ' max="' + esc(q.numberMax) + '"' : "";
      return html + '<input type="number" id="q_' + esc(q.id) + '" name="' + esc(q.id) + '" value="' + esc(saved) + '"' + minAttr + maxAttr + " />";
    }
    if (type === "email") {
      return html + '<input type="email" id="q_' + esc(q.id) + '" name="' + esc(q.id) + '" value="' + esc(saved) + '" placeholder="example@email.com" />';
    }
    if (type === "date") {
      return html + '<input type="date" id="q_' + esc(q.id) + '" name="' + esc(q.id) + '" value="' + esc(saved) + '" />';
    }
    if (type === "time") {
      return html + '<input type="time" id="q_' + esc(q.id) + '" name="' + esc(q.id) + '" value="' + esc(saved) + '" />';
    }
    if (type === "dropdown") {
      var dopts =
        '<option value="">선택하세요</option>' +
        options
          .map(function (opt) {
            return '<option value="' + esc(opt) + '"' + (saved === opt ? " selected" : "") + ">" + esc(opt) + "</option>";
          })
          .join("");
      if (q.allowOther) dopts += '<option value="__other__"' + (saved.indexOf("기타:") === 0 ? " selected" : "") + ">기타</option>";
      var otherVal = saved.indexOf("기타:") === 0 ? saved.replace(/^기타:\s*/, "") : "";
      return (
        html +
        '<select id="q_' +
        esc(q.id) +
        '" name="' +
        esc(q.id) +
        '" data-has-other="' +
        (q.allowOther ? "1" : "0") +
        '">' +
        dopts +
        '</select><input type="text" class="other-input" data-other-for="' +
        esc(q.id) +
        '" placeholder="기타 내용 입력" value="' +
        esc(otherVal) +
        '" hidden />'
      );
    }
    if (type === "radio") {
      var picked = saved.indexOf("기타:") === 0 ? "__other__" : saved;
      var otherText = saved.indexOf("기타:") === 0 ? saved.replace(/^기타:\s*/, "") : "";
      html += '<div class="choice-list">';
      html += options
        .map(function (opt, idx) {
          var inputId = "q_" + q.id + "_" + idx;
          return (
            '<label class="choice-item" for="' +
            inputId +
            '"><input type="radio" id="' +
            inputId +
            '" name="' +
            esc(q.id) +
            '" value="' +
            esc(opt) +
            '"' +
            (saved === opt ? " checked" : "") +
            " />" +
            esc(opt) +
            "</label>"
          );
        })
        .join("");
      if (q.allowOther) {
        html +=
          '<label class="choice-item"><input type="radio" name="' +
          esc(q.id) +
          '" value="__other__"' +
          (picked === "__other__" ? " checked" : "") +
          ' />기타</label><input type="text" class="other-input" data-other-for="' +
          esc(q.id) +
          '" placeholder="기타 내용" value="' +
          esc(otherText) +
          '" />';
      }
      return html + "</div>";
    }
    if (type === "checkbox") {
      var pickedList = saved ? saved.split(",").map(function (s) { return s.trim(); }) : [];
      html += '<div class="choice-list">';
      html += options
        .map(function (opt, idx) {
          var inputId = "q_" + q.id + "_" + idx;
          return (
            '<label class="choice-item" for="' +
            inputId +
            '"><input type="checkbox" id="' +
            inputId +
            '" data-qid="' +
            esc(q.id) +
            '" value="' +
            esc(opt) +
            '"' +
            (pickedList.indexOf(opt) >= 0 ? " checked" : "") +
            " />" +
            esc(opt) +
            "</label>"
          );
        })
        .join("");
      if (q.allowOther) {
        var otherChecked = pickedList.some(function (v) { return v.indexOf("기타:") === 0; });
        var otherVal2 = otherChecked ? pickedList.find(function (v) { return v.indexOf("기타:") === 0; }).replace(/^기타:\s*/, "") : "";
        html +=
          '<label class="choice-item"><input type="checkbox" data-qid="' +
          esc(q.id) +
          '" value="__other__"' +
          (otherChecked ? " checked" : "") +
          ' data-other-toggle="' +
          esc(q.id) +
          '" />기타</label><input type="text" class="other-input" data-other-for="' +
          esc(q.id) +
          '" value="' +
          esc(otherVal2) +
          '" />';
      }
      return html + "</div>";
    }
    if (type === "likert") {
      var points = likertPoints(q);
      var cfg = Object.assign(defaultLikertConfig(), q);
      html +=
        '<div class="likert-wrap"><div class="likert-labels"><span>' +
        esc(cfg.likertMinLabel) +
        "</span><span>" +
        esc(cfg.likertMaxLabel) +
        '</span></div><div class="likert-scale">' +
        points
          .map(function (pt, idx) {
            var inputId = "q_" + q.id + "_" + idx;
            return (
              '<div class="likert-option"><label for="' +
              inputId +
              '"><input type="radio" id="' +
              inputId +
              '" name="' +
              esc(q.id) +
              '" value="' +
              pt +
              '"' +
              (String(saved) === String(pt) ? " checked" : "") +
              " />" +
              pt +
              "</label></div>"
            );
          })
          .join("") +
        "</div></div>";
      return html;
    }
    if (type === "rating") {
      var max = Number(q.ratingMax) || 5;
      if (max < 3) max = 3;
      if (max > 10) max = 10;
      html += '<div class="rating-wrap" data-rating-max="' + max + '">';
      for (var s = 1; s <= max; s++) {
        var sid = "q_" + q.id + "_s" + s;
        html +=
          '<label class="rating-star" for="' +
          sid +
          '"><input type="radio" id="' +
          sid +
          '" name="' +
          esc(q.id) +
          '" value="' +
          s +
          '"' +
          (String(saved) === String(s) ? " checked" : "") +
          ' /><span aria-hidden="true">★</span><span class="rating-num">' +
          s +
          "</span></label>";
      }
      return html + "</div>";
    }
    if (type === "rank") {
      return html + renderRankListHtml(q, saved);
    }
    if (type === "radio_grid") {
      var grow = normalizeGridRows(q);
      var gcol = normalizeGridColumns(q);
      var gmap = parseGridAnswer(saved);
      html += '<div class="grid-wrap"><div class="grid-scroll"><table class="grid-table"><thead><tr><th></th>';
      html += gcol.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("");
      html += "</tr></thead><tbody>";
      html += grow
        .map(function (row, ri) {
          var rowVal = gmap[row] || "";
          return (
            "<tr><th scope=\"row\">" +
            esc(row) +
            "</th>" +
            gcol
              .map(function (col, ci) {
                var rid = "q_" + q.id + "_r" + ri + "_c" + ci;
                return (
                  '<td><label class="grid-cell" for="' +
                  rid +
                  '"><input type="radio" id="' +
                  rid +
                  '" name="' +
                  esc(q.id + "_row_" + ri) +
                  '" value="' +
                  esc(col) +
                  '"' +
                  (rowVal === col ? " checked" : "") +
                  " /></label></td>"
                );
              })
              .join("") +
            "</tr>"
          );
        })
        .join("");
      return html + "</tbody></table></div></div>";
    }
    if (type === "checkbox_grid") {
      var grow2 = normalizeGridRows(q);
      var gcol2 = normalizeGridColumns(q);
      var gmap2 = parseCheckboxGridAnswer(saved);
      html += '<div class="grid-wrap"><div class="grid-scroll"><table class="grid-table"><thead><tr><th></th>';
      html += gcol2.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("");
      html += "</tr></thead><tbody>";
      html += grow2
        .map(function (row, ri) {
          var rowParts = (gmap2[row] || "").split(",").map(function (s) { return s.trim(); });
          return (
            "<tr><th scope=\"row\">" +
            esc(row) +
            "</th>" +
            gcol2
              .map(function (col, ci) {
                var cid = "q_" + q.id + "_r" + ri + "_c" + ci;
                return (
                  '<td><label class="grid-cell" for="' +
                  cid +
                  '"><input type="checkbox" id="' +
                  cid +
                  '" data-grid-row="' +
                  esc(q.id + "_" + ri) +
                  '" value="' +
                  esc(col) +
                  '"' +
                  (rowParts.indexOf(col) >= 0 ? " checked" : "") +
                  " /></label></td>"
                );
              })
              .join("") +
            "</tr>"
          );
        })
        .join("");
      return html + "</tbody></table></div></div>";
    }
    return html + '<input type="text" name="' + esc(q.id) + '" value="' + esc(saved) + '" />';
  }

  function bindQuestionFieldControls(q, root) {
    root = root || document;
    if (!q) return;
    if (q.type === "dropdown" && q.allowOther) {
      var sel = root.querySelector('[name="' + q.id + '"]');
      var other = root.querySelector('[data-other-for="' + q.id + '"]');
      if (sel && other) {
        function syncOther() {
          other.hidden = sel.value !== "__other__";
        }
        sel.addEventListener("change", syncOther);
        syncOther();
      }
    }
    if ((q.type === "radio" || q.type === "checkbox") && q.allowOther) {
      var otherInput = root.querySelector('[data-other-for="' + q.id + '"]');
      if (otherInput) {
        root.querySelectorAll('[name="' + q.id + '"], [data-other-toggle="' + q.id + '"]').forEach(function (el) {
          el.addEventListener("change", function () {
            var show =
              !!root.querySelector('[name="' + q.id + '"][value="__other__"]:checked') ||
              !!root.querySelector('[data-other-toggle="' + q.id + '"]:checked');
            otherInput.hidden = !show;
          });
        });
      }
    }
  }

  function questionCategories(entry) {
    var qs = answerableQuestions((entry && entry.questions) || []);
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
    var questions = answerableQuestions(entry.questions || []);
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
    QUESTION_TYPES: QUESTION_TYPES,
    QUESTION_TYPE_GROUPS: QUESTION_TYPE_GROUPS,
    isSectionQuestion: isSectionQuestion,
    isAnswerableQuestion: isAnswerableQuestion,
    answerableQuestions: answerableQuestions,
    questionNeedsOptions: questionNeedsOptions,
    questionNeedsGrid: questionNeedsGrid,
    normalizeOptions: normalizeOptions,
    normalizeGridRows: normalizeGridRows,
    normalizeGridColumns: normalizeGridColumns,
    defaultLikertConfig: defaultLikertConfig,
    defaultRatingConfig: defaultRatingConfig,
    likertPoints: likertPoints,
    questionTypeLabel: questionTypeLabel,
    renderQuestionTypeOptions: renderQuestionTypeOptions,
    collectAnswerFromElement: collectAnswerFromElement,
    isQuestionAnswered: isQuestionAnswered,
    isAnswerValueValid: isAnswerValueValid,
    renderQuestionFieldHtml: renderQuestionFieldHtml,
    bindQuestionFieldControls: bindQuestionFieldControls,
    esc: esc,
    loadRegistry: loadRegistry,
    saveRegistry: saveRegistry,
    findSurvey: findSurvey,
    parseStudentId: parseStudentId,
    formatStudentId: formatStudentId,
    fetchRosterRows: fetchRosterRows,
    deriveClassOptions: deriveClassOptions,
    defaultClassOptions: defaultClassOptions,
    deriveNumberOptions: deriveNumberOptions,
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
