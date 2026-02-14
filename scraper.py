from playwright.sync_api import sync_playwright
import time
import random
import sys

def scrape_google_maps(city, industry, page=None):
    """
    Scrapes Google Maps using an existing Playwright page.
    Assumes the browser is already open and on Google Maps.
    """
    leads = []
    search_query = f"{industry} in {city}"
    print(f"DEBUG: Processing: {search_query}", flush=True)

    if not page:
        print("ERROR: Page object is missing in scrape_google_maps!")
        return []

    try:
        # 1. SEARCHING
        # Uses accessible names which are more stable than IDs
        print("DEBUG: Automating search...", flush=True)
        
        # Try to find the search box
        search_box = page.get_by_role("searchbox", name="Search Google Maps")
        if search_box.count() == 0:
             search_box = page.get_by_role("searchbox") # Fallback to generic
        
        if search_box.count() > 0:
            search_box.fill("") # Clear existing
            search_box.fill(search_query)
            search_box.press("Enter")
        else:
            print("DEBUG: Could not unlock search box. Trying generic input...", flush=True)
            page.locator("input").first.fill(search_query)
            page.keyboard.press("Enter")

        # 2. WAITING & SCROLLING (INFINITE SCROLL)
        print("DEBUG: Scrolling to load all results...", flush=True)
        
        # Helper to get current count of articles
        def get_count():
            return page.locator('div[role="feed"] > div').count()

        try:
            # Wait for feed
            page.wait_for_selector('div[role="feed"]', timeout=10000)
            feed = page.locator('div[role="feed"]')
            feed.focus()

            prev_count = 0
            same_count_retries = 0
            max_retries = 5 # Stop if count doesn't change for 5 scrolls
            
            while True:
                # Scroll down
                feed.focus()
                page.keyboard.press("End")
                time.sleep(2) # Wait for load
                
                curr_count = get_count()
                print(f"DEBUG: Loaded {curr_count} listings...", flush=True)
                
                if curr_count > prev_count:
                    prev_count = curr_count
                    same_count_retries = 0
                else:
                    same_count_retries += 1
                    
                if same_count_retries >= max_retries:
                    print("DEBUG: End of list reached (or no new items loading).", flush=True)
                    break
                    
                # Limit safety (optional, set high)
                if curr_count > 500: 
                    print("DEBUG: Hit safety limit of 500 leads.", flush=True)
                    break

        except Exception as e:
            print(f"DEBUG: Error during scrolling: {e}", flush=True)

        # 3. EXTRACTION
        print("DEBUG: Extracting results...", flush=True)
        
        # Strategy: Get all "article" roles regardless of structure
        listings = page.get_by_role("article").all()
        
        if len(listings) == 0:
            # Fallback: link-based strategy for when role="article" is missing
            listings = page.locator('a[href*="/maps/place/"]').all()

        print(f"DEBUG: Found {len(listings)} potential leads.", flush=True)

        for i, listing in enumerate(listings):
            # NO LIMIT: Process all loaded listings
            
            try:
                # We need to scroll the item into view or click it to see details
                # For basic info (Name), we might get it from aria-label
                
                raw_name = listing.get_attribute("aria-label") 
                if not raw_name:
                    # Try getting visible text
                    raw_name = listing.inner_text().split("\n")[0]
                
                if not raw_name: continue
                
                # To get the phone, we often have to click unless it's in the list view
                # Optimization: Try to read text from the list item first
                text_content = listing.inner_text()
                phone = ""
                
                # Regex to find (XXX) XXX-XXXX pattern
                import re
                phone_match = re.search(r'\(?\d{3}\)?\s?-?\d{3}-?\d{4}', text_content)
                if phone_match:
                    phone = phone_match.group(0)

                # If no phone in list view, might need to click (omitted for speed in this version)
                # keeping the button logic just in case, but usually list view has it.

                if raw_name:
                    clean_lead = {
                        "Company Name": raw_name,
                        "Phone Number": phone,
                        "City": city,
                        "Industry": industry
                    }
                    leads.append(clean_lead)
                    print(f"  -> Found: {raw_name} | {phone}", flush=True)

            except Exception as e:
                # print(f"  -> Error parsing item: {e}", flush=True)
                continue

    except Exception as e:
        print(f"DEBUG: Error in scraping loop: {e}", flush=True)
        # Try to save debug if we fail completely
        try:
            page.screenshot(path="debug_error.png")
        except: pass

    return leads

if __name__ == "__main__":
    pass 
