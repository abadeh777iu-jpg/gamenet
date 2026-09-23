/**
 * gamenet-server — Cloudflare Worker
 * چندمستأجره + فراموشی رمز (ایمیل) + سوپر ادمین
 *
 * Secrets:
 *   GITHUB_TOKEN   — توکن گیت‌هاب (Contents write)
 *   RESEND_API_KEY — کلید Resend برای ارسال ایمیل (اختیاری ولی لازم برای بازیابی)
 *
 * Vars:
 *   GITHUB_REPO, GITHUB_BRANCH, ALLOWED_ORIGINS, EMAIL_FROM
 */

const USERS_PATH = "data/db/users.json";
const CUSTOMER_DIR = "data/db/customers";
const ADMIN_PATH = "data/db/admin.json";
const PAYMENTS_PATH = "data/db/payments.json"; // پرداخت‌های مشترک (مالک تأیید می‌کند)

// ─── short TTL cache (کاهش فشار روی GitHub / رفع 503 زیر بار) ───
const __cache = new Map(); // key -> {v, exp}
const CACHE_MS = 8000;
function cacheGet(key) {
  const e = __cache.get(key);
  if (e && e.exp > Date.now()) return e.v;
  return undefined;
}
function cacheSet(key, v) {
  __cache.set(key, { v, exp: Date.now() + CACHE_MS });
  if (__cache.size > 200) {
    const now = Date.now();
    for (const [k, e] of __cache) if (e.exp <= now) __cache.delete(k);
  }
}
function cacheDel(prefix) {
  for (const k of __cache.keys()) if (k.startsWith(prefix)) __cache.delete(k);
}

// ─── helpers ───────────────────────────────────────────────
function corsHeaders(env, req) {
  const origin = req.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const allow = allowed.includes(origin) ? origin : allowed[0] || "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function ok(env, req, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(env, req) },
  });
}

function err(env, req, status, message) {
  return ok(env, req, { error: message }, status);
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  return sha256Hex(`${salt}:${password}`);
}

function randomToken(bytes = 32) {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ─── GitHub contents API ──────────────────────────────────
async function gh(env, path, init = {}) {
  const [owner, repo] = env.GITHUB_REPO.split("/");
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "gamenet-server",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function ghRead(env, path) {
  const res = await gh(env, `${path}?t=${Date.now()}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  if (!json.content) return null;
  const b64 = String(json.content).replace(/\n/g, "");
  const raw = decodeURIComponent(
    Array.prototype.map
      .call(atob(b64), (ch) => "%" + ("00" + ch.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return { sha: json.sha, data: JSON.parse(raw) };
}

async function ghWrite(env, path, data, message, sha) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const body = { message, content, branch: env.GITHUB_BRANCH || "main" };
  if (sha) body.sha = sha;
  const res = await gh(env, path, { method: "PUT", body: JSON.stringify(body) });
  if (res.status === 409) {
    const fresh = await ghRead(env, path);
    return ghWrite(env, path, data, message, fresh?.sha);
  }
  if (!res.ok) throw new Error(`GitHub PUT ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return true;
}

async function readUsers(env) {
  const hit = cacheGet("users");
  if (hit) return hit;
  const f = await ghRead(env, USERS_PATH);
  const v = f?.data || { byId: {}, byEmail: {} };
  cacheSet("users", v);
  return v;
}

async function writeUsers(env, users, message) {
  const fresh = await ghRead(env, USERS_PATH);
  await ghWrite(env, USERS_PATH, users, message, fresh?.sha);
  cacheDel("users");
  cacheSet("users", users);
}

async function readCustomer(env, id) {
  const key = "cust:" + id;
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const f = await ghRead(env, `${CUSTOMER_DIR}/${id}.json`);
  const v = f?.data || null;
  cacheSet(key, v);
  return v;
}

async function writeCustomer(env, id, store, message) {
  const path = `${CUSTOMER_DIR}/${id}.json`;
  const fresh = await ghRead(env, path);
  await ghWrite(env, path, store, message, fresh?.sha);
  cacheDel("cust:" + id);
  cacheSet("cust:" + id, store);
}

async function readAdmin(env) {
  const f = await ghRead(env, ADMIN_PATH);
  return f?.data || null;
}

async function writeAdmin(env, data, message) {
  const fresh = await ghRead(env, ADMIN_PATH);
  await ghWrite(env, ADMIN_PATH, data, message, fresh?.sha);
}

// ─── email (Resend) ───────────────────────────────────────
async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY missing — skip email to", to);
    return false;
  }
  const candidates = [];
  if (env.EMAIL_FROM) candidates.push(env.EMAIL_FROM);
  candidates.push("Gamenet <onboarding@resend.dev>", "onboarding@resend.dev");

  let lastErr = "";
  for (const from of candidates) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "gamenet-server",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      console.log("email sent", j.id, "from", from, "to", to);
      return true;
    }
    lastErr = `${from}: ${res.status} ${(await res.text()).slice(0, 300)}`;
    console.error("Resend fail", lastErr);
  }
  throw new Error(lastErr || "Resend failed");
}

// ─── auth ─────────────────────────────────────────────────
function bearer(req) {
  const h = req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function requireUser(env, req) {
  const token = bearer(req);
  if (!token) return null;
  const users = await readUsers(env);
  const entry = Object.values(users.byId || {}).find((u) => u.sessionToken === token);
  if (!entry) return null;
  return { users, user: entry };
}

const PUBLIC_USER_FIELDS = [
  "id", "clubName", "ownerName", "email", "phone",
  "licenseStatus", "createdAt", "licenseEndDate", "licenseStartDate", "role",
];

function publicUser(u) {
  const o = {};
  for (const k of PUBLIC_USER_FIELDS) if (u[k] !== undefined) o[k] = u[k];
  return o;
}

function buildGamenetsDb(users) {
  const db = {};
  for (const u of Object.values(users.byId || {})) {
    const { passwordHash, passwordSalt, sessionToken, resetToken, resetExp, ...rest } = u;
    db[u.id] = rest;
  }
  return db;
}

function customerValues(store) {
  return (store && store.values) || {};
}

function readBody(req) {
  return req.json().catch(() => ({}));
}

// ─── register / login / session ───────────────────────────
async function handleRegister(env, req, body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !password || password.length < 4) {
    return err(env, req, 400, "ایمیل و رمز عبور (حداقل ۴ کاراکتر) لازم است");
  }
  const users = await readUsers(env);
  if (users.byEmail?.[email]) return err(env, req, 409, "این ایمیل قبلاً ثبت شده است");
  const id = Date.now();
  const salt = randomToken().slice(0, 16);
  const passwordHash = await hashPassword(password, salt);
  const user = {
    id,
    clubName: String(body.clubName || "").trim(),
    ownerName: String(body.ownerName || "").trim(),
    email,
    phone: String(body.phone || "").trim(),
    licenseStatus: "pending",
    createdAt: new Date().toISOString(),
    passwordSalt: salt,
    passwordHash,
    sessionToken: randomToken(),
  };
  users.byId = users.byId || {};
  users.byEmail = users.byEmail || {};
  users.byId[id] = user;
  users.byEmail[email] = id;
  await writeUsers(env, users, `register: ${email}`);
  await writeCustomer(env, id, { updatedAt: Date.now(), values: {} }, `init customer ${id}`);
  const pub = publicUser(user);
  return ok(env, req, { token: user.sessionToken, user: pub, values: {}, gamenets_db: buildGamenetsDb(users) }, 201);
}

async function handleLogin(env, req, body) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const users = await readUsers(env);
  const id = users.byEmail?.[email];
  const user = id != null ? users.byId?.[id] : null;
  if (!user) return err(env, req, 401, "ایمیل یا رمز عبور اشتباه است");
  const hash = await hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) return err(env, req, 401, "ایمیل یا رمز عبور اشتباه است");
  if (user.licenseStatus === "blocked") {
    return err(env, req, 403, "اکانت شما توسط مدیریت مسدود شده است. لطفاً با پشتیبانی تماس بگیرید.");
  }
  user.sessionToken = randomToken();
  await writeUsers(env, users, `login: ${email}`);
  const store = await readCustomer(env, id);
  return ok(env, req, {
    token: user.sessionToken,
    user: publicUser(user),
    values: customerValues(store),
    gamenets_db: buildGamenetsDb(users),
  });
}

async function handleBootstrap(env, req) {
  const auth = await requireUser(env, req);
  if (!auth) return err(env, req, 401, "unauthorized");
  const store = await readCustomer(env, auth.user.id);
  return ok(env, req, {
    user: publicUser(auth.user),
    values: customerValues(store),
    gamenets_db: buildGamenetsDb(auth.users),
    updatedAt: store?.updatedAt || 0,
  });
}

const MAX_VALUE_LEN = 2 * 1024 * 1024;
const MAX_TOTAL_LEN = 8 * 1024 * 1024;

async function handlePush(env, req, body) {
  const auth = await requireUser(env, req);
  if (!auth) return err(env, req, 401, "unauthorized");
  const values = body.values;
  if (!values || typeof values !== "object") return err(env, req, 400, "values لازم است");
  let total = 0;
  for (const [k, v] of Object.entries(values)) {
    if (typeof v !== "string") return err(env, req, 400, `مقدار ${k} باید رشته باشد`);
    total += v.length;
    if (v.length > MAX_VALUE_LEN) return err(env, req, 413, `مقدار ${k} خیلی بزرگ است`);
    if (!/^(gn_\d+_|gc_|gamenet_|admin_)/.test(k)) return err(env, req, 400, `کلید غیرمجاز: ${k}`);
  }
  if (total > MAX_TOTAL_LEN) return err(env, req, 413, "مجموع داده‌ها زیاد است");
  const store = (await readCustomer(env, auth.user.id)) || { updatedAt: 0, values: {} };
  store.values = store.values || {};
  Object.assign(store.values, values);
  store.updatedAt = Date.now();
  store.updatedBy = auth.user.id;
  await writeCustomer(env, auth.user.id, store, `sync user ${auth.user.id}`);
  if (body.user && typeof body.user === "object") {
    const allowed = ["clubName", "ownerName", "phone", "licenseStatus", "licenseEndDate"];
    for (const k of allowed) if (body.user[k] !== undefined) auth.users.byId[auth.user.id][k] = body.user[k];
    await writeUsers(env, auth.users, `profile sync ${auth.user.id}`);
  }
  return ok(env, req, { ok: true, updatedAt: store.updatedAt });
}

async function handlePull(env, req) {
  const auth = await requireUser(env, req);
  if (!auth) return err(env, req, 401, "unauthorized");
  const store = await readCustomer(env, auth.user.id);
  return ok(env, req, { values: customerValues(store), updatedAt: store?.updatedAt || 0 });
}

async function handleLogout(env, req) {
  const auth = await requireUser(env, req);
  if (auth) {
    auth.users.byId[auth.user.id].sessionToken = randomToken();
    await writeUsers(env, auth.users, `logout: ${auth.user.email}`);
  }
  return ok(env, req, { ok: true });
}

// ─── password recovery ────────────────────────────────────
async function handleForgot(env, req, body) {
  const email = String(body.email || "").trim().toLowerCase();
  const users = await readUsers(env);
  const id = users.byEmail?.[email];
  const user = id != null ? users.byId?.[id] : null;
  // همیشه پاسخ یکسان — تا ایمیل‌های موجود لو نرود
  const generic = { ok: true, message: "اگر این ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود" };
  if (!user) return ok(env, req, generic);

  const token = randomToken(24);
  user.resetToken = token;
  user.resetExp = Date.now() + 30 * 60 * 1000; // ۳۰ دقیقه
  await writeUsers(env, users, `forgot: ${email}`);

  const site = (env.SITE_URL || "https://abadeh777iu-jpg.github.io/gamenet/").replace(/\/+$/, "/");
  const link = `${site}#reset/${token}`;
  const html = `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0a0a15;color:#f1f5f9;border-radius:16px">
      <h2 style="background:linear-gradient(90deg,#8b5cf6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:0 0 12px">بازیابی رمز عبور</h2>
      <p>سلام <b>${(user.ownerName || user.clubName || "").replace(/[<>&]/g, "")}</b>،</p>
      <p>برای تعویض رمز عبور روی دکمه زیر بزنید. این لینک فقط <b>۳۰ دقیقه</b> معتبر است.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:bold;display:inline-block">تعویض رمز عبور</a>
      </p>
      <p style="font-size:12px;color:#94a3b8">اگر شما درخواست نداده‌اید، این ایمیل را نادیده بگیرید.</p>
      <p style="font-size:12px;color:#94a3b8;word-break:break-all">لینک: <a href="${link}" style="color:#a78bfa">${link}</a></p>
    </div>`;

  let sent = false;
  let sendError = "";
  try {
    sent = await sendEmail(env, email, "بازیابی رمز عبور — گیم‌نت کلاب انرژی", html);
  } catch (e) {
    sendError = String(e && e.message ? e.message : e);
    console.error("sendEmail threw", sendError);
  }
  if (!sent) {
    // توکن همچنان معتبر می‌ماند — ادمین می‌تواند لینک دستی بدهد
    console.log("email not sent", email, sendError, "token:", token);
  }
  // فقط برای دیباگ داخلی (پاسخ کاربر همان generic می‌ماند)
  return ok(env, req, { ...generic, _debug: { hasKey: !!env.RESEND_API_KEY, sent, sendError } });
}

async function handleReset(env, req, body) {
  const token = String(body.token || "").trim();
  const password = String(body.password || "");
  if (!token || !password || password.length < 6) {
    return err(env, req, 400, "توکن و رمز جدید (حداقل ۶ کاراکتر) لازم است");
  }
  const users = await readUsers(env);
  const user = Object.values(users.byId || {}).find((u) => u.resetToken === token);
  if (!user) return err(env, req, 400, "لینک نامعتبر است. دوباره درخواست بدهید.");
  if (!user.resetExp || user.resetExp < Date.now()) {
    return err(env, req, 400, "لینک منقضی شده. دوباره درخواست بدهید.");
  }
  const salt = randomToken().slice(0, 16);
  user.passwordSalt = salt;
  user.passwordHash = await hashPassword(password, salt);
  user.resetToken = null;
  user.resetExp = null;
  user.sessionToken = randomToken(); // خروج همه نشست‌ها
  await writeUsers(env, users, `reset password: ${user.email}`);
  return ok(env, req, { ok: true, message: "رمز عبور با موفقیت تغییر کرد. اکنون وارد شوید." });
}

// ─── super admin ──────────────────────────────────────────
async function getAdminPassword(env) {
  const f = await readAdmin(env);
  if (f && f.passwordHash && f.passwordSalt) return f;
  // ایجاد/مهاجرت از پیش‌فرض
  const salt = randomToken().slice(0, 16);
  const data = {
    passwordSalt: salt,
    passwordHash: await hashPassword(env.ADMIN_PASSWORD || "admin123", salt),
    updatedAt: Date.now(),
  };
  try {
    await writeAdmin(env, data, "init admin password");
  } catch (e) {
    console.error("admin init", e);
  }
  return data;
}

function adminOk(env, req) {
  const key = req.headers.get("X-Admin-Key") || bearer(req) || "";
  const want = env.ADMIN_PASSWORD || "admin123";
  return key === want;
}

async function adminOkAsync(env, req) {
  const key = req.headers.get("X-Admin-Key") || bearer(req) || "";
  if (!key) return false;
  const admin = await getAdminPassword(env);
  // سازگاری با کلید متنی قدیمی
  if (key === (env.ADMIN_PASSWORD || "admin123")) return true;
  const h = await hashPassword(key, admin.passwordSalt);
  return h === admin.passwordHash;
}

async function handleAdminCustomers(env, req) {
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  const users = await readUsers(env);
  const list = Object.values(users.byId || {}).map((u) => {
    const { passwordHash, passwordSalt, sessionToken, resetToken, resetExp, ...rest } = u;
    return rest;
  });
  const db = {};
  for (const u of list) db[u.id] = u;
  return ok(env, req, { gamenets_db: db, total: list.length });
}

async function handleAdminUpdate(env, req, body) {
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  const users = await readUsers(env);
  const allowed = ["licenseStatus", "licenseEndDate", "licenseStartDate", "clubName", "ownerName", "phone", "email"];

  if (body.db && typeof body.db === "object") {
    for (const [id, row] of Object.entries(body.db)) {
      const u = users.byId?.[id];
      if (!u) continue;
      for (const k of allowed) if (row[k] !== undefined) u[k] = row[k];
    }
    await writeUsers(env, users, "admin batch update");
    return ok(env, req, { ok: true, total: Object.keys(users.byId || {}).length });
  }

  const id = body.id;
  if (id == null) return err(env, req, 400, "id لازم است");
  const u = users.byId?.[id];
  if (!u) return err(env, req, 404, "کاربر یافت نشد");
  for (const k of allowed) if (body[k] !== undefined) u[k] = body[k];
  await writeUsers(env, users, `admin update ${id}`);
  return ok(env, req, { user: publicUser(u) });
}

async function handleAdminSetPassword(env, req, body) {
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  const id = body.id;
  const password = String(body.password || "");
  if (id == null || !password || password.length < 6) {
    return err(env, req, 400, "id و رمز جدید (حداقل ۶ کاراکتر) لازم است");
  }
  const users = await readUsers(env);
  const u = users.byId?.[id];
  if (!u) return err(env, req, 404, "کاربر یافت نشد");
  const salt = randomToken().slice(0, 16);
  u.passwordSalt = salt;
  u.passwordHash = await hashPassword(password, salt);
  u.resetToken = null;
  u.resetExp = null;
  u.sessionToken = randomToken();
  await writeUsers(env, users, `admin reset password for ${u.email}`);
  return ok(env, req, { ok: true, message: `رمز «${u.email}» عوض شد` });
}

async function handleAdminChangeMyPassword(env, req, body) {
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  const current = String(body.current || "");
  const next = String(body.next || "");
  if (!current || !next || next.length < 6) return err(env, req, 400, "رمز فعلی و جدید (حداقل ۶) لازم است");
  const admin = await getAdminPassword(env);
  const h = await hashPassword(current, admin.passwordSalt);
  if (h !== admin.passwordHash && current !== (env.ADMIN_PASSWORD || "admin123")) {
    return err(env, req, 400, "رمز فعلی اشتباه است");
  }
  const salt = randomToken().slice(0, 16);
  await writeAdmin(env, {
    passwordSalt: salt,
    passwordHash: await hashPassword(next, salt),
    updatedAt: Date.now(),
  }, "admin change password");
  return ok(env, req, { ok: true, message: "رمز سوپر ادمین عوض شد" });
}

async function handleAdminStats(env, req) {
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  const users = await readUsers(env);
  const list = Object.values(users.byId || {});
  const stats = {
    total: list.length,
    active: list.filter((u) => u.licenseStatus === "active").length,
    pending: list.filter((u) => u.licenseStatus === "pending").length,
    blocked: list.filter((u) => u.licenseStatus === "blocked").length,
    expired: list.filter((u) => u.licenseStatus === "expired").length,
    recent: list
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8)
      .map(publicUser),
  };
  return ok(env, req, stats);
}

async function handleAdminResetToken(env, req, body) {
  // ساخت لینک بازیابی دستی توسط ادمین (اگر ایمیل کار نکرد)
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  const users = await readUsers(env);
  const u = users.byId?.[body.id];
  if (!u) return err(env, req, 404, "کاربر یافت نشد");
  const token = randomToken(24);
  u.resetToken = token;
  u.resetExp = Date.now() + 24 * 60 * 60 * 1000; // ۲۴ ساعت برای لینک دستی
  await writeUsers(env, users, `admin reset-link ${u.email}`);
  const site = (env.SITE_URL || "https://abadeh777iu-jpg.github.io/gamenet/").replace(/\/+$/, "/");
  return ok(env, req, { ok: true, link: `${site}#reset/${token}`, email: u.email });
}

async function handleAdminDelete(env, req, body) {
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  const id = body.id;
  if (id == null) return err(env, req, 400, "id لازم است");
  const users = await readUsers(env);
  const u = users.byId?.[id];
  if (!u) return err(env, req, 404, "کاربر یافت نشد");

  // حذف از فهرست کاربران
  delete users.byId[id];
  if (u.email && users.byEmail) delete users.byEmail[u.email];
  await writeUsers(env, users, `admin delete customer ${u.email}`);

  // حذف فایل داده‌های مشتری
  try {
    const path = `${CUSTOMER_DIR}/${id}.json`;
    const fresh = await ghRead(env, path);
    if (fresh) {
      const content = btoa("");
      await gh(env, path, {
        method: "DELETE",
        body: JSON.stringify({
          message: `admin delete customer data ${id}`,
          sha: fresh.sha,
          branch: env.GITHUB_BRANCH || "main",
        }),
      });
    }
  } catch (e) {
    console.error("delete customer data", e);
  }

  return ok(env, req, { ok: true, message: `«${u.clubName || u.email}» حذف شد`, deletedId: id });
}

const MAX_PAY_LEN = 6 * 1024 * 1024;

async function readPayments(env) {
  const hit = cacheGet("payments");
  if (hit) return hit;
  const f = await ghRead(env, PAYMENTS_PATH);
  const d = f?.data;
  const v = Array.isArray(d) ? d : (d && Array.isArray(d.payments) ? d.payments : []);
  cacheSet("payments", v);
  return v;
}

async function writePayments(env, list, message) {
  if (JSON.stringify(list).length > MAX_PAY_LEN) throw new Error("payments too large");
  const fresh = await ghRead(env, PAYMENTS_PATH);
  await ghWrite(env, PAYMENTS_PATH, list, message, fresh?.sha);
  cacheDel("payments");
  cacheSet("payments", list);
}

async function handleAdminPayments(env, req) {
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  const payments = await readPayments(env);
  const pending = payments.filter((p) => p.status === "pending").length;
  return ok(env, req, { payments, total: payments.length, pending });
}

async function handleAdminPaymentsSave(env, req, body) {
  if (!(await adminOkAsync(env, req))) return err(env, req, 401, "unauthorized admin");
  if (!Array.isArray(body.payments)) return err(env, req, 400, "payments array لازم است");
  await writePayments(env, body.payments, `admin save payments (${body.payments.length})`);
  return ok(env, req, { ok: true, total: body.payments.length });
}

// ─── main ─────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) });
    }
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/api/health") return ok(env, request, { ok: true });

      if (path === "/api/register" && request.method === "POST")
        return await handleRegister(env, request, await readBody(request));
      if (path === "/api/login" && request.method === "POST")
        return await handleLogin(env, request, await readBody(request));
      if (path === "/api/bootstrap" && request.method === "GET")
        return await handleBootstrap(env, request);
      if (path === "/api/push" && request.method === "POST")
        return await handlePush(env, request, await readBody(request));
      if (path === "/api/pull" && request.method === "GET")
        return await handlePull(env, request);
      if (path === "/api/logout" && request.method === "POST")
        return await handleLogout(env, request);

      if (path === "/api/forgot" && request.method === "POST")
        return await handleForgot(env, request, await readBody(request));
      if (path === "/api/reset" && request.method === "POST")
        return await handleReset(env, request, await readBody(request));

      if (path === "/api/admin/customers" && request.method === "GET")
        return await handleAdminCustomers(env, request);
      if (path === "/api/admin/customers" && request.method === "POST")
        return await handleAdminUpdate(env, request, await readBody(request));
      if (path === "/api/admin/set-password" && request.method === "POST")
        return await handleAdminSetPassword(env, request, await readBody(request));
      if (path === "/api/admin/change-password" && request.method === "POST")
        return await handleAdminChangeMyPassword(env, request, await readBody(request));
      if (path === "/api/admin/stats" && request.method === "GET")
        return await handleAdminStats(env, request);
      if (path === "/api/admin/reset-link" && request.method === "POST")
        return await handleAdminResetToken(env, request, await readBody(request));
      if (path === "/api/admin/delete" && request.method === "POST")
        return await handleAdminDelete(env, request, await readBody(request));
      if (path === "/api/admin/payments" && request.method === "GET")
        return await handleAdminPayments(env, request);
      if (path === "/api/admin/payments" && request.method === "POST")
        return await handleAdminPaymentsSave(env, request, await readBody(request));

      return err(env, request, 404, "not found");
    } catch (e) {
      console.error(e);
      return err(env, request, 500, String(e && e.message ? e.message : e));
    }
  },
};
