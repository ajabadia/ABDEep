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
        
        # -> Click the 'MOD MATRIX' button to open the Modulation Matrix modal.
        # MOD MATRIX button
        elem = page.locator('[id="programmer-mod-matrix-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the 'SOURCE: NONE' dropdown for Modulation Slot 3 so a new source can be selected.
        # Source: None button
        elem = page.locator('[id="mod-src-btn-3"]')
        await elem.click(timeout=10000)
        
        # -> Select 'Mod Wheel' from the SOURCE dropdown for Modulation Slot 3 so the slot's source is changed.
        # Mod Wheel
        elem = page.locator('xpath=/html/body/div[2]/div[3]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the updated modulation configuration is displayed
        await page.locator("xpath=/html/body/div[1]/mod-matrix-modal/div/div/div[2]/div[3]/div[3]/div[2]/button[1]").nth(0).scroll_into_view_if_needed()
        # Assert: Modulation Slot 3 source is displayed as 'Source: Mod Wheel'.
        await expect(page.locator("xpath=/html/body/div[1]/mod-matrix-modal/div/div/div[2]/div[3]/div[3]/div[2]/button[1]").nth(0)).to_be_visible(timeout=15000), "Modulation Slot 3 source is displayed as 'Source: Mod Wheel'."
        await page.locator("xpath=/html/body/div[1]/mod-matrix-modal/div/div/div[2]/div[3]/div[3]/div[2]/button[2]").nth(0).scroll_into_view_if_needed()
        # Assert: Modulation Slot 3 destination is displayed as 'Dest: LFO1 Slew'.
        await expect(page.locator("xpath=/html/body/div[1]/mod-matrix-modal/div/div/div[2]/div[3]/div[3]/div[2]/button[2]").nth(0)).to_be_visible(timeout=15000), "Modulation Slot 3 destination is displayed as 'Dest: LFO1 Slew'."
        # Assert: Modulation Slot 3 depth is shown as '26'.
        await expect(page.locator("xpath=/html/body/div[1]/mod-matrix-modal/div/div/div[2]/div[3]/div[3]/div[4]/div[2]").nth(0)).to_have_text("26", timeout=15000), "Modulation Slot 3 depth is shown as '26'."
        
        # --> Verify the modulation matrix remains open
        await page.locator("xpath=/html/body/div[1]/mod-matrix-modal/div/div/div[1]/div").nth(0).scroll_into_view_if_needed()
        # Assert: The Modulation Matrix modal is open and its close button (×) is visible.
        await expect(page.locator("xpath=/html/body/div[1]/mod-matrix-modal/div/div/div[1]/div").nth(0)).to_be_visible(timeout=15000), "The Modulation Matrix modal is open and its close button (\u00d7) is visible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    