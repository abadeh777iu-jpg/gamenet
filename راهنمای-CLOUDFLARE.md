# راهنمای قدم‌به‌قدم: استقرار سرور روی Cloudflare

> زمان تقریبی: ۱۰ دقیقه · هزینه: رایگان  
> خروجی: یک آدرس مثل `https://gamenet-server.XXXX.workers.dev`

---

## گام ۱ — ساخت حساب Cloudflare

1. بروید به: **<https://dash.cloudflare.com/sign-up>**
2. ایمیل + رمز → **Sign up**
3. ایمیل را تأیید کنید و وارد داشبورد شوید

---

## گام ۲ — ساخت Account ID و توکن

### ۲-۱) شناسه حساب (Account ID)

1. در داشبورد Cloudflare، از منوی سمت چپ **Workers & Pages** را باز کنید  
   (اگر نبود: <https://dash.cloudflare.com/?to=/:account/workers>)
2. آدرس مرورگر را ببینید، شبیه:

```
https://dash.cloudflare.com/1a2b3c4d5e6f.../workers
```

عدد/رشته بعد از `dash.cloudflare.com/` و قبل از `/workers` همان **Account ID** است.  
کپی کنید (۳۲ کاراکتر).

### ۲-۲) توکن دسترسی

1. بروید به: **<https://dash.cloudflare.com/profile/api-tokens>**
2. **Create Token**
3. پایین صفحه، الگوی **Edit Cloudflare Workers** را پیدا کنید و **Use template** را بزنید  
   - اگر الگو نبود: Create Custom Token و این مجوزها را بدهید:
     - Account → **Workers Scripts** → **Edit**
     - Account → **Workers R2 Storage** → **Edit** (اختیاری)
4. **Continue to summary** → **Create Token**
5. متن توکن را **کپی** کنید (فقط یک بار نشان داده می‌شود)

> ⚠️ این توکن را مثل رمز عبور نگه دارید.

---

## گام ۳ — نصب ابزار (یک بار)

روی کامپیوتر خودتان (Node.js نیاز است — از <https://nodejs.org> نسخه LTS):

```bash
npm install -g wrangler
wrangler --version
```

---

## گام ۴ — ورود به Cloudflare

```bash
wrangler login
```

مرورگر باز می‌شود → **Allow**.

---

## گام ۵ — رفتن به پوشه سرور و استقرار

پوشه `worker` را از این پروژه داشته باشید (در مخزن گیت‌هاب شما هم هست:  
<https://github.com/abadeh777iu-jpg/gamenet/tree/main/worker>)

```bash
# دانلود مخزن (اگر جایی ندارید)
git clone https://github.com/abadeh777iu-jpg/gamenet.git
cd gamenet/worker

# متغیرها (در wrangler.toml از قبل تنظیم شده)
# GITHUB_REPO = abadeh777iu-jpg/gamenet

# سری توکن گیت‌هاب — متن زیر را عوض کنید و اجرا کنید
npx wrangler secret put GITHUB_TOKEN
# وقتی پرسید Secret value: همان توکن گیت‌هاب (ghp_…) را paste کنید
# Enter را بزنید

# انتشار سرور
npx wrangler deploy
```

خروجی پایانی شبیه این است:

```
Published gamenet-server
  https://gamenet-server.XXXXXXXX.workers.dev
```

**آن آدرس را کپی کنید.**

---

## گام ۶ — تست سرور

```bash
curl https://gamenet-server.XXXXXXXX.workers.dev/api/health
```

باید برگرداند:

```json
{"ok":true}
```

---

## گام ۷ — خبر دادن به من

همان آدرس Worker را اینجا بفرستید، مثلاً:

```
https://gamenet-server.abc123.workers.dev
```

من آدرس را داخل سایت می‌گذارم، فایل‌ها را روی گیت‌هاب منتشر می‌کنم و سایت  
نهایی را چک می‌کنم. (دکمه ☁️ قبلاً پاک شده — همگام‌سازی خودکار است.)

---

## عیب‌یابی سریع

| خطا | راه‌حل |
|-----|--------|
| `Unauthorized` هنگام deploy | `wrangler login` را دوباره بزنید |
| `GITHUB_TOKEN` قبول نشد | مطمئن شوید مقدار فقط خود توکن است، بدون `Bearer ` |
| CORS خطا در مرورگر | آدرس سایت در `ALLOWED_ORIGINS` هست؛ اگر دامنه جدید دارید بگویید |
| `Not Found` روی `/api/health` | آدرس را بدون `/` انتهایی تست کنید |
