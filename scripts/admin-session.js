(function (global) {
  "use strict";

  var ADMIN_SESSION_KEY = "school-admin-session-v1";
  var ADMIN_SESSION_ACTIVITY_KEY = "school-admin-session-activity-v1";
  var ADMIN_SESSION_TIMEOUT_MS = 60 * 60 * 1000;

  function getLastActivity() {
    var raw = sessionStorage.getItem(ADMIN_SESSION_ACTIVITY_KEY);
    if (!raw) return null;
    var n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }

  function touchAdminSession() {
    sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
    sessionStorage.setItem(ADMIN_SESSION_ACTIVITY_KEY, String(Date.now()));
  }

  function clearAdminSession() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ADMIN_SESSION_ACTIVITY_KEY);
  }

  function isAdminSessionValid() {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) !== "1") return false;
    var last = getLastActivity();
    if (!last) {
      clearAdminSession();
      return false;
    }
    if (Date.now() - last > ADMIN_SESSION_TIMEOUT_MS) {
      clearAdminSession();
      return false;
    }
    return true;
  }

  function logoutAdminSession() {
    clearAdminSession();
    location.replace("admin-login.html");
  }

  var activityBound = false;
  var throttleTimer = null;

  function bindAdminSessionActivity(options) {
    if (activityBound) return;
    activityBound = true;
    options = options || {};

    function onExpired() {
      if (options.onExpired) {
        options.onExpired();
        return;
      }
      alert("1시간 동안 활동이 없어 로그아웃되었습니다.");
      logoutAdminSession();
    }

    function bumpActivity() {
      if (!isAdminSessionValid()) {
        onExpired();
        return;
      }
      if (throttleTimer) return;
      touchAdminSession();
      throttleTimer = setTimeout(function () {
        throttleTimer = null;
      }, 30000);
    }

    ["mousedown", "keydown", "scroll", "touchstart", "click"].forEach(function (ev) {
      document.addEventListener(ev, bumpActivity, { passive: true });
    });

    setInterval(function () {
      if (!isAdminSessionValid()) onExpired();
    }, 60000);
  }

  function requireAdminSession(options) {
    if (!isAdminSessionValid()) {
      logoutAdminSession();
      return false;
    }
    touchAdminSession();
    if (!options || options.trackActivity !== false) {
      bindAdminSessionActivity(options);
    }
    return true;
  }

  global.AdminSession = {
    KEY: ADMIN_SESSION_KEY,
    ACTIVITY_KEY: ADMIN_SESSION_ACTIVITY_KEY,
    TIMEOUT_MS: ADMIN_SESSION_TIMEOUT_MS,
    touch: touchAdminSession,
    clear: clearAdminSession,
    isValid: isAdminSessionValid,
    require: requireAdminSession,
    bindActivity: bindAdminSessionActivity,
    logout: logoutAdminSession,
  };
})(typeof window !== "undefined" ? window : this);
