#!/usr/bin/env bash
# deploy.sh — انتشار مخزن روی GitHub + فعال‌سازی GitHub Pages
# استفاده:  GITHUB_TOKEN=ghp_*** GITHUB_USER=yourname ./deploy.sh [repo-name]
set -euo pipefail

TOKEN="${GITHUB_TOKEN:-}"
USER="${GITHUB_USER:-}"
REPO="${1:-gamenet}"
BRANCH="main"

if [[ -z "$TOKEN" || -z "$USER" ]]; then
  echo "خطا: متغیرهای GITHUB_TOKEN و GITHUB_USER لازم است."
  echo "مثال:"
  echo "  GITHUB_TOKEN=ghp_*** GITHUB_USER=myuser ./deploy.sh gamenet"
  exit 1
fi

cd "$(dirname "$0")"
FULL_REPO="$USER/$REPO"
API="https://api.github.com"

gh_api() {
  local method="$1" path="$2" data="${3:-}"
  local args=(-sS -X "$method" -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28")
  if [[ -n "$data" ]]; then
    args+=(-H "Content-Type: application/json" -d "$data")
  fi
  curl "${args[@]}" "$API$path"
}

echo "==> بررسی هویت کاربر…"
ME=$(gh_api GET /user)
LOGIN=$(echo "$ME" | python3 -c "import sys,json; print(json.load(sys.stdin).get('login',''))" 2>/dev/null || true)
if [[ -z "$LOGIN" ]]; then
  echo "توکن معتبر نیست یا دسترسی read:user ندارد."
  echo "$ME" | head -c 400
  echo
  exit 1
fi
echo "    کاربر: $LOGIN"
if [[ "$LOGIN" != "$USER" && "$USER" != "$LOGIN" ]]; then
  echo "    توجه: GITHUB_USER ($USER) با توکن ($LOGIN) یکی نیست؛ از توکن استفاده می‌کنیم."
  USER="$LOGIN"
  FULL_REPO="$USER/$REPO"
fi

echo "==> ساخت مخزن $FULL_REPO (در صورت نیاز)…"
gh_api POST /repos "{\"name\":\"$REPO\",\"private\":false,\"description\":\"محاسبه گر مالی گیم نت کلاب انرژی\",\"auto_init\":false}" >/dev/null || true

echo "==> آماده‌سازی git و ارسال کد…"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || git init -b "$BRANCH"
git config user.email "${LOGIN}@users.noreply.github.com"
git config user.name "$LOGIN"

# ریموت با توکن (فقط در این جلسه؛ توکن در fatal نوشته نمی‌شود)
AUTH_URL="https://x-access-token:${TOKEN}@github.com/${FULL_REPO}.git"
git remote remove origin 2>/dev/null || true
git remote add origin "$AUTH_URL"

git add -A
git commit -m "Deploy: Club Energy gamenet PWA + cloud sync" --allow-empty --quiet

echo "==> push به GitHub…"
git push -u origin "$BRANCH" --force 2>&1 | sed -u "s/${TOKEN}/***/g" || {
  # اگر push اول fail شد (مخزن تازه ساخته شده) دوباره تلاش
  git push -u origin "$BRANCH" --force
}

# بعد از push، ریموت امن بدون توکن بگذار (توکن در history نماند)
git remote set-url origin "https://github.com/${FULL_REPO}.git"

echo "==> فعال‌سازی GitHub Pages…"
PAGES=$(gh_api POST /repos/"$FULL_REPO"/pages "{\"source\":{\"branch\":\"$BRANCH\",\"path\":\"/\"}}")
echo "$PAGES" | head -c 400
echo

# فایل داده ابری را در مخزن ایجاد کن تا بعداً sync بتواند آن را آپدیت کند
echo "==> ایجاد data/cloud-backup.json…"
python3 - << PY
import json, base64, urllib.request, os
token = os.environ.get("GITHUB_TOKEN") or "$TOKEN"
repo = "$FULL_REPO"
branch = "$BRANCH"
path = "data/cloud-backup.json"
payload = {"_updatedAt": 0, "_device": "deploy", "values": {}}
content = base64.b64encode(json.dumps(payload, indent=2).encode()).decode()

def req(method, url, data=None):
    r = urllib.request.Request(url, method=method)
    r.add_header("Authorization", "Bearer " + token)
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("X-GitHub-Api-Version", "2022-11-28")
    if data is not None:
        body = json.dumps(data).encode()
        r.add_header("Content-Type", "application/json")
        return urllib.request.urlopen(r, body)
    return urllib.request.urlopen(r)

base = f"https://api.github.com/repos/{repo}/contents/{path}"
sha = None
try:
    with req("GET", base) as resp:
        sha = json.load(resp).get("sha")
except Exception:
    pass
data = {"message": "chore: init cloud backup", "content": content, "branch": branch}
if sha:
    data["sha"] = sha
try:
    with req("PUT", base, data) as resp:
        print("data file ok", resp.status)
except Exception as e:
    print("data file:", e)
PY

# آدرس نهایی
PAGE_URL="https://${USER}.github.io/${REPO}/"
echo
echo "✅ انتشار انجام شد."
echo "   مخزن:  https://github.com/${FULL_REPO}"
echo "   سایت:  ${PAGE_URL}"
echo "   (فعال شدن Pages ممکن است ۱ تا ۲ دقیقه طول بکشد)"
echo
echo "در پنل اپ: ☁️ ← توکن همین را وارد کنید ← مخزن: ${FULL_REPO} ← ذخیره اتصال"
