from playwright.sync_api import sync_playwright
import time

JOTFORM_URL = "https://form.jotform.com/251977126434159"

def submit_lead(company_name, phone_number, page=None):
    """
    Submits a single lead to the JotForm using an existing page.
    """
    try:
        # Sanitize for console
        safe_name = company_name.encode('ascii', 'ignore').decode('ascii')
        safe_phone = str(phone_number).encode('ascii', 'ignore').decode('ascii')
        print(f"Submitting: {safe_name} - {safe_phone}", flush=True)

        if not page:
            print("Error: Page object required for submit_lead")
            return False

        page.goto(JOTFORM_URL, timeout=60000)
        
        # Wait for form to load
        try:
            page.wait_for_selector("form", timeout=15000)
        except:
            print("  -> Timeout waiting for form load.")
            return False
        
        # Attempt 1: By Label
        filled_name = False
        try:
            page.get_by_label("Company Name").fill(company_name)
            filled_name = True
        except:
            # Fallback
            inputs = page.locator("input[type=text]")
            if inputs.count() >= 1:
                 inputs.first.fill(company_name)
                 filled_name = True
        
        if not filled_name:
            print("  -> Could not fill Company Name")
        
        # Fill Phone Number
        try:
            page.get_by_label("Phone Number").fill(str(phone_number))
        except:
             # Try generic phone inputs
             try:
                 phone_inputs = page.locator("input[type=tel]")
                 if phone_inputs.count() > 0:
                     phone_inputs.first.fill(str(phone_number))
             except: pass

        # Submit
        # Look for a submit button
        submit_btn = page.locator("button[type=submit]")
        if submit_btn.count() > 0:
            submit_btn.click()
        else:
            page.get_by_role("button", name="Submit").click()
            
        # Wait for submission verification (e.g. "Thank You" text)
        try:
            page.wait_for_selector("text=Thank You", timeout=10000)
            print("  -> Success!")
            return True
        except:
            print("  -> No success message found.")
            return False

    except Exception as e:
        print(f"  -> Failed: {e}")
        return False

def batch_submit(leads):
    """
    Handles the browser lifecycle for a batch of leads.
    """
    with sync_playwright() as p:
        # Headless mode for speed
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        success_count = 0
        try:
            for lead in leads:
                if submit_lead(lead["Company Name"], lead["Phone Number"], page=page):
                    success_count += 1
                time.sleep(1) # Polite delay
        finally:
            browser.close()
            
    print(f"Batch completed. Successful: {success_count}/{len(leads)}")

if __name__ == "__main__":
    # Test
    pass
