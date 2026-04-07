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

            start_index = 0
            same_count_retries = 0
            max_retries = 5
            
            while True:
                # Scroll to bottom
                page.evaluate('''
                    (selector) => {
                        const feed = document.querySelector(selector);
                        if (feed) {
                            feed.scrollTop = feed.scrollHeight;
                        }
                    }
                ''', 'div[role="feed"]')
                
                time.sleep(3)
                
                # Fetch listings
                listings = page.get_by_role("article").all()
                if len(listings) == 0:
                    listings = page.locator('a[href*="/maps/place/"]').all()
                    
                curr_count = len(listings)
                
                if curr_count > start_index:
                    # Process NEW listings
                    for i in range(start_index, curr_count):
                        try:
                            # Re-fetch the list to avoid stale element errors after returning from detailed view
                            current_listings = page.get_by_role("article").all()
                            if len(current_listings) == 0:
                                current_listings = page.locator('a[href*="/maps/place/"]').all()
                                
                            if i >= len(current_listings): break
                            
                            listing = current_listings[i]
                            raw_name = listing.get_attribute("aria-label") 
                            if not raw_name:
                                raw_name = listing.inner_text().split("\n")[0]
                                
                            if not raw_name or raw_name in processed_names: 
                                continue
                                
                            # If it's a sponsored ad, skip it
                            if "Sponsored" in listing.inner_text() or "Ad" in listing.inner_text()[:40]:
                                processed_names.add(raw_name)
                                continue
                                
                            # --- DEEP SCRAPING ---
                            phone = ""
                            try:
                                # Scroll into view to ensure it's clickable
                                listing.scroll_into_view_if_needed()
                                listing.click()
                                
                                # Extract phone
                                phone_selector = '[data-tooltip="Copy phone number"] .fontBodyMedium'
                                try:
                                    page.wait_for_selector(phone_selector, timeout=3000)
                                    phone = page.locator(phone_selector).inner_text()
                                except:
                                    phone = ""
                                
                                # Click back
                                page.mouse.click(10, 10) # Blur focus to prevent overlay issues
                                back_btn = page.locator('button[aria-label^="Back"]')
                                if back_btn.count() == 0:
                                    back_btn = page.locator('button[jsaction*="pane.back"]')
                                
                                if back_btn.is_visible():
                                    back_btn.first.click()
                                    page.wait_for_selector('div[role="feed"]', timeout=4000)
                                    time.sleep(0.5)
                            except Exception as e:
                                print(f"  -> Error deep scraping {raw_name}: {e}", flush=True)
                                
                            # Build lead
                            clean_lead = {
                                "Company Name": raw_name,
                                "Phone Number": phone,
                                "Location": city,
                                "Keyword": industry
                            }
                            
                            processed_names.add(raw_name)
                            leads.append(clean_lead)
                            print(f"  -> Found: {raw_name} | Phone: {phone if phone else 'N/A'}", flush=True)
                            
                        except Exception as e:
                            print(f"  -> Listing processing error: {e}", flush=True)
                            continue
                            
                    # Update pointers after successful extraction
                    start_index = curr_count
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
