from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
from main import run_scrape
import uuid
import os
import json
import bcrypt
from datetime import date
from jose import JWTError, jwt

# ── JWT Config ──────────────────────────────────────────────────────────────
SECRET_KEY = "bps-datascraper-capstone-2026-secret"
ALGORITHM  = "HS256"

security = HTTPBearer()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory stores ─────────────────────────────────────────────────────────
scans      = {}          # scan_id → scan data
scrape_log = {}          # username → date string of last scrape

# ── Pydantic models ──────────────────────────────────────────────────────────
class ScrapeRequest(BaseModel):
    city: str
    industry: str
    custom_exclusions: Optional[str] = ""

class LoginRequest(BaseModel):
    username: str
    password: str

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
    today = str(date.today())
    has_scraped = scrape_log.get(current_user) == today
    return {"username": current_user, "has_scraped_today": has_scraped}

# ── Scrape endpoint (protected + rate-limited) ───────────────────────────────
@app.post("/api/scrape")
def perform_scrape(req: ScrapeRequest, current_user: str = Depends(get_current_user)):
    today = str(date.today())
    if scrape_log.get(current_user) == today:
        raise HTTPException(
            status_code=429,
            detail="Daily limit reached. You can run 1 scrape per day. Come back tomorrow."
        )

    scan_id  = str(uuid.uuid4())
    filename = (
        f"{req.city.replace(', ', '_').replace(' ', '_')}_"
        f"{req.industry.replace(' ', '_')}_{scan_id[:8]}.csv"
    )
    scans[scan_id] = {"status": "running", "leads": [], "filename": filename}

    try:
        leads = run_scrape(city=req.city, industry=req.industry, custom_exclusions_list=req.custom_exclusions)
        scans[scan_id]["leads"]  = leads
        scans[scan_id]["status"] = "completed"
        scrape_log[current_user] = today          # mark limit used

        if leads:
            import pandas as pd
            pd.DataFrame(leads).to_csv(filename, index=False)

        return {**scans[scan_id], "scan_id": scan_id}
    except Exception as e:
        scans[scan_id]["status"] = "error"
        scans[scan_id]["error"]  = str(e)
        return {**scans[scan_id], "scan_id": scan_id, "error": str(e)}

# ── Download endpoint (protected) ────────────────────────────────────────────
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
