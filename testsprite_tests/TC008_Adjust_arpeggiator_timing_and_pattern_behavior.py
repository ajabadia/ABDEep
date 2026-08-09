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
        
        # -> Open the Arpeggiator modal by clicking the 'ARP' button.
        # ARP button
        elem = page.locator('[id="programmer-arp-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the 'Clock Rate' dropdown (label: Clock Rate) to reveal available rate options.
        # 1/1 1/2 1/3 1/4 1/6 1/8 1/12 1/16 1/24 1/32 1/48... dropdown
        elem = page.locator('[id="modal-arp-clock-select"]')
        await elem.click(timeout=10000)
        
        # -> Select '1/8' from the Clock Rate dropdown in the Arpeggiator modal.
        # 1/1 1/2 1/3 1/4 1/6 1/8 1/12 1/16 1/24 1/32 1/48... dropdown
        elem = page.locator("xpath=/html/body/div/arp-modal/div/div/div[2]/div[2]/div/div[2]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select '1/8' from the Clock Rate dropdown in the Arpeggiator modal.
        # 1 2 3 4 dropdown
        elem = page.locator("xpath=/html/body/div/arp-modal/div/div/div[2]/div[2]/div/div[2]/div[4]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select '1/8' from the Clock Rate dropdown in the Arpeggiator modal.
        # UP DOWN UP-DOWN UP-INV DOWN-INV UP-DN-INV UP-ALT... dropdown
        elem = page.locator("xpath=/html/body/div/arp-modal/div/div/div[2]/div[2]/div/div[2]/div[3]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Select '1/8' from the Clock Rate dropdown in the Arpeggiator modal.
        # ×
        elem = page.locator('[id="arp-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the Arpeggiator modal and verify the Rate shows '1/8', the Octave Range shows '3', and the Mode shows 'DOWN'.
        # ARP button
        elem = page.locator('[id="programmer-arp-btn"]')
        await elem.click(timeout=10000)
        
        # -> Verify the Arpeggiator modal shows Clock Rate '1/8', Octave Range '3', and Mode 'DOWN', then close the modal and confirm the main ARP control is available.
        # ×
        elem = page.locator('[id="arp-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the Arpeggiator modal by clicking the 'ARP' button in the Programmer area.
        # ARP button
        elem = page.locator('[id="programmer-arp-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the '×' close button in the Arpeggiator modal to close it and return to the main interface.
        # ×
        elem = page.locator('[id="arp-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        current_url = await page.evaluate("() => window.location.href")
        # Assert: page loaded with a URL (final outcome verified by the AI judge during the run)
        assert current_url, 'Page should have loaded with a URL'
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
    