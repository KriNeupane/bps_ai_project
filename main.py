import pandas as pd
from scraper import scrape_google_maps
import time
import os
import re
from playwright.sync_api import sync_playwright

# ==========================================
#   USER CONFIGURATION - EDIT HERE
# ==========================================
TARGET_CITY = "Irving, TX"            # <--- CHANGE CITY HERE
TARGET_INDUSTRY = "Real estate agent" # <--- CHANGE KEYWORD HERE
# ==========================================

# Master Sheet to check for duplicates (Always checks this)
MASTER_CSV_PATH = "master_exclusion_list.csv"

def get_dynamic_filename(city, industry):
    """
    Creates a filename like 'frisco_carpet_cleaning.csv'
    """
    # Clean up strings to make them filesystem safe
    safe_city = re.sub(r'[^a-zA-Z0-9]', '_', city.split(',')[0].strip().lower())
    safe_industry = re.sub(r'[^a-zA-Z0-9]', '_', industry.strip().lower())
    return f"{safe_city}_{safe_industry}.csv"

OUTPUT_CSV_PATH = get_dynamic_filename(TARGET_CITY, TARGET_INDUSTRY)

def load_master_exclusions(file_path):
    exclusions = set()
    try:
        if os.path.exists(file_path):
            try:
                df = pd.read_csv(file_path, encoding='utf-8')
            except:
                df = pd.read_csv(file_path, encoding='cp1252')
            
            for _, row in df.iterrows():
                val = ""
                if "Full Name" in df.columns:
                    val = str(row["Full Name"])
                elif "Company Name" in df.columns:
                    val = str(row["Company Name"])
                
                if val and val.lower() != "nan":
                    exclusions.add(val.lower().strip())
    except Exception as e:
        print(f"Warning: Could not load master exclusion list: {e}", flush=True)
    return exclusions

def main():
    print(f"--- STARTING AUTOMATION ---")
    print(f"Target: {TARGET_INDUSTRY}")
    print(f"Location: {TARGET_CITY}")
    print(f"Output File: {OUTPUT_CSV_PATH}")
    
    # 1. Load Exclusions (Master Sheet)
    exclusion_set = load_master_exclusions(MASTER_CSV_PATH)
    print(f"Loaded {len(exclusion_set)} exclusions from Master List.")
    
    # 2. Load Existing Output File (To avoid duplicates if you run same query twice)
    if os.path.exists(OUTPUT_CSV_PATH):
        try:
            old_df = pd.read_csv(OUTPUT_CSV_PATH)
            for _, row in old_df.iterrows():
                val = str(row.get("Company Name", "")).lower().strip()
                if val: exclusion_set.add(val)
            print(f"Appended existing leads from {OUTPUT_CSV_PATH} to exclusion list.")
        except: pass

    new_leads = []
    
    with sync_playwright() as p:
        print("DEBUG: Launching browser...", flush=True)
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        
        print("\n--- BROWSER SETUP PAUSE (15s) ---")
        print("1. Browser has opened.")
        print("2. Solve CAPTCHAs / Accept Cookies.")
        print("Waiting...", flush=True)
        time.sleep(15)
        print("Starting automation now!", flush=True)
        
        page.goto("https://www.google.com/maps", timeout=60000)

        raw_leads = scrape_google_maps(TARGET_CITY, TARGET_INDUSTRY, page=page)
        
        print(f"Filtering {len(raw_leads)} raw leads...", flush=True)
        
        for lead in raw_leads:
            name_key = str(lead["Company Name"]).lower().strip()
            
            if name_key in exclusion_set:
                print(f"  -> Duplicate (Skipped): {lead['Company Name']}", flush=True)
                continue
                
            excluded_keywords = ["McDonalds", "Starbucks", "U-Haul"] 
            if any(k.lower() in lead["Company Name"].lower() for k in excluded_keywords):
                continue
                
            new_leads.append(lead)
            exclusion_set.add(name_key)

        print("Closing browser...")
        browser.close()

    print(f"\nScrape Complete. Found {len(new_leads)} NEW leads.")
    
    if new_leads:
        df = pd.DataFrame(new_leads)
        need_header = not os.path.exists(OUTPUT_CSV_PATH)
        df.to_csv(OUTPUT_CSV_PATH, mode='a', header=need_header, index=False)
        print(f"SUCCESS: Saved to {OUTPUT_CSV_PATH}")
    else:
        print("No new leads found.")

if __name__ == "__main__":
    main()
