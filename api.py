from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from main import run_scrape, get_dynamic_filename
import uuid
import os

app = FastAPI(title="LeadFlow API")

# Enable CORS for React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for scan status
scans = {}

class ScrapeRequest(BaseModel):
    city: str
    industry: str

def perform_scrape(scan_id: str, city: str, industry: str):
    scans[scan_id]["status"] = "running"
    try:
        leads = run_scrape(city, industry)
        scans[scan_id]["status"] = "completed"
        scans[scan_id]["leads"] = leads
    except Exception as e:
        scans[scan_id]["status"] = "failed"
        scans[scan_id]["error"] = str(e)

@app.post("/api/scrape")
async def start_scrape(request: ScrapeRequest, background_tasks: BackgroundTasks):
    scan_id = str(uuid.uuid4())
    filename = get_dynamic_filename(request.city, request.industry)
    scans[scan_id] = {
        "status": "pending", 
        "city": request.city, 
        "industry": request.industry, 
        "leads": [],
        "filename": filename
    }
    background_tasks.add_task(perform_scrape, scan_id, request.city, request.industry)
    return {"scan_id": scan_id}

@app.get("/api/download/{scan_id}")
async def download_leads(scan_id: str):
    scan = scans.get(scan_id)
    if not scan or scan["status"] != "completed":
        raise HTTPException(status_code=404, detail="Scan not found or not yet completed")
    
    file_path = scan["filename"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="CSV file not found")
        
    return FileResponse(file_path, filename=file_path, media_type='text/csv')

@app.get("/api/status/{scan_id}")
async def get_status(scan_id: str):
    return scans.get(scan_id, {"status": "not_found"})

@app.get("/api/scans")
async def list_scans():
    return scans

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
