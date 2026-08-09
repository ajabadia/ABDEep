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
        
        # -> Close the 'LFO 1 Editor' modal by clicking the 'Edit' button, then open the FX modal by clicking the 'FX' button.
        # Edit button
        elem = page.locator('[id="lfo-edit-btn"]')
        await elem.click(timeout=10000)
        
        # -> Close the 'LFO 1 Editor' modal by clicking the 'Edit' button, then open the FX modal by clicking the 'FX' button.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the FX1 type dropdown and choose 'RoomRev' from the list (start by opening the FX1 dropdown).
        # BYPASS Ambience tcDeepVerb RoomRev VintageRoom... dropdown
        elem = page.locator('xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div/div/select')
        await elem.click(timeout=10000)
        
        # -> Choose 'RoomRev' from the FX1 dropdown, then set FX2 to 'tcDeepVerb', FX3 to 'Ambience', FX4 to 'HallReverb', and close the FX modal by clicking the modal close button.
        # BYPASS Ambience tcDeepVerb RoomRev VintageRoom... dropdown
        elem = page.locator("xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Choose 'RoomRev' from the FX1 dropdown, then set FX2 to 'tcDeepVerb', FX3 to 'Ambience', FX4 to 'HallReverb', and close the FX modal by clicking the modal close button.
        # BYPASS Ambience tcDeepVerb RoomRev VintageRoom... dropdown
        elem = page.locator("xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div[2]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Choose 'RoomRev' from the FX1 dropdown, then set FX2 to 'tcDeepVerb', FX3 to 'Ambience', FX4 to 'HallReverb', and close the FX modal by clicking the modal close button.
        # BYPASS Ambience tcDeepVerb RoomRev VintageRoom... dropdown
        elem = page.locator("xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div[3]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Choose 'RoomRev' from the FX1 dropdown, then set FX2 to 'tcDeepVerb', FX3 to 'Ambience', FX4 to 'HallReverb', and close the FX modal by clicking the modal close button.
        # BYPASS Ambience tcDeepVerb RoomRev VintageRoom... dropdown
        elem = page.locator("xpath=/html/body/div/fx-modal/div/div/div[2]/div[2]/div[4]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Choose 'RoomRev' from the FX1 dropdown, then set FX2 to 'tcDeepVerb', FX3 to 'Ambience', FX4 to 'HallReverb', and close the FX modal by clicking the modal close button.
        # ×
        elem = page.locator('[id="fx-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'FX' button to open the Effects Engine Rack modal so the current FX slot selections can be inspected.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '×' close button in the 'EFFECTS ENGINE RACK' modal to close it so persistence can be verified.
        # ×
        elem = page.locator('[id="fx-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'FX' button to open the Effects Engine Rack modal so the FX slot selections can be inspected.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '×' close button in the 'EFFECTS ENGINE RACK' modal to close it so persistence can be verified.
        # ×
        elem = page.locator('[id="fx-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'FX' button (label: FX) to open the Effects Engine Rack modal so the FX slot selections can be inspected.
        # FX button
        elem = page.locator('[id="programmer-fx-btn"]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the selected FX algorithms remain applied
        # Assert: FX1 displays the selected algorithm RoomRev.
        await expect(page.locator("xpath=/html/body/div[1]/fx-modal/div/div/div[2]/div[2]/div[1]/div[2]").nth(0)).to_have_text("RoomRev", timeout=15000), "FX1 displays the selected algorithm RoomRev."
        # Assert: FX2 displays the selected algorithm tcDeepVerb.
        await expect(page.locator("xpath=/html/body/div[1]/fx-modal/div/div/div[2]/div[2]/div[2]/div[2]").nth(0)).to_have_text("tcDeepVerb", timeout=15000), "FX2 displays the selected algorithm tcDeepVerb."
        # Assert: FX3 displays the selected algorithm Ambience.
        await expect(page.locator("xpath=/html/body/div[1]/fx-modal/div/div/div[2]/div[2]/div[3]/div[2]").nth(0)).to_have_text("Ambience", timeout=15000), "FX3 displays the selected algorithm Ambience."
        # Assert: FX4 displays the selected algorithm HallReverb.
        await expect(page.locator("xpath=/html/body/div[1]/fx-modal/div/div/div[2]/div[2]/div[4]/div[2]").nth(0)).to_have_text("HallReverb", timeout=15000), "FX4 displays the selected algorithm HallReverb."
        
        # --> Verify the main interface is still available
        await page.locator("xpath=/html/body/div[1]/top-bar/header/div[1]/div[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The main top bar (File menu) is visible, indicating the main interface is available.
        await expect(page.locator("xpath=/html/body/div[1]/top-bar/header/div[1]/div[1]").nth(0)).to_be_visible(timeout=15000), "The main top bar (File menu) is visible, indicating the main interface is available."
        await page.locator("xpath=/html/body/div[1]/top-bar/header/select").nth(0).scroll_into_view_if_needed()
        # Assert: The top-bar device selector is visible, confirming main UI controls are accessible.
        await expect(page.locator("xpath=/html/body/div[1]/top-bar/header/select").nth(0)).to_be_visible(timeout=15000), "The top-bar device selector is visible, confirming main UI controls are accessible."
        await page.locator("xpath=/html/body/div[1]/keyboard-section/div/div[1]/div[1]").nth(0).scroll_into_view_if_needed()
        # Assert: The keyboard section is visible, showing the main interface remains available behind the modal.
        await expect(page.locator("xpath=/html/body/div[1]/keyboard-section/div/div[1]/div[1]").nth(0)).to_be_visible(timeout=15000), "The keyboard section is visible, showing the main interface remains available behind the modal."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    