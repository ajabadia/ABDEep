import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:5173")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'BNK MANAGER' button to open the Bank Manager modal.
        # BNK MANAGER button
        elem = page.locator('[id="programmer-bank-mngr-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Load patch to editor' button for '001: Blue Dolphin BC' to load the patch into the editor.
        # ▶ button
        elem = page.get_by_text('001: Blue Dolphin BC', exact=True).locator("xpath=ancestor-or-self::*[.//button][1]").get_by_role('button', name='▶', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'BNK MANAGER' button to close the Bank Manager modal and verify 'BLUE DOLPHIN BC' remains active and the main panel controls (for example the 'VCF' Edit button) are still accessible.
        # BNK MANAGER button
        elem = page.locator('[id="programmer-bank-mngr-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the modal's close button ('×' close button on the Bank & Preset Manager) to close the Bank Manager and verify the programmer still shows 'BLUE DOLPHIN BC' and the main panel controls (for example the 'VCF' Edit button) remain acces...
        # ×
        elem = page.locator('[id="browser-close-btn"]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the loaded patch becomes active
        # Assert: Sysex byte 224 equals '42', which is the 'B' in 'Blue Dolphin BC'.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[2]/div[1]/div[2]/div[1]/span[224]").nth(0)).to_have_text("42", timeout=15000), "Sysex byte 224 equals '42', which is the 'B' in 'Blue Dolphin BC'."
        # Assert: Sysex byte 225 equals '6C', which is the 'l' in 'Blue Dolphin BC'.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[2]/div[1]/div[2]/div[1]/span[225]").nth(0)).to_have_text("6C", timeout=15000), "Sysex byte 225 equals '6C', which is the 'l' in 'Blue Dolphin BC'."
        # Assert: Sysex byte 226 equals '75', which is the 'u' in 'Blue Dolphin BC'.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[2]/div[1]/div[2]/div[1]/span[226]").nth(0)).to_have_text("75", timeout=15000), "Sysex byte 226 equals '75', which is the 'u' in 'Blue Dolphin BC'."
        # Assert: Sysex byte 237 equals '42', which is the 'B' in the trailing 'BC'.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[2]/div[1]/div[2]/div[1]/span[237]").nth(0)).to_have_text("42", timeout=15000), "Sysex byte 237 equals '42', which is the 'B' in the trailing 'BC'."
        # Assert: Sysex byte 238 equals '43', which is the 'C' in the trailing 'BC'.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[2]/div[1]/div[2]/div[1]/span[238]").nth(0)).to_have_text("43", timeout=15000), "Sysex byte 238 equals '43', which is the 'C' in the trailing 'BC'."
        
        # --> Verify the main panel remains accessible
        await page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[3]/div[3]/div/div[1]/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The BNK MANAGER button in the main panel is visible.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[3]/div[3]/div/div[1]/button[1]").nth(0)).to_be_visible(timeout=15000), "The BNK MANAGER button in the main panel is visible."
        await page.locator("xpath=/html/body/div[1]/control-grid/div/div[2]/vcf-section/div/div[1]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The VCF Edit button in the main panel is visible and accessible.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[2]/vcf-section/div/div[1]/button").nth(0)).to_be_visible(timeout=15000), "The VCF Edit button in the main panel is visible and accessible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    