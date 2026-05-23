(function (global) {
  "use strict";

  var NAV_ITEMS = [
    { page: "sheets", href: "admin.html", label: "시트 등록·관리" },
    { page: "survey", href: "admin-survey.html", label: "설문 등록" },
    { page: "home", href: "index.html", label: "설문 조회" },
  ];

  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function render(activePage) {
    return (
      '<nav class="admin-sidebar" aria-label="관리자 메뉴">' +
      '<p class="admin-sidebar-title">관리 메뉴</p>' +
      '<ul class="admin-sidebar-list">' +
      NAV_ITEMS.map(function (item) {
        var active = item.page === activePage ? " is-active" : "";
        return (
          '<li><a class="admin-sidebar-link' +
          active +
          '" href="' +
          esc(item.href) +
          '">' +
          esc(item.label) +
          "</a></li>"
        );
      }).join("") +
      "</ul></nav>"
    );
  }

  function mount(container, activePage) {
    if (!container) return;
    container.innerHTML = render(activePage);
  }

  global.AdminSidebar = {
    NAV_ITEMS: NAV_ITEMS,
    render: render,
    mount: mount,
  };
})(typeof window !== "undefined" ? window : this);
