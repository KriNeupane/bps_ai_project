import pandas as pd
from scraper import scrape_google_maps
import time
import os
import re
from playwright.sync_api import sync_playwright
import sys

TARGET_CITY = "Frisco, TX"            # CITY format: "City, State"
TARGET_INDUSTRY = "Real Estate" # KEYWORD format: "Industry"


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
            
            # Helper to clean phone numbers
            def clean_phone(p):
                return re.sub(r'[^0-9]', '', str(p)) if p else ""

            for _, row in df.iterrows():
                # Load Name
                name = str(row.get("Full Name", row.get("Company Name", ""))).lower().strip()
                if name and name != "nan":
                    exclusions.add(name)
                
                # Load Phone (Cleaned)
                phone = clean_phone(row.get("Phone Number", ""))
                if phone:
                    exclusions.add(phone)
                    
    except Exception as e:
        print(f"Warning: Could not load master exclusion list: {e}", flush=True)
    return exclusions

def run_scrape(city, industry, page=None, custom_exclusions_list=None):
    global TARGET_CITY, TARGET_INDUSTRY, OUTPUT_CSV_PATH
    TARGET_CITY = city
    TARGET_INDUSTRY = industry
    OUTPUT_CSV_PATH = get_dynamic_filename(TARGET_CITY, TARGET_INDUSTRY)

    print(f"--- STARTING AUTOMATION ---")
    print(f"Target: {TARGET_INDUSTRY}")
    print(f"Location: {TARGET_CITY}")
    
    # 1. Load Custom Exclusions exclusively
    exclusion_set = set()
    
    def clean_phone(p):
        return re.sub(r'[^0-9]', '', str(p)) if p else ""
        
    if custom_exclusions_list:
        lines = custom_exclusions_list.split('\n')
        for line in lines:
            line = line.strip()
            if line:
                phone_key = clean_phone(line)
                if phone_key:
                    exclusion_set.add(phone_key)
    
    new_leads = []
    
    def execute(p_page):
        p_page.goto("https://www.google.com/maps", timeout=60000)
        raw_leads = scrape_google_maps(TARGET_CITY, TARGET_INDUSTRY, page=p_page)
        
        def clean_phone(p):
            return re.sub(r'[^0-9]', '', str(p)) if p else ""

        for lead in raw_leads:
            name_key = str(lead["Company Name"]).lower().strip()
            phone_key = clean_phone(lead.get("Phone Number", ""))
            
            if phone_key and phone_key in exclusion_set: continue
            
            excluded_keywords = ["McDonalds", "Starbucks", "U-Haul"] 
            if any(k.lower() in lead["Company Name"].lower() for k in excluded_keywords):
                continue
                
            new_leads.append(lead)

    if page:
        execute(page)
    else:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=False)
            context = browser.new_context()
            temp_page = context.new_page()
            print("\n--- BROWSER SETUP PAUSE (15s) ---")
            time.sleep(15)
            execute(temp_page)
            browser.close()

    if new_leads:
        df = pd.DataFrame(new_leads)
        need_header = not os.path.exists(OUTPUT_CSV_PATH)
        df.to_csv(OUTPUT_CSV_PATH, mode='a', header=need_header, index=False)
        print(f"SUCCESS: Saved {len(new_leads)} leads to {OUTPUT_CSV_PATH}")
    
    return new_leads

def main():
    # Check for command line arguments
    city = TARGET_CITY
    industry = TARGET_INDUSTRY
    if len(sys.argv) > 1: city = sys.argv[1]
    if len(sys.argv) > 2: industry = sys.argv[2]
    
    run_scrape(city, industry)

if __name__ == "__main__":
    main()
