# محاسبه‌گر مالی گیم‌نت کلاب انرژی

سیستم کامل مدیریت و محاسبه مالی برای گیم‌نت‌ها — نسخه وب (PWA).

## اجرا

کافی است `index.html` را با یک سرور استاتیک سرو کنید، مثلاً:

```bash
npx serve .
# یا
python3 -m http.server 8080
```

## ساختار

| فایل | توضیح |
|------|-------|
| `index.html` | کل اپلیکیشن (React، تک‌فایل) |
| `manifest.json` | متادیتای PWA |
| `sw.js` | Service Worker برای آفلاین |
| `favicon-light.svg` / `favicon-dark.svg` | آیکون‌ها |
| `icon-192.png` / `icon-512.png` / `apple-touch-icon.png` | آیکون‌های PWA |
| `robots.txt` | دستورات خزنده‌ها |

داده‌ها در `localStorage` مرورگر ذخیره می‌شوند.
