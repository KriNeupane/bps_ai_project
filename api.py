import os
import uuid
import uvicorn
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from main import run_scrape, get_dynamic_filename

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
    custom_exclusions: Optional[str] = None

def background_scrape(scan_id: str, city_list: list, industry: str, custom_exclusions: Optional[str], filename: str):
    num_cities = len(city_list)
    all_leads = []
    
    try:
        for i, city in enumerate(city_list):
            # Check for stop signal
            if scans[scan_id].get("stopping"):
                scans[scan_id]["status"] = "stopped"
                return

            scans[scan_id]["status"] = f"Scraping {city} ({i+1}/{num_cities})..."
            
            leads = run_scrape(
                city=city, 
                industry=industry, 
                custom_exclusions_list=custom_exclusions,
                output_path=filename
            )
            all_leads.extend(leads)
            scans[scan_id]["leads"] = all_leads
            
        scans[scan_id]["status"] = "completed"
    except Exception as e:
        scans[scan_id]["status"] = "failed"
        scans[scan_id]["error"] = str(e)

@app.post("/api/scrape")
async def start_scrape(request: ScrapeRequest, background_tasks: BackgroundTasks):
    scan_id = str(uuid.uuid4())
    raw_cities = [c.strip() for c in request.city.split(',') if c.strip()]
    city_list = []
    for c in raw_cities:
        if len(c) == 2 and city_list:
            city_list[-1] = f"{city_list[-1]}, {c.upper()}"
        else:
            city_list.append(c)
            
    num_cities = len(city_list)
    filename = get_dynamic_filename(request.city, request.industry)
    
    scans[scan_id] = {
        "status": "starting", 
        "city": request.city, 
        "industry": request.industry, 
        "leads": [],
        "filename": filename,
        "cities_count": num_cities,
        "stopping": False
    }
    
    background_tasks.add_task(
        background_scrape, 
        scan_id, 
        city_list, 
        request.industry, 
        request.custom_exclusions, 
        filename
    )
    
    return {"scan_id": scan_id}

@app.post("/api/stop/{scan_id}")
async def stop_scrape(scan_id: str):
    if scan_id in scans:
        if scans[scan_id]["status"] in ["completed", "failed", "stopped"]:
            return {"status": scans[scan_id]["status"], "message": "Scan already finished"}
        scans[scan_id]["stopping"] = True
        scans[scan_id]["status"] = "stopping..."
        return {"scan_id": scan_id, "message": "Stop signal sent"}
    raise HTTPException(status_code=404, detail="Scan not found")

@app.get("/api/download/{scan_id}")
async def download_leads(scan_id: str):
    scan = scans.get(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
        
    # Allow downloading partial results if stopped
    if scan["status"] not in ["completed", "stopped"]:
        raise HTTPException(status_code=400, detail="Scan not yet completed or stopped")
    
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

# Mount the static React web app at the root
if os.path.exists("ui/dist"):
    app.mount("/", StaticFiles(directory="ui/dist", html=True), name="ui")
else:
    print("Warning: ui/dist not found. The React frontend will not be automatically served by FastAPI.")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
