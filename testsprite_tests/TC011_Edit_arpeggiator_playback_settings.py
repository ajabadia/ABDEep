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
        
        # -> Click the 'ARP' button in the Programmer section to open the Arpeggiator modal.
        # ARP button
        elem = page.locator('[id="programmer-arp-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the 'Clock Rate' dropdown to prepare to change the arpeggiator rate.
        # 1/1 1/2 1/3 1/4 1/6 1/8 1/12 1/16 1/24 1/32 1/48... dropdown
        elem = page.locator('[id="modal-arp-clock-select"]')
        await elem.click(timeout=10000)
        
        # -> Select '1/8' in the 'Clock Rate' dropdown to change the arpeggiator rate.
        # 1/1 1/2 1/3 1/4 1/6 1/8 1/12 1/16 1/24 1/32 1/48... dropdown
        elem = page.locator("xpath=/html/body/div/arp-modal/div/div/div[2]/div[2]/div/div[2]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Change the 'Octave Range' dropdown to '3' and the 'Mode' dropdown to 'UP-DOWN', then verify the updated values are shown in the modal.
        # 1 2 3 4 dropdown
        elem = page.locator("xpath=/html/body/div/arp-modal/div/div/div[2]/div[2]/div/div[2]/div[4]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Change the 'Octave Range' dropdown to '3' and the 'Mode' dropdown to 'UP-DOWN', then verify the updated values are shown in the modal.
        # UP DOWN UP-DOWN UP-INV DOWN-INV UP-DN-INV UP-ALT... dropdown
        elem = page.locator("xpath=/html/body/div/arp-modal/div/div/div[2]/div[2]/div/div[2]/div[3]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # --> Assertions to verify final state
        
        # --> Verify the arpeggiator settings are displayed
        # Assert: Arpeggiator modal header is visible.
        await expect(page.locator("xpath=/html/body/div[1]/arp-modal/div").nth(0)).to_contain_text("Arpeggiator & Pattern Editor", timeout=15000), "Arpeggiator modal header is visible."
        # Assert: Clock Rate displays '1/8'.
        await expect(page.locator("xpath=/html/body/div[1]/arp-modal/div/div/div[2]/div[2]/div[1]/div[2]/div[1]/select").nth(0)).to_contain_text("1/8", timeout=15000), "Clock Rate displays '1/8'."
        # Assert: Mode displays 'UP-DOWN'.
        await expect(page.locator("xpath=/html/body/div[1]/arp-modal/div/div/div[2]/div[2]/div[1]/div[2]/div[3]/select").nth(0)).to_contain_text("UP-DOWN", timeout=15000), "Mode displays 'UP-DOWN'."
        # Assert: Octave Range displays '3'.
        await expect(page.locator("xpath=/html/body/div[1]/arp-modal/div/div/div[2]/div[2]/div[1]/div[2]/div[4]/select").nth(0)).to_contain_text("3", timeout=15000), "Octave Range displays '3'."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    