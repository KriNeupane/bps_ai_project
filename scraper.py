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
        print("DEBUG: Automating search...", flush=True)
        
        # We need to wait for the element to appear instead of immediately checking count()
        try:
            # Let's try the generic input tag first as it seems to be consistently there
            search_box = page.locator("input.searchboxinput")
            if search_box.count() == 0:
                search_box = page.locator("input").first
                
            search_box.wait_for(state="visible", timeout=15000)
            search_box.fill("") # Clear existing
            search_box.fill(search_query)
            search_box.press("Enter")
        except Exception as e:
            page.screenshot(path="playwright_maps.png")
            print(f"DEBUG: Could not unlock search box: {e}. Trying fallback.", flush=True)

        # 2. WAITING, SCROLLING & EXTRACTION
        print("DEBUG: Scrolling and extracting results...", flush=True)
        
        def get_count():
            return page.locator('div[role="feed"] [role="article"]').count()

        processed_names = set()

        try:
            page.wait_for_selector('div[role="feed"]', timeout=10000)
            feed = page.locator('div[role="feed"]')
            feed.focus()

            prev_count = 0
            same_count_retries = 0
            max_retries = 5
            
            while True:

                page.evaluate('''
                    (selector) => {
                        const feed = document.querySelector(selector);
                        if (feed) {
                            feed.scrollTop = feed.scrollHeight;
                        }
                    }
                ''', 'div[role="feed"]')
                
                time.sleep(3)
                
                # EXTRACT NEW LISTINGS RIGHT NOW
                listings = page.get_by_role("article").all()
                if len(listings) == 0:
                    listings = page.locator('a[href*="/maps/place/"]').all()
                    
                for listing in listings:
                    try:
                        raw_name = listing.get_attribute("aria-label") 
                        if not raw_name:
                            raw_name = listing.inner_text().split("\n")[0]
                            
                        if not raw_name or raw_name in processed_names: 
                            continue
                            
                        text_content = listing.inner_text()
                        phone = ""
                        import re
                        phone_match = re.search(r'\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', text_content)
                        if phone_match:
                            phone = phone_match.group(0)

                        clean_lead = {
                            "Company Name": raw_name,
                            "Phone Number": phone,
                            "Location": city,
                            "Keyword": industry
                        }
                        
                        processed_names.add(raw_name)
                        leads.append(clean_lead)
                        print(f"  -> Found: {raw_name} | {phone}", flush=True)
                    except Exception as e:
                        continue

                curr_count = get_count()
                print(f"DEBUG: Loaded {curr_count} listings...", flush=True)
                
                if curr_count > prev_count:
                    prev_count = curr_count
                    same_count_retries = 0
                else:
                    same_count_retries += 1
                    page.keyboard.press("PageDown")
                    
                if same_count_retries >= max_retries:
                    end_msg = page.get_by_text("You've reached the end of the list").is_visible()
                    if end_msg: print("DEBUG: Confirmed end of list reached.", flush=True)
                    break
                    
                if curr_count > 1000: break

        except Exception as e:
            print(f"DEBUG: Error during scroll/extract: {e}", flush=True)

    except Exception as e:
        print(f"DEBUG: Error in scraping loop: {e}", flush=True)
        # Try to save debug if we fail completely
        try:
            page.screenshot(path="debug_error.png")
        except: pass

    return leads

if __name__ == "__main__":
    pass 
