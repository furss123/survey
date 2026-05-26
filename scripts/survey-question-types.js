(function (global) {
  "use strict";

  var esc =
    global.SurveyForm && global.SurveyForm.esc
      ? global.SurveyForm.esc
      : function (s) {
          var d = document.createElement("div");
          d.textContent = s == null ? "" : String(s);
          return d.innerHTML;
        };

  var TYPE_DEFS = [
    { id: "section", label: "제목 및 설명", group: "레이아웃", hasInput: false },
    { id: "text", label: "단답형", group: "기본" },
    { id: "textarea", label: "장문형", group: "기본" },
    { id: "email", label: "이메일", group: "기본" },
    { id: "number", label: "숫자", group: "기본" },
    { id: "url", label: "URL", group: "기본" },
    { id: "date", label: "날짜", group: "날짜·시간" },
    { id: "time", label: "시간", group: "날짜·시간" },
    { id: "datetime", label: "날짜 및 시간", group: "날짜·시간" },
    { id: "radio", label: "객관식", group: "선택" },
    { id: "checkbox", label: "체크박스", group: "선택" },
    { id: "dropdown", label: "드롭다운", group: "선택" },
    { id: "scale", label: "선형 배율", group: "선택" },
    { id: "grid_radio", label: "객관식 격자", group: "격자" },
    { id: "grid_checkbox", label: "체크박스 격자", group: "격자" },
  ];

  function coerceText(v) {
    return v == null ? "" : String(v).trim();
  }

  function defaultOptions(type) {
    if (type === "scale") {
      return { min: 1, max: 5, minLabel: "매우 불만족", maxLabel: "매우 만족" };
    }
    if (type === "grid_radio" || type === "grid_checkbox") {
      return {
        rows: ["항목 1", "항목 2"],
        cols: ["1", "2", "3", "4", "5"],
      };
    }
    if (type === "radio" || type === "checkbox" || type === "dropdown") {
      return { choices: ["선택지 1", "선택지 2", "선택지 3"], allowOther: false, otherLabel: "기타" };
    }
    return {};
  }

  function normalizeQuestion(q) {
    q = q || {};
    var type = q.type || "textarea";
    if (type === "paragraph") type = "textarea";
    var options = Object.assign({}, defaultOptions(type), q.options || {});
    if (type === "radio" || type === "checkbox" || type === "dropdown") {
      if (!options.choices || !options.choices.length) {
        options.choices = defaultOptions(type).choices;
      }
    }
    return {
      id: q.id || "q" + Date.now(),
      label: q.label || "",
      description: q.description || "",
      type: type,
      required: q.required !== false && type !== "section",
      options: options,
    };
  }

  function typeDef(type) {
    for (var i = 0; i < TYPE_DEFS.length; i++) {
      if (TYPE_DEFS[i].id === type) return TYPE_DEFS[i];
    }
    return null;
  }

  function hasInput(type) {
    var def = typeDef(type);
    return def ? def.hasInput !== false : true;
  }

  function parseLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(coerceText)
      .filter(Boolean);
  }

  function joinLines(arr) {
    return (arr || []).join("\n");
  }

  function ensureMinLines(arr, min) {
    arr = (arr || []).slice();
    min = min == null ? 2 : min;
    while (arr.length < min) arr.push("");
    return arr;
  }

  function readLineListFromRow(row, role) {
    var ul = row.querySelector('[data-line-list="' + role + '"]');
    if (!ul) return [];
    return Array.prototype.map
      .call(ul.querySelectorAll(".sq-line-input"), function (inp) {
        return coerceText(inp.value);
      })
      .filter(Boolean);
  }

  function readAdminOptionsFromDom(row) {
    return {
      choices: readLineListFromRow(row, "choices"),
      rows: readLineListFromRow(row, "grid-rows"),
      cols: readLineListFromRow(row, "grid-cols"),
      allowOther: !!(row.querySelector(".q-allow-other") || {}).checked,
      otherLabel: coerceText((row.querySelector(".q-other-label") || {}).value) || "기타",
      min: Number((row.querySelector(".q-scale-min") || {}).value),
      max: Number((row.querySelector(".q-scale-max") || {}).value),
      minLabel: coerceText((row.querySelector(".q-scale-min-label") || {}).value),
      maxLabel: coerceText((row.querySelector(".q-scale-max-label") || {}).value),
    };
  }

  function renderLineListHtml(items, role, placeholder, addLabel) {
    items = ensureMinLines(items, 2);
    var html =
      '<ul class="sq-line-list" data-line-list="' +
      esc(role) +
      '">';
    items.forEach(function (val, i) {
      html +=
        '<li class="sq-line-item"><input type="text" class="sq-line-input field-input" value="' +
        esc(val) +
        '" placeholder="' +
        esc(placeholder) +
        " " +
        (i + 1) +
        '" /><button type="button" class="btn sq-line-remove" title="삭제" aria-label="삭제">×</button></li>";
    });
    html +=
      "</ul><button type=\"button\" class=\"btn sq-line-add\" data-line-list=\"" +
      esc(role) +
      '">' +
      esc(addLabel) +
      "</button>";
    return html;
  }

  function bindLineListEditors(row, onChange) {
    onChange = onChange || function () {};

    function bindRemove(btn) {
      btn.addEventListener("click", function () {
        var li = btn.closest(".sq-line-item");
        var ul = li && li.parentElement;
        if (!ul || !ul.hasAttribute("data-line-list")) return;
        if (ul.querySelectorAll(".sq-line-item").length <= 1) {
          var inp = li.querySelector(".sq-line-input");
          if (inp) inp.value = "";
          onChange();
          return;
        }
        li.remove();
        onChange();
      });
    }

    row.querySelectorAll(".sq-line-remove").forEach(bindRemove);

    row.querySelectorAll(".sq-line-add").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var role = btn.getAttribute("data-line-list");
        var ul = row.querySelector('[data-line-list="' + role + '"]');
        if (!ul) return;
        var n = ul.querySelectorAll(".sq-line-item").length + 1;
        var placeholder =
          role === "choices"
            ? "선택지"
            : role === "grid-rows"
              ? "행 항목"
              : "열 선택지";
        var li = document.createElement("li");
        li.className = "sq-line-item";
        li.innerHTML =
          '<input type="text" class="sq-line-input field-input" value="" placeholder="' +
          esc(placeholder) +
          " " +
          n +
          '" /><button type="button" class="btn sq-line-remove" title="삭제" aria-label="삭제">×</button>';
        ul.appendChild(li);
        bindRemove(li.querySelector(".sq-line-remove"));
        var inp = li.querySelector(".sq-line-input");
        if (inp) inp.focus();
        onChange();
      });
    });
  }

  function disablePreviewInputs(root) {
    if (!root) return;
    root.querySelectorAll("input, textarea, select, button").forEach(function (el) {
      el.disabled = true;
      el.tabIndex = -1;
    });
  }

  function renderAdminPreview(row) {
    var host = row.querySelector(".sq-admin-preview-body");
    if (!host) return;
    try {
      var q = readAdminQuestionFromRow(row);
      host.innerHTML = renderRespondField(q, 0);
      disablePreviewInputs(host);
    } catch (e) {
      host.innerHTML = '<p class="sq-type-hint">미리보기를 표시할 수 없습니다.</p>';
    }
  }

  function fieldName(q, suffix) {
    return suffix ? q.id + "__" + suffix : q.id;
  }

  function renderRespondField(q, idx) {
    q = normalizeQuestion(q);
    var req = q.required && hasInput(q.type) ? ' <span class="sq-required">*</span>' : "";
    var desc = q.description
      ? '<p class="sq-desc">' + esc(q.description) + "</p>"
      : "";

    if (q.type === "section") {
      return (
        '<div class="sq-block sq-section" data-qid="' +
        esc(q.id) +
        '"><p class="sq-title">' +
        esc(q.label || "섹션") +
        "</p>" +
        desc +
        "</div>"
      );
    }

    var inner = "";
    var opts = q.options || {};

    if (q.type === "textarea") {
      inner = '<textarea name="' + esc(q.id) + '" rows="4"></textarea>';
    } else if (q.type === "text" || q.type === "email" || q.type === "url" || q.type === "number") {
      inner =
        '<input type="' +
        (q.type === "text" ? "text" : q.type) +
        '" name="' +
        esc(q.id) +
        '" />';
    } else if (q.type === "date" || q.type === "time" || q.type === "datetime") {
      inner =
        '<input type="' +
        (q.type === "datetime" ? "datetime-local" : q.type) +
        '" name="' +
        esc(q.id) +
        '" />';
    } else if (q.type === "dropdown") {
      inner =
        '<select name="' +
        esc(q.id) +
        '"><option value="">선택하세요</option>' +
        (opts.choices || [])
          .map(function (c) {
            return '<option value="' + esc(c) + '">' + esc(c) + "</option>";
          })
          .join("") +
        (opts.allowOther ? '<option value="__other__">' + esc(opts.otherLabel || "기타") + "</option>" : "") +
        "</select>";
      if (opts.allowOther) {
        inner +=
          '<input type="text" class="sq-other-input" name="' +
          esc(q.id) +
          '__other" placeholder="기타 내용" hidden />';
      }
    } else if (q.type === "radio" || q.type === "checkbox") {
      inner = '<ul class="sq-choice-list">';
      (opts.choices || []).forEach(function (c, ci) {
        var inputType = q.type === "radio" ? "radio" : "checkbox";
        var name = q.type === "radio" ? esc(q.id) : esc(q.id) + "[]";
        inner +=
          "<li><label><input type=\"" +
          inputType +
          '" name="' +
          name +
          '" value="' +
          esc(c) +
          '" /> ' +
          esc(c) +
          "</label></li>";
      });
      if (opts.allowOther) {
        var otherName = q.type === "radio" ? esc(q.id) : esc(q.id) + "[]";
        inner +=
          "<li><label><input type=\"" +
          (q.type === "radio" ? "radio" : "checkbox") +
          '" name="' +
          otherName +
          '" value="__other__" data-other-toggle="' +
          esc(q.id) +
          '" /> ' +
          esc(opts.otherLabel || "기타") +
          '</label><input type="text" class="sq-other-input" name="' +
          esc(q.id) +
          '__other" placeholder="기타 내용" hidden /></li>';
      }
      inner += "</ul>";
    } else if (q.type === "scale") {
      var min = Number(opts.min) || 1;
      var max = Number(opts.max) || 5;
      if (max < min) max = min;
      inner =
        '<p class="sq-scale"><span class="sq-scale-end">' +
        esc(opts.minLabel || "") +
        '</span><span class="sq-scale-options">';
      for (var n = min; n <= max; n++) {
        inner +=
          '<label><input type="radio" name="' +
          esc(q.id) +
          '" value="' +
          n +
          '" />' +
          n +
          "</label>";
      }
      inner +=
        '</span><span class="sq-scale-end">' +
        esc(opts.maxLabel || "") +
        "</span></p>";
    } else if (q.type === "grid_radio" || q.type === "grid_checkbox") {
      var rows = opts.rows || [];
      var cols = opts.cols || [];
      inner = '<div class="sq-grid-wrap"><table class="sq-grid"><thead><tr><th></th>';
      cols.forEach(function (c) {
        inner += "<th>" + esc(c) + "</th>";
      });
      inner += "</tr></thead><tbody>";
      rows.forEach(function (row, ri) {
        inner += '<tr><td class="sq-grid-row-label">' + esc(row) + "</td>";
        cols.forEach(function (c) {
          var inputType = q.type === "grid_radio" ? "radio" : "checkbox";
          var name =
            q.type === "grid_radio"
              ? esc(fieldName(q, "r" + ri))
              : esc(fieldName(q, "r" + ri)) + "[]";
          inner +=
            '<td><input type="' +
            inputType +
            '" name="' +
            name +
            '" value="' +
            esc(c) +
            '" aria-label="' +
            esc(row + " " + c) +
            '" /></td>';
        });
        inner += "</tr>";
      });
      inner += "</tbody></table></div>";
    }

    if (!inner && hasInput(q.type)) {
      inner = '<textarea name="' + esc(q.id) + '" rows="4"></textarea>';
    }

    return (
      '<div class="sq-block" data-qid="' +
      esc(q.id) +
      '"><p class="sq-title">' +
      esc(q.label || "문항 " + (idx + 1)) +
      req +
      "</p>" +
      desc +
      inner +
      "</div>"
    );
  }

  function bindRespondInteractions(container) {
    if (!container) return;
    container.querySelectorAll("[data-other-toggle]").forEach(function (input) {
      input.addEventListener("change", function () {
        var qid = input.getAttribute("data-other-toggle");
        var other = container.querySelector('[name="' + qid + '__other"]');
        if (!other) return;
        var show = input.checked || input.value === "__other__";
        if (input.type === "radio") {
          show = input.checked && input.value === "__other__";
        }
        other.hidden = !show;
        if (!show) other.value = "";
      });
    });
    container.querySelectorAll('select[name]').forEach(function (sel) {
      sel.addEventListener("change", function () {
        var other = container.querySelector('[name="' + sel.name + '__other"]');
        if (!other) return;
        var show = sel.value === "__other__";
        other.hidden = !show;
        if (!show) other.value = "";
      });
    });
  }

  function collectAnswer(q, root) {
    q = normalizeQuestion(q);
    root = root || document;
    if (!hasInput(q.type)) return "";

    if (q.type === "checkbox") {
      var checked = root.querySelectorAll('[name="' + q.id + '[]"]:checked');
      var vals = Array.prototype.map.call(checked, function (el) {
        return el.value;
      });
      var otherVal = coerceText((root.querySelector('[name="' + q.id + '__other"]') || {}).value);
      return vals
        .map(function (v) {
          return v === "__other__" && otherVal ? otherVal : v === "__other__" ? "" : v;
        })
        .filter(Boolean)
        .join(", ");
    }

    if (q.type === "radio") {
      var picked = root.querySelector('[name="' + q.id + '"]:checked');
      if (!picked) return "";
      if (picked.value === "__other__") {
        return coerceText((root.querySelector('[name="' + q.id + '__other"]') || {}).value);
      }
      return picked.value;
    }

    if (q.type === "dropdown") {
      var sel = root.querySelector('[name="' + q.id + '"]');
      if (!sel) return "";
      if (sel.value === "__other__") {
        return coerceText((root.querySelector('[name="' + q.id + '__other"]') || {}).value);
      }
      return sel.value;
    }

    if (q.type === "grid_radio" || q.type === "grid_checkbox") {
      var rows = q.options.rows || [];
      var parts = [];
      rows.forEach(function (row, ri) {
        if (q.type === "grid_radio") {
          var r = root.querySelector('[name="' + fieldName(q, "r" + ri) + '"]:checked');
          if (r) parts.push(row + ": " + r.value);
        } else {
          var cs = root.querySelectorAll('[name="' + fieldName(q, "r" + ri) + '[]"]:checked');
          var cv = Array.prototype.map.call(cs, function (el) {
            return el.value;
          });
          if (cv.length) parts.push(row + ": " + cv.join(", "));
        }
      });
      return parts.join("; ");
    }

    var el = root.querySelector('[name="' + q.id + '"]');
    return el ? String(el.value || "").trim() : "";
  }

  function collectAllAnswers(questions, root) {
    var answers = {};
    (questions || []).forEach(function (q) {
      q = normalizeQuestion(q);
      if (!hasInput(q.type)) return;
      answers[q.id] = collectAnswer(q, root);
    });
    return answers;
  }

  function isEmptyAnswer(q, value) {
    return !coerceText(value);
  }

  function validateAnswer(q, value) {
    q = normalizeQuestion(q);
    if (!hasInput(q.type)) return "";
    if (q.required && isEmptyAnswer(q, value)) return "필수";

    if (!coerceText(value)) return "";

    if (q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "이메일 형식";
    }
    if (q.type === "url") {
      try {
        new URL(value.indexOf("://") >= 0 ? value : "https://" + value);
      } catch (e) {
        return "URL 형식";
      }
    }
    if (q.type === "grid_radio" || q.type === "grid_checkbox") {
      return "";
    }
    if (q.type === "number" && !Number.isFinite(Number(value))) {
      return "숫자 형식";
    }
    return "";
  }

  function countGridAnswered(q, root) {
    var rows = (q.options && q.options.rows) || [];
    var n = 0;
    rows.forEach(function (unused, ri) {
      if (q.type === "grid_radio") {
        if (root.querySelector('[name="' + fieldName(q, "r" + ri) + '"]:checked')) n++;
      } else if (
        root.querySelectorAll('[name="' + fieldName(q, "r" + ri) + '[]"]:checked').length
      ) {
        n++;
      }
    });
    return n;
  }

  function validateAll(questions, root) {
    var missing = [];
    var invalid = [];
    (questions || []).forEach(function (q) {
      q = normalizeQuestion(q);
      if (!hasInput(q.type)) return;
      if (q.type === "grid_radio" || q.type === "grid_checkbox") {
        var rows = (q.options && q.options.rows) || [];
        var filled = countGridAnswered(q, root);
        if (q.required && filled < rows.length) {
          missing.push(q.label || q.id);
        }
        return;
      }
      var val = collectAnswer(q, root);
      var err = validateAnswer(q, val);
      if (err === "필수") missing.push(q.label || q.id);
      else if (err) invalid.push((q.label || q.id) + " (" + err + ")");
    });
    return { missing: missing, invalid: invalid };
  }

  function buildTypeSelectHtml(selected) {
    var groups = {};
    TYPE_DEFS.forEach(function (t) {
      if (!groups[t.group]) groups[t.group] = [];
      groups[t.group].push(t);
    });
    var html = "";
    Object.keys(groups).forEach(function (g) {
      html += '<optgroup label="' + esc(g) + '">';
      groups[g].forEach(function (t) {
        html +=
          '<option value="' +
          t.id +
          '"' +
          (selected === t.id ? " selected" : "") +
          ">" +
          esc(t.label) +
          "</option>";
      });
      html += "</optgroup>";
    });
    return html;
  }

  function renderAdminOptionsPanel(type, options) {
    options = Object.assign({}, defaultOptions(type), options || {});
    if (type === "radio" || type === "checkbox" || type === "dropdown") {
      return (
        '<div class="sq-admin-options">' +
        "<label>선택지</label>" +
        renderLineListHtml(options.choices, "choices", "선택지", "+ 선택지 추가") +
        '<label><input type="checkbox" class="q-allow-other"' +
        (options.allowOther ? " checked" : "") +
        " /> 「기타」 항목 추가</label>" +
        '<label>기타 라벨</label><input type="text" class="q-other-label field-input" value="' +
        esc(options.otherLabel || "기타") +
        '" />' +
        "</div>"
      );
    }
    if (type === "scale") {
      return (
        '<div class="sq-admin-options">' +
        '<div class="sq-inline-row">' +
        '<div><label>최소</label><input type="number" class="q-scale-min" value="' +
        esc(options.min) +
        '" /></div>' +
        '<div><label>최대</label><input type="number" class="q-scale-max" value="' +
        esc(options.max) +
        '" /></div>' +
        "</div>" +
        '<label>왼쪽 라벨</label><input type="text" class="q-scale-min-label" value="' +
        esc(options.minLabel || "") +
        '" />' +
        '<label>오른쪽 라벨</label><input type="text" class="q-scale-max-label" value="' +
        esc(options.maxLabel || "") +
        '" />' +
        "</div>"
      );
    }
    if (type === "grid_radio" || type === "grid_checkbox") {
      return (
        '<div class="sq-admin-options">' +
        "<label>행 (질문 항목)</label>" +
        renderLineListHtml(options.rows, "grid-rows", "행 항목", "+ 행 추가") +
        "<label>열 (선택지)</label>" +
        renderLineListHtml(options.cols, "grid-cols", "열 선택지", "+ 열 추가") +
        "</div>"
      );
    }
    if (type === "section") {
      return '<p class="sq-type-hint">제목과 설명만 표시됩니다. 응답 입력은 없습니다.</p>';
    }
    return "";
  }

  function readAdminQuestionFromRow(row) {
    var type = row.querySelector(".q-type").value;
    var q = normalizeQuestion({
      id: row.dataset.qid,
      label: row.querySelector(".q-label").value.trim(),
      description: (row.querySelector(".q-description") || {}).value
        ? row.querySelector(".q-description").value.trim()
        : "",
      type: type,
      required: row.querySelector(".q-required").checked,
    });

    if (type === "radio" || type === "checkbox" || type === "dropdown") {
      var choices = readLineListFromRow(row, "choices");
      if (!choices.length) {
        choices = parseLines((row.querySelector(".q-choices") || {}).value);
      }
      q.options = {
        choices: choices,
        allowOther: !!(row.querySelector(".q-allow-other") || {}).checked,
        otherLabel: coerceText((row.querySelector(".q-other-label") || {}).value) || "기타",
      };
    } else if (type === "scale") {
      var scaleMin = Number((row.querySelector(".q-scale-min") || {}).value) || 1;
      var scaleMax = Number((row.querySelector(".q-scale-max") || {}).value) || 5;
      if (scaleMax < scaleMin) {
        var tmp = scaleMin;
        scaleMin = scaleMax;
        scaleMax = tmp;
      }
      q.options = {
        min: scaleMin,
        max: scaleMax,
        minLabel: coerceText((row.querySelector(".q-scale-min-label") || {}).value),
        maxLabel: coerceText((row.querySelector(".q-scale-max-label") || {}).value),
      };
    } else if (type === "grid_radio" || type === "grid_checkbox") {
      var rows = readLineListFromRow(row, "grid-rows");
      var cols = readLineListFromRow(row, "grid-cols");
      if (!rows.length) rows = parseLines((row.querySelector(".q-grid-rows") || {}).value);
      if (!cols.length) cols = parseLines((row.querySelector(".q-grid-cols") || {}).value);
      q.options = { rows: rows, cols: cols };
    }
    return normalizeQuestion(q);
  }

  function mountAdminQuestionRow(container, q, onRemove) {
    q = normalizeQuestion(q);
    var row = document.createElement("div");
    row.className = "q-row";
    row.dataset.qid = q.id;
    row.innerHTML =
      '<div class="q-row-head"><strong>문항</strong><div class="q-row-actions">' +
      '<button type="button" class="btn q-move-up" title="위로">↑</button>' +
      '<button type="button" class="btn q-move-down" title="아래로">↓</button>' +
      '<button type="button" class="btn btn-danger btn-remove">삭제</button></div></div>' +
      '<label>질문 유형</label><select class="q-type field-input">' +
      buildTypeSelectHtml(q.type) +
      "</select>" +
      '<label>질문</label><input type="text" class="q-label field-input" placeholder="질문을 입력하세요" />' +
      '<label>설명 (선택)</label><input type="text" class="q-description field-input" placeholder="도움말 텍스트" />' +
      '<div class="q-options-host"></div>' +
      '<div class="sq-admin-preview">' +
      '<p class="sq-admin-preview-title">학생 화면 미리보기</p>' +
      '<div class="sq-admin-preview-body"></div></div>' +
      '<label class="q-required-wrap"><input type="checkbox" class="q-required" /> 필수 응답</label>';

    row.querySelector(".q-label").value = q.label || "";
    row.querySelector(".q-description").value = q.description || "";
    row.querySelector(".q-required").checked = q.required !== false;
    if (q.type === "section") row.querySelector(".q-required-wrap").hidden = true;

    var cachedOptions = Object.assign({}, q.options || {});

    function refreshOptions() {
      var type = row.querySelector(".q-type").value;
      var host = row.querySelector(".q-options-host");
      var domOpts = readAdminOptionsFromDom(row);
      if (domOpts.choices.length) cachedOptions.choices = domOpts.choices;
      if (domOpts.rows.length) cachedOptions.rows = domOpts.rows;
      if (domOpts.cols.length) cachedOptions.cols = domOpts.cols;
      if (row.querySelector(".q-allow-other")) cachedOptions.allowOther = domOpts.allowOther;
      if (row.querySelector(".q-other-label")) cachedOptions.otherLabel = domOpts.otherLabel;
      if (row.querySelector(".q-scale-min")) cachedOptions.min = domOpts.min;
      if (row.querySelector(".q-scale-max")) cachedOptions.max = domOpts.max;
      if (row.querySelector(".q-scale-min-label")) cachedOptions.minLabel = domOpts.minLabel;
      if (row.querySelector(".q-scale-max-label")) cachedOptions.maxLabel = domOpts.maxLabel;
      host.innerHTML = renderAdminOptionsPanel(
        type,
        Object.assign({}, defaultOptions(type), cachedOptions)
      );
      row.querySelector(".q-required-wrap").hidden = type === "section";
      bindLineListEditors(row, schedulePreview);
      renderAdminPreview(row);
    }

    function schedulePreview() {
      var domOpts = readAdminOptionsFromDom(row);
      if (domOpts.choices.length) cachedOptions.choices = domOpts.choices;
      if (domOpts.rows.length) cachedOptions.rows = domOpts.rows;
      if (domOpts.cols.length) cachedOptions.cols = domOpts.cols;
      renderAdminPreview(row);
    }

    row.querySelector(".q-type").addEventListener("change", refreshOptions);
    row.querySelector(".q-label").addEventListener("input", schedulePreview);
    row.querySelector(".q-description").addEventListener("input", schedulePreview);
    row.querySelector(".q-required").addEventListener("change", schedulePreview);
    row.querySelector(".q-options-host").addEventListener("input", schedulePreview);
    row.querySelector(".q-options-host").addEventListener("change", schedulePreview);
    row.querySelector(".btn-remove").addEventListener("click", function () {
      row.remove();
      if (onRemove) onRemove();
    });
    row.querySelector(".q-move-up").addEventListener("click", function () {
      var prev = row.previousElementSibling;
      if (prev) container.insertBefore(row, prev);
    });
    row.querySelector(".q-move-down").addEventListener("click", function () {
      var next = row.nextElementSibling;
      if (next) container.insertBefore(next, row);
    });
    refreshOptions();
    container.appendChild(row);
    return row;
  }

  global.SurveyQuestions = {
    TYPE_DEFS: TYPE_DEFS,
    normalizeQuestion: normalizeQuestion,
    hasInput: hasInput,
    renderRespondField: renderRespondField,
    bindRespondInteractions: bindRespondInteractions,
    collectAllAnswers: collectAllAnswers,
    validateAll: validateAll,
    mountAdminQuestionRow: mountAdminQuestionRow,
    readAdminQuestionFromRow: readAdminQuestionFromRow,
    defaultOptions: defaultOptions,
  };
})(typeof window !== "undefined" ? window : this);
