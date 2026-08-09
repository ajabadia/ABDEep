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
        
        # -> Open the 'Clock Rate' dropdown in the Arpeggiator modal and reveal its options.
        # 1/1 1/2 1/3 1/4 1/6 1/8 1/12 1/16 1/24 1/32 1/48... dropdown
        elem = page.locator('[id="modal-arp-clock-select"]')
        await elem.click(timeout=10000)
        
        # -> Set the 'Clock Rate' dropdown to '1/4'.
        # 1/1 1/2 1/3 1/4 1/6 1/8 1/12 1/16 1/24 1/32 1/48... dropdown
        elem = page.locator("xpath=/html/body/div/arp-modal/div/div/div[2]/div[2]/div/div[2]/div/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Close the Arpeggiator modal by clicking the modal's 'X' close button so the main UI (including the 'SEQ' control) becomes accessible.
        # ×
        elem = page.locator('[id="arp-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SEQ' button in the Programmer area to open the Sequencer modal.
        # SEQ button
        elem = page.locator('[id="programmer-seq-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Step 1' bar in the Sequencer to edit its note value, then close the Sequencer modal and locate the 'ARP' button to reopen the Arpeggiator.
        # 0 128
        elem = page.locator('xpath=/html/body/div/seq-modal/div/div/div[2]/div/div[2]/div')
        await elem.click(timeout=10000)
        
        # -> Click the 'Step 1' bar in the Sequencer to edit its note value, then close the Sequencer modal and locate the 'ARP' button to reopen the Arpeggiator.
        # ×
        elem = page.locator('[id="seq-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'ARP' button to re-open the Arpeggiator modal so the Clock Rate can be verified.
        # ARP button
        elem = page.locator('[id="programmer-arp-btn"]')
        await elem.click(timeout=10000)
        
        # -> Close the Arpeggiator modal by clicking the '×' close button so the main UI is accessible (then open the Sequencer to verify the edited step).
        # ×
        elem = page.locator('[id="arp-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'ARP' button to open the Arpeggiator modal and verify the Clock Rate remains set to '1/4'.
        # ARP button
        elem = page.locator('[id="programmer-arp-btn"]')
        await elem.click(timeout=10000)
        
        # -> Check that the Clock Rate shows '1/4' in the Arpeggiator modal, then close the Arpeggiator modal and locate the 'SEQ' button to open the Sequencer.
        # ×
        elem = page.locator('[id="arp-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the Arpeggiator modal by clicking the 'ARP' button and verify the Clock Rate shows '1/4'.
        # ARP button
        elem = page.locator('[id="programmer-arp-btn"]')
        await elem.click(timeout=10000)
        
        # -> Close the 'Arpeggiator & Pattern Editor' modal, then search the page for the visible 'SEQ' label so the Sequencer modal can be opened to verify the edited step.
        # ×
        elem = page.locator('[id="arp-modal-close-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SEQ' button to open the Sequencer modal so the edited step can be verified.
        # SEQ button
        elem = page.locator('[id="programmer-seq-btn"]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the arpeggiator settings remain applied
        # Assert: Arpeggiator clock rate shows '1/4' in the Clock selector.
        await expect(page.locator("xpath=/html/body/div[1]/seq-modal/div/div/div[2]/div[2]/div[1]/div[2]/div[1]/select").nth(0)).to_contain_text("1/4", timeout=15000), "Arpeggiator clock rate shows '1/4' in the Clock selector."
        
        # --> Verify the edited sequence steps remain applied
        # Assert: Step 1 shows the edited note "+30".
        await expect(page.locator("xpath=/html/body/div[1]/seq-modal/div/div/div[2]/div[1]/div[2]/div[1]/div[1]").nth(0)).to_have_text("+30", timeout=15000), "Step 1 shows the edited note \"+30\"."
        # Assert: Step 1 displays the edited values "+30 158".
        await expect(page.locator("xpath=/html/body/div[1]/seq-modal/div/div/div[2]/div[1]/div[2]/div[1]").nth(0)).to_have_text("+30\n158", timeout=15000), "Step 1 displays the edited values \"+30 158\"."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    