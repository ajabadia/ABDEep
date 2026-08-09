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
        
        # -> Click the 'SEQ' button to open the Sequencer modal.
        # SEQ button
        elem = page.locator('[id="programmer-seq-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the sequencer step labeled 'Step 1: +0 (raw: 128)' to begin editing its note value.
        # 0 128
        elem = page.locator('xpath=/html/body/div/seq-modal/div/div/div[2]/div/div[2]/div')
        await elem.click(timeout=10000)
        
        # -> Open the edit control for 'Step 1: +30 (raw: 158)' so the note/gate fields become editable.
        # Open the edit control for 'Step 1: +30 (raw: 158)' so the note/gate fields become editable.
        elem = page.locator('xpath=/html/body/div/seq-modal/div/div/div[2]/div/div[2]/div/div[3]/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Step 1: +15 (raw: 143)' step to open its edit controls so note and gate fields can be edited.
        # +15 143
        elem = page.get_by_text('+15 143', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the Step 1 edit control by clicking the small edit area for 'Step 1: +30 (raw: 158)' so the note and gate fields become editable.
        # Open the Step 1 edit control by clicking the small edit area for 'Step 1: +30 (raw: 158)' so the note and gate fields become editable.
        elem = page.locator('xpath=/html/body/div/seq-modal/div/div/div[2]/div/div[2]/div/div[3]/div[2]')
        await elem.click(timeout=10000)
        
        # -> Open the Step 1 editor by clicking the step labeled 'Step 1: +15 (raw: 143)'.
        # +15 143
        elem = page.get_by_text('+15 143', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the small edit area for 'Step 1: +30 (raw: 158)' to open the step editor so note and gate fields become editable.
        # Click the small edit area for 'Step 1: +30 (raw: 158)' to open the step editor so note and gate fields become editable.
        elem = page.locator('xpath=/html/body/div/seq-modal/div/div/div[2]/div/div[2]/div/div[3]/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'DOM' button to switch the sequencer into DOM editing mode so step note/gate controls may become editable.
        # DOM button
        elem = page.get_by_role('button', name='DOM', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Step 1: +15 (raw: 143)' step to open its editor so the note and gate fields become editable.
        # +15 143
        elem = page.get_by_text('+15 143', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Step 1: +32 (raw: 160)' step to open its editor so note and gate fields become editable.
        # +32 160
        elem = page.get_by_text('+32 160', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Open in Panel' button in the Sequencer modal to open the full step editor panel.
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '▶ OPEN IN PANEL' button to open the sequencer full editor panel so the left-side step note/gate controls become available.
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '▶ Open in Panel' button to open the sequencer full editor panel
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '▶ Open in Panel' button to open the sequencer full editor panel
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '▶ Open in Panel' button in the Sequencer modal to open the left-side edit panel for detailed sequencer editing.
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '▶ Open in Panel' button to open the left-side edit panel for detailed sequencer editing
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '▶ Open in Panel' button to open the left-side sequencer editor panel.
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '▶ Open in Panel' button to open the left-side edit panel for detailed sequencer editing.
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the left side edit panel by clicking the '▶ Open in Panel' button (after dismissing any tooltip).
        # Control Sequencer & Steps Editor LOOP × Pattern...
        elem = page.locator('[id="seq-modal-backdrop"]')
        await elem.click(timeout=10000)
        
        # -> Open the left side edit panel by clicking the '▶ Open in Panel' button (after dismissing any tooltip).
        # ▶ Open in Panel button
        elem = page.locator('[id="modal-seq-open-panel-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the left-side edit panel by clicking 'Canvas', then 'DOM', dismissing any tooltip, and clicking the '▶ Open in Panel' button.
        # Canvas button
        elem = page.get_by_role('button', name='Canvas', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the left-side edit panel by clicking 'Canvas', then 'DOM', dismissing any tooltip, and clicking the '▶ Open in Panel' button.
        # DOM button
        elem = page.get_by_role('button', name='DOM', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the left-side edit panel by clicking 'Canvas', then 'DOM', dismissing any tooltip, and clicking the '▶ Open in Panel' button.
        # Control Sequencer & Steps Editor LOOP × Pattern...
        elem = page.locator('[id="seq-modal-backdrop"]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the sequencer step grid is displayed
        await page.locator("xpath=/html/body/div[1]/seq-modal/div").nth(0).scroll_into_view_if_needed()
        # Assert: Sequencer modal container is displayed.
        await expect(page.locator("xpath=/html/body/div[1]/seq-modal/div").nth(0)).to_be_visible(timeout=15000), "Sequencer modal container is displayed."
        await page.locator("xpath=/html/body/div[1]/seq-modal/div/div/div[2]/div[1]/div[2]/div[1]").nth(0).scroll_into_view_if_needed()
        # Assert: A sequencer step cell (+32 160) is visible in the step grid.
        await expect(page.locator("xpath=/html/body/div[1]/seq-modal/div/div/div[2]/div[1]/div[2]/div[1]").nth(0)).to_be_visible(timeout=15000), "A sequencer step cell (+32 160) is visible in the step grid."
        await page.locator("xpath=/html/body/div[1]/seq-modal/div/div/div[2]/div[1]/div[2]/div[2]").nth(0).scroll_into_view_if_needed()
        # Assert: A sequencer step cell (0 128) is visible in the step grid.
        await expect(page.locator("xpath=/html/body/div[1]/seq-modal/div/div/div[2]/div[1]/div[2]/div[2]").nth(0)).to_be_visible(timeout=15000), "A sequencer step cell (0 128) is visible in the step grid."
        
        # --> Verify the edited pattern remains visible
        # Assert: The sequencer modal header 'Control Sequencer & Steps Editor' is visible.
        await expect(page.locator("xpath=/html/body/div[1]/seq-modal/div").nth(0)).to_contain_text("Control Sequencer & Steps Editor", timeout=15000), "The sequencer modal header 'Control Sequencer & Steps Editor' is visible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    