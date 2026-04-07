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

from typing import Optional

class ScrapeRequest(BaseModel):
    city: str
    industry: str
    custom_exclusions: Optional[str] = None

@app.post("/api/scrape")
def start_scrape(request: ScrapeRequest):
    scan_id = str(uuid.uuid4())
    # Support multiple cities (comma-separated)
    city_list = [c.strip() for c in request.city.split(',') if c.strip()]
    num_cities = len(city_list)
    
    filename = get_dynamic_filename(request.city, request.industry)
    scans[scan_id] = {
        "status": "running", 
        "city": request.city, 
        "industry": request.industry, 
        "leads": [],
        "filename": filename,
        "cities_count": num_cities
    }
    
    try:
        all_leads = []
        for i, city in enumerate(city_list):
            scans[scan_id]["status"] = f"Scraping {city} ({i+1}/{num_cities})..."
            # run_scrape will append to the filename if provided
            leads = run_scrape(
                city=city, 
                industry=request.industry, 
                custom_exclusions_list=request.custom_exclusions,
                output_path=filename
            )
            all_leads.extend(leads)
            scans[scan_id]["leads"] = all_leads
            
        scans[scan_id]["status"] = "completed"
        return {"scan_id": scan_id, "leads": all_leads}
    except Exception as e:
        scans[scan_id]["status"] = "failed"
        scans[scan_id]["error"] = str(e)
        return {"scan_id": scan_id, "leads": [], "error": str(e)}

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

# Mount the static React web app at the root (must be after all /api/ route definitions)
import os
from fastapi.staticfiles import StaticFiles

if os.path.exists("ui/dist"):
    app.mount("/", StaticFiles(directory="ui/dist", html=True), name="ui")
else:
    print("Warning: ui/dist not found. The React frontend will not be automatically served by FastAPI.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
