/**
 * auto-sync.js — همگام‌سازی خودکار و بی‌صدای داده‌ها با سرور (بدون هیچ دکمه‌ای)
 *
 * - بعد از ورود/ثبت‌نام (که از طریق سرور انجام شد)، داده‌های gn_* به‌صورت
 *   خودکار روی گیت‌هاب مالک ذخیره می‌شوند.
 * - هر تغییر با تأخیر کوتاه push می‌شود؛ هر ۶۰ ثانیه pull.
 * - هر کاربر فقط داده‌های خودش را می‌بیند (در سرور جدا می‌شود).
 */
(function () {
  "use strict";

  function apiUrl() { return String(window.GAMENET_API || "").replace(/\/+$/, ""); }
  var PULL_MS = 60000;
  var PUSH_MS = 1200;
  var applying = false;
  var pushTimer = null;
  var inFlight = false;
  var pending = false;

  function token() {
    try {
      return localStorage.getItem("gamenet_auth_token") || "";
    } catch (e) {
      return "";
    }
  }

  function user() {
    try {
      return JSON.parse(localStorage.getItem("gamenet_user") || "null");
    } catch (e) {
      return null;
    }
  }

  
  function isAdmin() {
    try {
      return !!localStorage.getItem("admin_token") && !!apiUrl();
    } catch (e) { return false; }
  }

  function adminKey() {
    return "admin123"; // با ADMIN_PASSWORD سرور یکی است
  }

  function adminPull() {
    if (!isAdmin()) return;
    fetch(apiUrl() + "/api/admin/customers", {
      headers: { "X-Admin-Key": adminKey() },
    })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (d) {
        if (!d || !d.gamenets_db) return;
        applying = true;
        try {
          localStorage.setItem("gamenets_db", JSON.stringify(d.gamenets_db));
        } finally {
          applying = false;
        }
      })
      .catch(function () {});
    // پرداخت‌های مشترک (رسیدها) را هم برای پنل مالک بیاور
    fetch(apiUrl() + "/api/admin/payments", {
      headers: { "X-Admin-Key": adminKey() },
    })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (d) {
        if (!d || !Array.isArray(d.payments)) return;
        applying = true;
        try {
          localStorage.setItem("gc_payments", JSON.stringify(d.payments));
        } finally {
          applying = false;
        }
      })
      .catch(function () {});
  }

  function adminPushPayments(paymentsJson) {
    if (!isAdmin()) return;
    try {
      var arr = JSON.parse(paymentsJson);
      if (!Array.isArray(arr)) return;
      fetch(apiUrl() + "/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey() },
        body: JSON.stringify({ payments: arr }),
      }).catch(function () {});
    } catch (e) {}
  }

  function adminPushDb(dbJson) {
    if (!isAdmin()) return;
    try {
      var db = JSON.parse(dbJson);
      fetch(apiUrl() + "/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey() },
        body: JSON.stringify({ db: db }),
      }).catch(function () {});
    } catch (e) {}
  }

function isDataKey(k) {
    return (
      typeof k === "string" &&
      (k.indexOf("gn_") === 0 ||
        k === "gc_plans" ||
        k === "gc_payments" ||
        k === "gc_system_settings" ||
        k === "gc_theme" ||
        k === "gc_buffet" ||
        k === "gc_tables" ||
        k === "gc_sessions" ||
        k === "gc_nextId" ||
        k === "gamenets_db")
    );
  }

  // کلیدهای فقط‌شخصی (روی گیت‌هاب به نام همین کاربر)
  function personalKey(k) {
    return k.indexOf("gn_") === 0;
  }

  function collectPushValues() {
    var t = token();
    var u = user();
    if (!t || !u) return null;
    var values = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!isDataKey(k)) continue;
      if (k === "gamenets_db") continue; // دیتابیس کاربران فقط از سرور می‌آید
      if (k.indexOf("gn_") === 0) {
        // فقط کلیدهای همین کاربر
        if (u && k.indexOf("gn_" + u.id + "_") !== 0) continue;
      }
      values[k] = localStorage.getItem(k);
    }
    return values;
  }

  function api(path, method, body) {
    return fetch(apiUrl() + path, {
      method: method || "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  function applyValues(values) {
    if (!values) return false;
    applying = true;
    var changed = false;
    try {
      for (var k in values) {
        if (!Object.prototype.hasOwnProperty.call(values, k)) continue;
        if (!isDataKey(k)) continue;
        var incoming = values[k];
        var local = localStorage.getItem(k);
        if (local !== incoming) {
          localStorage.setItem(k, incoming);
          changed = true;
        }
      }
    } finally {
      applying = false;
    }
    return changed;
  }

  function pull() {
    var t = token();
    if (!t || !apiUrl()) return Promise.resolve(false);
    return api("/api/pull", "GET")
      .then(function (res) {
        if (!res.ok) return false;
        return res.json().then(function (d) {
          applyValues(d.values);
          return true;
        });
      })
      .catch(function () {
        return false;
      });
  }

  function pushNow() {
    var t = token();
    if (!t || !apiUrl()) return Promise.resolve(false);
    if (inFlight) {
      pending = true;
      return Promise.resolve(false);
    }
    var values = collectPushValues();
    if (!values) return Promise.resolve(false);
    inFlight = true;
    return api("/api/push", "POST", { values: values })
      .then(function () {
        return true;
      })
      .catch(function () {
        return false;
      })
      .then(function (r) {
        inFlight = false;
        if (pending) {
          pending = false;
          setTimeout(pushNow, 400);
        }
        return r;
      });
  }

  function schedulePush() {
    if (!token() || !apiUrl()) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, PUSH_MS);
  }

  // جلوگیری از حلقه هنگام اعمال pull
  var origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    origSet.call(this, key, value);
    if (applying || window.__GS_APPLY) return;
    try {
      if (key === "gamenets_db" && isAdmin() && !window.__GS_APPLY) adminPushDb(value);
      if (key === "gc_payments" && isAdmin() && !window.__GS_APPLY) adminPushPayments(value);
      if (isDataKey(key) && token()) schedulePush();
    } catch (e) {
      /* ignore */
    }
  };

  window.addEventListener("online", function () {
    pull();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) pull();
  });

  // همگام‌سازی اولیه بعد از لاگین
  function boot() {
    if (!apiUrl()) return;
    if (isAdmin()) {
      adminPull();
      setInterval(adminPull, PULL_MS);
    }
    if (!token()) return;
    // gamenets_db را از سرور بیاور تا در دستگاه‌های جدید هم لاگین شود
    api("/api/bootstrap", "GET")
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (d) {
        if (!d) return;
        applying = true;
        try {
          if (d.gamenets_db) {
            localStorage.setItem("gamenets_db", JSON.stringify(d.gamenets_db));
          }
          if (d.user) {
            localStorage.setItem("gamenet_user", JSON.stringify(d.user));
          }
          applyValues(d.values);
        } finally {
          applying = false;
        }
        setInterval(pull, PULL_MS);
      })
      .catch(function () {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // API base را از متغیر سراسری یا تشخیص خودکار
  if (!apiUrl()) {
    // در صورت نیاز می‌توان اینجا آدرس Worker را ست کرد:
    // window.GAMENET_API = "https://gamenet-server.<account>.workers.dev";
    window.GAMENET_API = window.GAMENET_API || "";
  }
})();
