#!/usr/bin/env python3
import json, base64, hashlib, secrets, urllib.request, urllib.error, sys, time

import os
TOKEN = os.environ.get("GITHUB_TOKEN", "")
REPO = "abadeh777iu-jpg/gamenet"
BRANCH = "main"
USERS_PATH = "data/db/users.json"
PAYMENTS_PATH = "data/db/payments.json"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
BATCH = 50
PLANS = [("monthly", 500_000), ("yearly", 5_000_000), ("golden", 9_000_000)]

def gh(path, method="GET", data=None, sha=None, message=""):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "seed-1000",
        "Content-Type": "application/json",
    }
    body = None
    if method == "PUT":
        payload = {
            "message": message or f"seed {path}",
            "content": base64.b64encode(json.dumps(data, ensure_ascii=False).encode()).decode(),
            "branch": BRANCH,
        }
        if sha:
            payload["sha"] = sha
        body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        txt = e.read().decode()[:400]
        raise RuntimeError(f"{method} {path} -> {e.code}: {txt}") from None

def read_json(path):
    try:
        d = gh(path)
        return json.loads(base64.b64decode(d["content"]).decode()), d["sha"]
    except RuntimeError as e:
        if "404" in str(e):
            return None, None
        raise

def fresh_sha(path):
    d = gh(path)
    return d["sha"], d

def ensure_payments():
    p, sha = read_json(PAYMENTS_PATH)
    if p is None:
        r = gh(PAYMENTS_PATH, "PUT", data=[], message="seed: init payments.json")
        # response may lack sha - re-read
        _, sha = fresh_sha(PAYMENTS_PATH)
        print("init payments sha", sha[:8] if sha else None, "resp_keys", list(r.keys())[:6], flush=True)
        return [], sha
    if isinstance(p, dict):
        p = p.get("payments", [])
    return p, sha

def main():
    users, _ = read_json(USERS_PATH)
    users = users or {"byId": {}, "byEmail": {}}
    users.setdefault("byId", {})
    users.setdefault("byEmail", {})
    payments, pay_sha = ensure_payments()

    existing = set(users["byEmail"].keys())
    created_users = 0
    created_pays = 0
    plan_i = len(payments)

    # Precompute missing
    missing = []
    for i in range(N):
        email = f"test{i+1:04d}@example.com"
        if email not in existing:
            missing.append((i + 1, email))
    print(f"existing={len(existing)} payments={len(payments)} to_create={len(missing)}", flush=True)

    base_id = 1_600_000_000_000
    for bi in range(0, len(missing), BATCH):
        chunk = missing[bi:bi+BATCH]
        for num, email in chunk:
            uid = base_id + num
            salt = secrets.token_hex(8)
            h = hashlib.sha256(f"{salt}:test1234".encode()).hexdigest()
            users["byId"][str(uid)] = {
                "id": uid,
                "clubName": f"گیم‌نت تست {num:04d}",
                "ownerName": f"مشتری تست {num:04d}",
                "email": email,
                "phone": f"0912{num:07d}"[:11],
                "licenseStatus": "pending",
                "createdAt": "2026-09-24T10:00:00.000Z",
                "passwordSalt": salt,
                "passwordHash": h,
                "sessionToken": secrets.token_hex(32),
                "seed": "loadtest",
            }
            users["byEmail"][email] = uid
            created_users += 1

            # payment if not present
            if not any(p.get("id") == uid for p in payments):
                pt, amt = plan_i and PLANS[plan_i % 3] or PLANS[0]
                # cycle properly
                pt, amt = PLANS[plan_i % 3]
                plan_i += 1
                payments.append({
                    "id": uid + 400_000_000_000,  # unique
                    "gamenetId": uid,
                    "gamenet": {
                        "id": uid,
                        "clubName": f"گیم‌نت تست {num:04d}",
                        "ownerName": f"مشتری تست {num:04d}",
                        "email": email,
                    },
                    "planType": pt,
                    "amount": amt,
                    "receiptUrl": f"seed://receipt-{num:04d}.jpg",
                    "transactionRef": f"TEST-SEED-{num:04d}",
                    "status": "pending",
                    "createdAt": "2026-09-24T10:00:00.000Z",
                    "seed": "loadtest",
                })
                created_pays += 1

        # always PUT with fresh sha
        _, usha = fresh_sha(USERS_PATH)
        gh(USERS_PATH, "PUT", data=users, sha=usha,
           message=f"seed: users batch {bi//BATCH+1} (+{len(chunk)})")
        _, pay_sha = fresh_sha(PAYMENTS_PATH)
        gh(PAYMENTS_PATH, "PUT", data=payments, sha=pay_sha,
           message=f"seed: payments batch {bi//BATCH+1} (+{created_pays})")
        print(f"batch {bi//BATCH+1}/{(len(missing)+BATCH-1)//BATCH}: users+{created_users} pays+{created_pays} total_users={len(users['byId'])} total_pays={len(payments)}", flush=True)

    print(f"DONE users={len(users['byId'])} payments={len(payments)} new_users={created_users} new_pays={created_pays}", flush=True)

if __name__ == "__main__":
    main()
