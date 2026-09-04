import time
from playwright.sync_api import sync_playwright
import re

def test_scrape():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.google.com/maps")
        
        search_box = page.locator("input.searchboxinput")
        if search_box.count() == 0:
            search_box = page.locator("input").first
            
        search_box.wait_for(state="visible", timeout=15000)
        search_box.fill("")
        search_box.fill("dentist in Richardson, TX")
        search_box.press("Enter")
        
        page.wait_for_selector('div[role="feed"]', timeout=10000)
        time.sleep(3)
        
        for i in range(3):
            # Re-fetch listings to avoid stale element errors after navigating back
            listings = page.get_by_role("article").all()
            if len(listings) <= i: break
            
            listing = listings[i]
            raw_name = listing.get_attribute("aria-label")
            text_content = listing.inner_text()
            
            if not raw_name or "Sponsored" in text_content: continue
            
            try:
                # Click the listing to open details
                listing.click()
                
                # Wait for phone number button
                phone_selector = '[data-tooltip="Copy phone number"] .fontBodyMedium'
                try:
                    page.wait_for_selector(phone_selector, timeout=4000)
                    phone = page.locator(phone_selector).inner_text()
                except:
                    phone = "Not found"
                    
                print(f"--- LISTING {i} ({raw_name}) ---")
                print(f"Phone Extracted: {phone}")
                
                # Click back to results
                page.mouse.click(10, 10) # Sometimes helps blur
                back_btn = page.locator('button[aria-label^="Back"]') 
                if back_btn.is_visible():
                    back_btn.click()
                    page.wait_for_selector('div[role="feed"]', timeout=5000)
                    time.sleep(1) # Small delay for transition
                    
            except Exception as e:
                print(f"Error on listing {i}: {e}")
                
        browser.close()

if __name__ == "__main__":
    test_scrape()

