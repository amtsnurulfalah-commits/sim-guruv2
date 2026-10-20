"""Read-only production HTTP checks; no user credentials and no real email."""
import json
import urllib.request
import urllib.error

BASE = "https://sim-guruv2.vercel.app"
results = []

def check(path, expected, *, method="GET", headers=None, data=None):
    req = urllib.request.Request(BASE + path, method=method, headers=headers or {}, data=data)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            status, body, url = response.status, response.read(), response.url
    except urllib.error.HTTPError as error:
        status, body, url = error.code, error.read(), error.url
    assert status == expected, (path, status, expected)
    if path == "/api/health":
        assert json.loads(body)["data"]["phase"] == "7.5"
    if path.startswith("/admin/") or path == "/dashboard":
        assert "/login" in url
    results.append({"path": path, "method": method, "status": status, "passed": True})

check("/api/health", 200)
for path in ["/dashboard", "/admin/pengumuman", "/admin/operasional"]:
    check(path, 200)
for path in ["/api/dashboard", "/api/operations/announcements", "/api/operations/manage", "/api/operations/operations", "/api/internal/worker"]:
    check(path, 401)
check("/api/internal/worker", 401, headers={"Authorization": "Bearer " + "0" * 96})
check("/api/operations/announcements", 403, headers={"Sec-Fetch-Site": "cross-site"})
check("/api/operations/settings", 403, method="POST", headers={"Content-Type": "application/json"}, data=b"{}")
check("/api/operations/settings", 403, method="POST", headers={"Origin": BASE, "Content-Type": "application/json"}, data=b"{}")
print(json.dumps({"checks": results, "passed": len(results), "failed": 0}, indent=2))
