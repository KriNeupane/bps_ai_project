from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from main import run_scrape
import uuid, os, json, bcrypt
from datetime import date
from pathlib import Path
from jose import JWTError, jwt

# ── JWT Config ───────────────────────────────────────────────────────────────
SECRET_KEY = "bps-datascraper-capstone-2026-secret"
ALGORITHM  = "HS256"
security   = HTTPBearer()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ── Privileged users ─────────────────────────────────────────────────────────
UNLIMITED_USERS = {"kri.neupane"}
ADMIN_USERS     = {"kri.neupane"}

# ── Persistent grants (saved to file — survives restarts) ────────────────────
GRANTS_FILE = "grants.json"

def load_grants() -> dict:
    if not Path(GRANTS_FILE).exists():
        return {}
    try:
        with open(GRANTS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def save_grants(grants: dict):
    with open(GRANTS_FILE, "w") as f:
        json.dump(grants, f, indent=2)

def get_user_limit(username: str, date_str: str) -> int:
    """Return the daily scrape limit for a user. Default is 1."""
    return load_grants().get(username, {}).get(date_str, 1)

# ── In-memory usage counts {username: {date_str: count}} ────────────────────
scrape_counts: dict = {}
scans:         dict = {}

# ── Pydantic models ──────────────────────────────────────────────────────────
class ScrapeRequest(BaseModel):
    city: str
    industry: str
    custom_exclusions: Optional[str] = ""

class LoginRequest(BaseModel):
    username: str
    password: str

class GrantRequest(BaseModel):
    username: str
    extra: int = 1   # positive to add, negative to remove

# ── Auth helpers ─────────────────────────────────────────────────────────────
def load_users():
    with open("users.json", "r") as f:
        return json.load(f)

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_token(username: str) -> str:
    return jwt.encode({"sub": username}, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload  = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def require_admin(current_user: str = Depends(get_current_user)) -> str:
    if current_user not in ADMIN_USERS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ── Auth endpoints ───────────────────────────────────────────────────────────
@app.post("/api/auth/login")
def login(req: LoginRequest):
    users = load_users()
    user  = next((u for u in users if u["username"] == req.username), None)
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"access_token": create_token(req.username), "username": req.username}

@app.get("/api/auth/me")
def get_me(current_user: str = Depends(get_current_user)):
    today     = str(date.today())
    unlimited = current_user in UNLIMITED_USERS
    used      = scrape_counts.get(current_user, {}).get(today, 0)
    limit     = get_user_limit(current_user, today)
    return {
        "username":         current_user,
        "has_scraped_today": used > 0,
        "scrapes_remaining": -1 if unlimited else max(0, limit - used),
        "limit":            limit,
        "unlimited":        unlimited,
        "is_admin":         current_user in ADMIN_USERS,
    }

# ── Admin endpoints ──────────────────────────────────────────────────────────
@app.get("/api/admin/users")
def admin_list_users(admin: str = Depends(require_admin)):
    today  = str(date.today())
    result = []
    for u in load_users():
        uname = u["username"]
        if uname in ADMIN_USERS:
            continue
        used  = scrape_counts.get(uname, {}).get(today, 0)
        limit = get_user_limit(uname, today)
        result.append({
            "username":         uname,
            "used":             used,
            "limit":            limit,
            "scrapes_remaining": max(0, limit - used),
        })
    return result

@app.post("/api/admin/grant")
def admin_grant(req: GrantRequest, admin: str = Depends(require_admin)):
    today   = str(date.today())
    grants  = load_grants()
    grants.setdefault(req.username, {})
    current = grants[req.username].get(today, 1)
    new_lim = max(0, current + req.extra)
    grants[req.username][today] = new_lim
    save_grants(grants)
    used = scrape_counts.get(req.username, {}).get(today, 0)
    return {
        "username":         req.username,
        "limit":            new_lim,
        "used":             used,
        "scrapes_remaining": max(0, new_lim - used),
    }

# ── Scrape endpoint (protected + rate-limited) ───────────────────────────────
@app.post("/api/scrape")
def perform_scrape(req: ScrapeRequest, current_user: str = Depends(get_current_user)):
    today = str(date.today())

    if current_user not in UNLIMITED_USERS:
        used  = scrape_counts.get(current_user, {}).get(today, 0)
        limit = get_user_limit(current_user, today)
        if used >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Daily limit reached ({limit}/{limit} scrapes used). Come back tomorrow."
            )

    scan_id  = str(uuid.uuid4())
    filename = (
        f"{req.city.replace(', ', '_').replace(' ', '_')}_"
        f"{req.industry.replace(' ', '_')}_{scan_id[:8]}.csv"
    )
    scans[scan_id] = {"status": "running", "leads": [], "filename": filename}

    try:
        leads = run_scrape(
            city=req.city,
            industry=req.industry,
            custom_exclusions_list=req.custom_exclusions,
        )
        scans[scan_id]["leads"]  = leads
        scans[scan_id]["status"] = "completed"

        # Record usage
        scrape_counts.setdefault(current_user, {})
        scrape_counts[current_user][today] = scrape_counts[current_user].get(today, 0) + 1

        if leads:
            import pandas as pd
            pd.DataFrame(leads).to_csv(filename, index=False)

        return {**scans[scan_id], "scan_id": scan_id}
    except Exception as e:
        scans[scan_id]["status"] = "error"
        scans[scan_id]["error"]  = str(e)
        return {**scans[scan_id], "scan_id": scan_id, "error": str(e)}

# ── Download endpoint ────────────────────────────────────────────────────────
@app.get("/api/download/{scan_id}")
def download_csv(scan_id: str, current_user: str = Depends(get_current_user)):
    scan = scans.get(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    file_path = scan["filename"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="CSV file not found")
    return FileResponse(file_path, filename=file_path, media_type="text/csv")

@app.get("/api/scans")
def list_scans(current_user: str = Depends(get_current_user)):
    return scans

# ── Serve React frontend ─────────────────────────────────────────────────────
if os.path.exists("ui/dist"):
    app.mount("/", StaticFiles(directory="ui/dist", html=True), name="ui")
else:
    print("Warning: ui/dist not found. Run 'npm run build' inside /ui first.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
