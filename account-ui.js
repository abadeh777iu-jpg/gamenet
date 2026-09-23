/**
 * account-ui.js — رابط فراموشی/بازیابی رمز + پنل سوپر ادمین
 * بدون دکمه‌های اضافه؛ فقط لینک «فراموشی رمز» زیر فرم ورود + هش‌روت‌ها:
 *   #forgot          فرم درخواست ایمیل بازیابی
 *   #reset/TOKEN     فرم تعویض رمز
 *   #super           پنل سوپر ادمین (نیاز به کلید ادمین)
 */
(function () {
  "use strict";

  function apiUrl() {
    return String(window.GAMENET_API || "").replace(/\/+$/, "");
  }

  // ─── styles ───────────────────────────────────────────
  var style = document.createElement("style");
  style.textContent = [
    ".ac-backdrop{position:fixed;inset:0;z-index:99999;background:#000c;backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px}",
    ".ac-card{width:min(440px,100%);background:#12121f;color:#f1f5f9;border:1px solid rgba(139,92,246,.4);border-radius:18px;padding:24px;box-shadow:0 24px 64px rgba(0,0,0,.55);font-family:Vazirmatn,system-ui,sans-serif}",
    ".ac-card.wide{width:min(920px,100%);max-height:90vh;overflow:auto}",
    ".ac-card h3{margin:0 0 8px;font-size:18px;background:linear-gradient(90deg,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}",
    ".ac-card p{color:#94a3b8;font-size:13px;line-height:1.7;margin:0 0 14px}",
    ".ac-card label{display:block;font-size:12px;color:#94a3b8;margin:10px 0 6px;font-weight:700}",
    ".ac-card input,.ac-card select{width:100%;box-sizing:border-box;background:#0a0a15;border:1px solid rgba(148,163,184,.3);color:#f1f5f9;border-radius:10px;padding:11px 12px;font-size:14px;direction:ltr;text-align:left}",
    ".ac-card input.fa,.ac-card input:not([dir]){direction:rtl;text-align:right}",
    ".ac-card input:focus{outline:none;border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,.25)}",
    ".ac-row{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}",
    ".ac-btn{flex:1;border:none;border-radius:10px;padding:12px;font-weight:800;font-size:13px;cursor:pointer;min-width:100px}",
    ".ac-btn.primary{background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff}",
    ".ac-btn.ghost{background:#ffffff12;color:#e2e8f0;border:1px solid #ffffff29}",
    ".ac-btn.danger{background:#ef444426;color:#ef4444;border:1px solid #ef44444d;flex:0 0 auto}",
    ".ac-btn.ok{background:#10b98126;color:#10b981;border:1px solid #10b9814d;flex:0 0 auto}",
    ".ac-msg{margin-top:12px;font-size:13px;padding:10px 12px;border-radius:10px;display:none}",
    ".ac-msg.show{display:block}",
    ".ac-msg.err{background:#ef444422;color:#fca5a5}",
    ".ac-msg.success{background:#10b98122;color:#6ee7b7}",
    ".ac-link{color:#a78bfa;background:none;border:none;cursor:pointer;font-size:12px;padding:6px 0;font-weight:700}",
    ".ac-link:hover{text-decoration:underline}",
    ".ac-forgot-wrap{display:flex;justify-content:space-between;align-items:center;margin-top:-6px;margin-bottom:4px}",
    ".ac-table{width:100%;border-collapse:collapse;font-size:13px;direction:rtl}",
    ".ac-table th,.ac-table td{padding:10px 8px;border-bottom:1px solid #ffffff14;text-align:right;vertical-align:middle}",
    ".ac-table th{color:#94a3b8;font-size:11px;font-weight:800}",
    ".ac-table tr:hover td{background:#ffffff08}",
    ".ac-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800}",
    ".ac-badge.active{background:#10b98122;color:#10b981}",
    ".ac-badge.pending{background:#f59e0b22;color:#f59e0b}",
    ".ac-badge.blocked{background:#ef444422;color:#ef4444}",
    ".ac-badge.expired{background:#94a3b822;color:#94a3b8}",
    ".ac-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px}",
    ".ac-stat{background:#0a0a15;border:1px solid #ffffff14;border-radius:12px;padding:12px;text-align:center}",
    ".ac-stat b{display:block;font-size:22px;background:linear-gradient(90deg,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}",
    ".ac-stat span{font-size:11px;color:#94a3b8}",
    ".ac-actions{display:flex;gap:6px;flex-wrap:wrap}",
    ".ac-actions .ac-btn{min-width:auto;padding:7px 10px;font-size:11px;flex:0 0 auto}",
    ".ac-fab{position:fixed;bottom:18px;right:18px;z-index:9990;width:48px;height:48px;border-radius:14px;border:none;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;font-size:20px;cursor:pointer;box-shadow:0 8px 24px rgba(139,92,246,.4)}",
    ".ac-search{width:100%;box-sizing:border-box;margin-bottom:12px;background:#0a0a15;border:1px solid #ffffff22;color:#f1f5f9;border-radius:10px;padding:10px 12px}",
    "@media(max-width:640px){.ac-table{font-size:11px}.ac-table th,.ac-table td{padding:8px 4px}}",
  ].join("\n");
  document.head.appendChild(style);

  // ─── helpers ──────────────────────────────────────────
  function api(path, method, body, adminKey) {
    var headers = { "Content-Type": "application/json" };
    if (adminKey) headers["X-Admin-Key"] = adminKey;
    return fetch(apiUrl() + path, {
      method: method || "GET",
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { status: r.status, data: d };
      });
    });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function closeOverlay() {
    var el = document.getElementById("ac-overlay");
    if (el) el.remove();
    if (location.hash.indexOf("#forgot") === 0 || location.hash.indexOf("#reset/") === 0) {
      history.replaceState("", "", location.pathname + location.search);
    }
  }

  function overlay(inner, wide) {
    closeOverlay();
    var wrap = document.createElement("div");
    wrap.className = "ac-backdrop";
    wrap.id = "ac-overlay";
    wrap.innerHTML = '<div class="ac-card' + (wide ? " wide" : "") + '">' + inner + "</div>";
    wrap.addEventListener("click", function (e) {
      if (e.target === wrap) closeOverlay();
    });
    document.body.appendChild(wrap);
    return wrap;
  }

  function msg(box, text, type) {
    var el = box.querySelector(".ac-msg");
    if (!el) {
      el = document.createElement("div");
      el.className = "ac-msg";
      box.appendChild(el);
    }
    el.className = "ac-msg show " + (type || "err");
    el.textContent = text;
  }

  // ─── forgot password ──────────────────────────────────
  function openForgot() {
    if (!apiUrl()) {
      alert("بازیابی رمز فعلاً در دسترس نیست");
      return;
    }
    var box = overlay(
      "<h3>🔑 فراموشی رمز عبور</h3>" +
        "<p>ایمیل حساب خود را وارد کنید. اگر ثبت شده باشد، لینک تعویض رمز برایتان می‌فرستیم.</p>" +
        '<label>ایمیل</label>' +
        '<input id="ac-forgot-email" type="email" dir="ltr" placeholder="you@example.com" />' +
        '<div class="ac-row">' +
        '<button class="ac-btn ghost" id="ac-forgot-cancel" type="button">انصراف</button>' +
        '<button class="ac-btn primary" id="ac-forgot-go" type="button">ارسال لینک بازیابی</button>' +
        "</div>" +
        '<div class="ac-msg"></div>'
    );
    box.querySelector("#ac-forgot-cancel").onclick = closeOverlay;
    box.querySelector("#ac-forgot-go").onclick = function () {
      var email = box.querySelector("#ac-forgot-email").value.trim();
      if (!email) return msg(box, "ایمیل را وارد کنید", "err");
      this.disabled = true;
      var btn = this;
      api("/api/forgot", "POST", { email: email }).then(function (r) {
        btn.disabled = false;
        if (r.status === 200) {
          msg(box, "اگر این ایمیل ثبت شده باشد، تا چند لحظه دیگر صندوق ورودی (و هرزنامه) را ببینید.", "success");
        } else {
          msg(box, (r.data && r.data.error) || "خطا؛ دوباره تلاش کنید", "err");
        }
      }).catch(function () {
        btn.disabled = false;
        msg(box, "خطا در ارتباط با سرور", "err");
      });
    };
    box.querySelector("#ac-forgot-email").focus();
  }

  // ─── reset password ───────────────────────────────────
  function openReset(token) {
    if (!token) return openForgot();
    var box = overlay(
      "<h3>🆕 تعویض رمز عبور</h3>" +
        "<p>رمز جدید را وارد کنید (حداقل ۶ کاراکتر). پس از تغییر، دوباره وارد شوید.</p>" +
        '<label>رمز جدید</label>' +
        '<input id="ac-reset-pass" type="password" dir="ltr" placeholder="حداقل ۶ کاراکتر" minlength="6" />' +
        '<label>تکرار رمز جدید</label>' +
        '<input id="ac-reset-pass2" type="password" dir="ltr" placeholder="تکرار" minlength="6" />' +
        '<div class="ac-row">' +
        '<button class="ac-btn ghost" id="ac-reset-cancel" type="button">انصراف</button>' +
        '<button class="ac-btn primary" id="ac-reset-go" type="button">ذخیره رمز جدید</button>' +
        "</div>" +
        '<div class="ac-msg"></div>'
    );
    box.querySelector("#ac-reset-cancel").onclick = closeOverlay;
    box.querySelector("#ac-reset-go").onclick = function () {
      var p1 = box.querySelector("#ac-reset-pass").value;
      var p2 = box.querySelector("#ac-reset-pass2").value;
      if (p1.length < 6) return msg(box, "رمز حداقل ۶ کاراکتر باشد", "err");
      if (p1 !== p2) return msg(box, "رمزها یکسان نیستند", "err");
      var btn = this;
      btn.disabled = true;
      api("/api/reset", "POST", { token: token, password: p1 }).then(function (r) {
        btn.disabled = false;
        if (r.status === 200) {
          msg(box, "رمز عوض شد…", "success");
          setTimeout(function () {
            closeOverlay();
            location.hash = "";
            location.reload();
          }, 900);
        } else {
          msg(box, (r.data && r.data.error) || "لینک نامعتبر یا منقضی", "err");
        }
      }).catch(function () {
        btn.disabled = false;
        msg(box, "خطا در ارتباط با سرور", "err");
      });
    };
    box.querySelector("#ac-reset-pass").focus();
  }

  // ─── inject forgot link on login form ────────────────
  function injectForgotLink() {
    var pw = document.querySelectorAll('input[type="password"]');
    // فقط فرم ورود (تک رمز) — نه ثبت‌نام (دو رمز)
    if (pw.length !== 1) return;
    var input = pw[0];
    var group = input.closest(".form-group") || input.parentElement;
    if (!group || group.querySelector(".ac-forgot-wrap")) return;
    // اگر فیلد ادمین است رد شو
    if (input.id === "admin-pass") return;
    var wrap = document.createElement("div");
    wrap.className = "ac-forgot-wrap";
    // لینک را بعد از گروه رمز درج کن
    group.parentNode.insertBefore(wrap, group.nextSibling);
    var a = document.createElement("button");
    a.type = "button";
    a.className = "ac-link";
    a.textContent = "فراموشی رمز عبور؟";
    a.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openForgot();
    });
    wrap.appendChild(a);
  }

  var observer = new MutationObserver(function () {
    try {
      injectForgotLink();
    } catch (e) {}
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", injectForgotLink);

  // ─── super admin panel ────────────────────────────────
  function adminKeyPrompt(cb) {
    var existing = sessionStorage.getItem("ac_admin_key") || localStorage.getItem("ac_admin_key") || "";
    var box = overlay(
      "<h3>🔐 ورود سوپر ادمین</h3>" +
        "<p>کلید دسترسی مدیریت را وارد کنید (همان رمز ادمین).</p>" +
        '<label>کلید ادمین</label>' +
        '<input id="ac-akey" type="password" dir="ltr" value="' + esc(existing) + '" />' +
        '<div class="ac-row">' +
        '<button class="ac-btn ghost" id="ac-acancel" type="button">انصراف</button>' +
        '<button class="ac-btn primary" id="ac-ag0" type="button">ورود</button>' +
        "</div>" +
        '<div class="ac-msg"></div>'
    );
    box.querySelector("#ac-acancel").onclick = closeOverlay;
    box.querySelector("#ac-ag0").onclick = function () {
      var key = box.querySelector("#ac-akey").value.trim();
      if (!key) return msg(box, "کلید را وارد کنید", "err");
      api("/api/admin/stats", "GET", null, key).then(function (r) {
        if (r.status !== 200) return msg(box, "کلید اشتباه است", "err");
        localStorage.setItem("ac_admin_key", key);
        sessionStorage.setItem("ac_admin_key", key);
        closeOverlay();
        cb(key, r.data);
      });
    };
    box.querySelector("#ac-akey").focus();
    box.querySelector("#ac-akey").onkeydown = function (e) {
      if (e.key === "Enter") box.querySelector("#ac-ag0").click();
    };
  }

  function badge(status) {
    var s = status || "pending";
    var t = { active: "فعال", pending: "در انتظار", blocked: "مسدود", expired: "منقضی" }[s] || s;
    return '<span class="ac-badge ' + esc(s) + '">' + esc(t) + "</span>";
  }

  function openSuper(key, stats) {
    var box = overlay(
      "<h3>👑 پنل سوپر ادمین</h3>" +
        '<div class="ac-stats" id="ac-stats"></div>' +
        '<input class="ac-search" id="ac-search" placeholder="جستجو: ایمیل، نام باشگاه، مالک…" />' +
        '<div id="ac-list"><p>در حال بارگذاری…</p></div>' +
        '<div class="ac-row">' +
        '<button class="ac-btn ghost" id="ac-refresh" type="button">🔄 بروزرسانی</button>' +
        '<button class="ac-btn ghost" id="ac-chgpass" type="button">🔑 تغییر رمز ادمین</button>' +
        '<button class="ac-btn primary" id="ac-close" type="button">بستن</button>' +
        "</div>" +
        '<div class="ac-msg"></div>',
      true
    );

    function renderStats(s) {
      if (!s) return;
      box.querySelector("#ac-stats").innerHTML =
        '<div class="ac-stat"><b>' + (s.total || 0) + "</b><span>کل مشتری‌ها</span></div>" +
        '<div class="ac-stat"><b>' + (s.active || 0) + "</b><span>فعال</span></div>" +
        '<div class="ac-stat"><b>' + (s.pending || 0) + "</b><span>در انتظار</span></div>" +
        '<div class="ac-stat"><b>' + (s.blocked || 0) + "</b><span>مسدود</span></div>" +
        '<div class="ac-stat"><b>' + (s.expired || 0) + "</b><span>منقضی</span></div>";
    }
    renderStats(stats);

    function load() {
      Promise.all([
        api("/api/admin/customers", "GET", null, key),
        api("/api/admin/stats", "GET", null, key),
      ]).then(function (rs) {
        if (rs[0].status !== 200) {
          box.querySelector("#ac-list").innerHTML = "<p>دسترسی رد شد. دوباره وارد شوید.</p>";
          return;
        }
        renderStats(rs[1].data);
        var db = rs[0].data.gamenets_db || {};
        renderList(db, box.querySelector("#ac-search").value);
        box._db = db;
      });
    }

    function renderList(db, q) {
      q = (q || "").toLowerCase().trim();
      var rows = Object.values(db).filter(function (u) {
        if (!q) return true;
        return [u.email, u.clubName, u.ownerName, u.phone]
          .join(" ")
          .toLowerCase()
          .indexOf(q) !== -1;
      });
      rows.sort(function (a, b) {
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
      if (!rows.length) {
        box.querySelector("#ac-list").innerHTML = "<p>مشتری‌ای پیدا نشد (هنوز ثبت‌نامی نیست یا فیلتر خالی است).</p>";
        return;
      }
      var html =
        '<div style="overflow:auto"><table class="ac-table"><thead><tr>' +
        "<th>مشتری</th><th>ایمیل</th><th>وضعیت</th><th>اعتبار</th><th>عملیات</th>" +
        "</tr></thead><tbody>";
      rows.forEach(function (u) {
        html +=
          "<tr>" +
          "<td><b>" + esc(u.clubName || "—") + "</b><br><span style='color:#94a3b8;font-size:11px'>" +
          esc(u.ownerName || "") + " · " + esc(u.phone || "") + "</span></td>" +
          '<td dir="ltr" style="text-align:left">' + esc(u.email) + "</td>" +
          "<td>" + badge(u.licenseStatus) + "</td>" +
          "<td style='font-size:11px;color:#94a3b8'>" +
          (u.licenseEndDate ? esc(String(u.licenseEndDate).slice(0, 10)) : "—") +
          "</td>" +
          '<td><div class="ac-actions">' +
          '<button class="ac-btn ok" data-act="days" data-id="' + u.id + '">+۳۰ روز</button>' +
          '<button class="ac-btn ghost" data-act="toggle" data-id="' + u.id + '">' +
          (u.licenseStatus === "blocked" ? "رفع مسدودی" : "مسدود") +
          "</button>" +
          '<button class="ac-btn ghost" data-act="link" data-id="' + u.id + '">لینک ریست</button>' +
          '<button class="ac-btn danger" data-act="resetpw" data-id="' + u.id + '">ریست رمز</button>' +
          '<button class="ac-btn danger" data-act="del" data-id="' + u.id + '" style="background:#dc262633;color:#f87171">🗑 حذف</button>' +
          "</div></td>" +
          "</tr>";
      });
      html += "</tbody></table></div>";
      box.querySelector("#ac-list").innerHTML = html;

      box.querySelectorAll("button[data-act]").forEach(function (btn) {
        btn.onclick = function () {
          var id = btn.getAttribute("data-id");
          var act = btn.getAttribute("data-act");
          var u = box._db && box._db[id];
          if (!u) return;

          if (act === "days") {
            var end = u.licenseEndDate && new Date(u.licenseEndDate) > new Date()
              ? new Date(u.licenseEndDate)
              : new Date();
            end.setDate(end.getDate() + 30);
            api("/api/admin/customers", "POST", {
              id: Number(id),
              licenseStatus: "active",
              licenseEndDate: end.toISOString(),
            }, key).then(function (r) {
              if (r.status === 200) {
                msg(box, "۳۰ روز به لایسنس اضافه شد", "success");
                load();
              } else msg(box, (r.data && r.data.error) || "خطا", "err");
            });
          } else if (act === "toggle") {
            var next = u.licenseStatus === "blocked" ? "active" : "blocked";
            api("/api/admin/customers", "POST", { id: Number(id), licenseStatus: next }, key).then(function (r) {
              if (r.status === 200) {
                msg(box, next === "blocked" ? "مسدود شد" : "رفع مسدودی شد", "success");
                load();
              } else msg(box, "خطا", "err");
            });
          } else if (act === "link") {
            api("/api/admin/reset-link", "POST", { id: Number(id) }, key).then(function (r) {
              if (r.status === 200 && r.data.link) {
                var link = r.data.link;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  navigator.clipboard.writeText(link).catch(function () {});
                }
                prompt("لینک بازیابی (کپی شد):", link);
              } else msg(box, (r.data && r.data.error) || "خطا", "err");
            });
          } else if (act === "resetpw") {
            var np = prompt("رمز جدید برای " + u.email + " (حداقل ۶ کاراکتر):");
            if (!np || np.length < 6) return;
            api("/api/admin/set-password", "POST", { id: Number(id), password: np }, key).then(function (r) {
              if (r.status === 200) msg(box, "رمز عوض شد: " + u.email, "success");
              else msg(box, (r.data && r.data.error) || "خطا", "err");
            });
          } else if (act === "del") {
            var okDel = confirm(
              "⚠️ حذف کامل «" + (u.clubName || u.email) + "»؟\n\n" +
              " - حساب مشتری\n" +
              " - همه داده‌ها (میز، جلسات، بوفه…)\n" +
              "این عملیات قابل بازگشت نیست."
            );
            if (!okDel) return;
            api("/api/admin/delete", "POST", { id: Number(id) }, key).then(function (r) {
              if (r.status === 200) {
                msg(box, r.data.message || "حذف شد", "success");
                load();
              } else msg(box, (r.data && r.data.error) || "خطا در حذف", "err");
            });
          }
        };
      });
    }

    box.querySelector("#ac-close").onclick = closeOverlay;
    box.querySelector("#ac-refresh").onclick = load;
    box.querySelector("#ac-search").oninput = function () {
      if (box._db) renderList(box._db, this.value);
    };
    box.querySelector("#ac-chgpass").onclick = function () {
      var cur = prompt("رمز فعلی ادمین:");
      if (cur == null) return;
      var nw = prompt("رمز جدید (حداقل ۶):");
      if (!nw || nw.length < 6) return;
      api("/api/admin/change-password", "POST", { current: cur, next: nw }, key).then(function (r) {
        if (r.status === 200) {
          localStorage.setItem("ac_admin_key", nw);
          sessionStorage.setItem("ac_admin_key", nw);
          msg(box, "رمز ادمین عوض شد", "success");
        } else msg(box, (r.data && r.data.error) || "خطا", "err");
      });
    };

    load();
  }

  function openSuperFlow() {
    if (!apiUrl()) {
      alert("سرور تنظیم نشده");
      return;
    }
    var saved = sessionStorage.getItem("ac_admin_key") || localStorage.getItem("ac_admin_key") || "";
    function tryOpen(key) {
      return api("/api/admin/stats", "GET", null, key).then(function (r) {
        if (r.status === 200) openSuper(key, r.data);
        else adminKeyPrompt(tryOpen);
      });
    }
    if (saved) tryOpen(saved);
    else adminKeyPrompt(tryOpen);
  }

  // دکمه شناور فقط در پنل ادمین (#admin)
  function ensureSuperFab() {
    var isAdmin =
      location.hash.indexOf("#admin") === 0 ||
      !!localStorage.getItem("admin_token");
    var fab = document.getElementById("ac-super-fab");
    if (isAdmin && !fab && apiUrl()) {
      fab = document.createElement("button");
      fab.id = "ac-super-fab";
      fab.className = "ac-fab";
      fab.title = "پنل سوپر ادمین";
      fab.textContent = "👑";
      fab.addEventListener("click", openSuperFlow);
      document.body.appendChild(fab);
    } else if (!isAdmin && fab) {
      fab.remove();
    }
  }
  window.addEventListener("hashchange", ensureSuperFab);
  document.addEventListener("DOMContentLoaded", ensureSuperFab);
  setInterval(ensureSuperFab, 2000);
  // اگر مستقیم با #admin باز شد
  setTimeout(ensureSuperFab, 500);

  // ─── hash routes ──────────────────────────────────────
  function handleHash() {
    var h = location.hash || "";
    if (h.indexOf("#forgot") === 0) openForgot();
    else if (h.indexOf("#reset/") === 0) openReset(h.slice(7));
    else if (h.indexOf("#super") === 0) openSuperFlow();
  }
  window.addEventListener("hashchange", handleHash);
  document.addEventListener("DOMContentLoaded", handleHash);
  if (document.readyState !== "loading") handleHash();
})();
