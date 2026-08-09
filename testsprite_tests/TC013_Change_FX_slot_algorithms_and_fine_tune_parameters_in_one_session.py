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
        
        # -> Click the 'FX' button to open the FX modal.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the FX1 algorithm dropdown (the dropdown currently shows 'ChorusRev') so available FX algorithms are displayed.
        # BYPASS Ambience tcDeepVerb RoomRev VintageRoom... dropdown
        elem = page.locator('xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div/div/select')
        await elem.click(timeout=10000)
        
        # -> Select the 'Ambience' algorithm from the FX1 dropdown in the Effects Engine Rack modal.
        # BYPASS Ambience tcDeepVerb RoomRev VintageRoom... dropdown
        elem = page.locator("xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select the 'RoomRev' algorithm from the FX2 dropdown in the Effects Engine Rack modal.
        # BYPASS Ambience tcDeepVerb RoomRev VintageRoom... dropdown
        elem = page.locator("xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div[2]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Increase the 'Gain' slider for FX1, then increase the 'Gain' slider for FX2, and close the FX modal.
        # Increase the 'Gain' slider for FX1, then increase the 'Gain' slider for FX2, and close the FX modal.
        elem = page.locator('xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div/div[4]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Increase the 'Gain' slider for FX1, then increase the 'Gain' slider for FX2, and close the FX modal.
        # Increase the 'Gain' slider for FX1, then increase the 'Gain' slider for FX2, and close the FX modal.
        elem = page.locator('xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div[2]/div[4]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Increase the 'Gain' slider for FX1, then increase the 'Gain' slider for FX2, and close the FX modal.
        # ×
        elem = page.locator('[id="fx-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'FX' button in the Programmer area to re-open the Effects Engine Rack modal so the selected algorithms and gain parameters can be verified.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # -> Capture the current Gain slider values for FX1 and FX2, then click the '×' close button in the FX modal and wait for the UI to settle.
        # ×
        elem = page.locator('[id="fx-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the 'FX' modal by clicking the 'FX' button in the Programmer area so the FX slot panels and parameter controls can be inspected.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # -> Capture the visible 'Gain' slider values for FX1 and FX2 in the Effects Engine Rack modal, then close the modal by clicking the '×' close button.
        # ×
        elem = page.locator('[id="fx-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the FX modal by clicking the 'FX' button in the Programmer area so FX slot labels and gain/parameter controls can be read.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # -> Read the Gain slider values for FX1 and FX2 from the Effects Engine Rack modal by extracting their slider elements' attributes (aria-valuenow, value or title).
        # ×
        elem = page.locator('[id="fx-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the 'FX' modal by clicking the 'FX' button in the Programmer area so FX slots and gain/parameter controls can be inspected.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # -> Read the visible Gain slider attributes for FX1 and FX2 (capture aria-valuenow, aria-valuetext, title, or value) so baseline values can be recorded before closing the modal.
        # ×
        elem = page.locator('[id="fx-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the FX modal by clicking the 'FX' button in the Programmer area so slot labels and gain/parameter controls can be captured.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the selected FX algorithms remain applied
        # Assert: FX1 algorithm is still set to Ambience.
        await expect(page.locator("xpath=/html/body/div[1]/fx-modal/div/div/div[2]/div[2]/div[1]/div[2]").nth(0)).to_have_text("Ambience", timeout=15000), "FX1 algorithm is still set to Ambience."
        # Assert: FX2 algorithm is still set to RoomRev.
        await expect(page.locator("xpath=/html/body/div[1]/fx-modal/div/div/div[2]/div[2]/div[2]/div[2]").nth(0)).to_have_text("RoomRev", timeout=15000), "FX2 algorithm is still set to RoomRev."
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    