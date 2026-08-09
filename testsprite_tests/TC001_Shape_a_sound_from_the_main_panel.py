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
        
        # -> Open the Oscillators editor by clicking the 'Edit' button in the Oscillators section and then click a representative oscillator control to adjust it.
        # Edit button
        elem = page.locator('[id="osc-edit-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the Oscillators editor by clicking the 'Edit' button in the Oscillators section and then click a representative oscillator control to adjust it.
        # Open the Oscillators editor by clicking the 'Edit' button in the Oscillators section and then click a representative oscillator control to adjust it.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div[2]/osc-section/div/div[3]/div/div')
        await elem.click(timeout=10000)
        
        # -> Open the Oscillators editor by clicking the 'Edit' button in the Oscillators section and then click a representative oscillator control to adjust it.
        # Edit button
        elem = page.locator('[id="vcf-edit-btn"]')
        await elem.click(timeout=10000)
        
        # -> Open the Oscillators editor by clicking the 'Edit' button in the Oscillators section and then click a representative oscillator control to adjust it.
        # Open the Oscillators editor by clicking the 'Edit' button in the Oscillators section and then click a representative oscillator control to adjust it.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div[2]/vcf-section/div/div[2]/div/div')
        await elem.click(timeout=10000)
        
        # -> Open the Oscillators editor by clicking the 'Edit' button in the Oscillators section and then click a representative oscillator control to adjust it.
        # Edit button
        elem = page.locator('[id="env-edit-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly/Detune area to adjust an oscillator-related control.
        # Click the 'Detune' slider in the Poly/Detune area to adjust an oscillator-related control.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div/poly-section/div/div[2]/div/div')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly/Detune area to adjust an oscillator-related control.
        # Click the 'Detune' slider in the Poly/Detune area to adjust an oscillator-related control.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div[2]/vcf-section/div/div[2]/div/div')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly/Detune area to adjust an oscillator-related control.
        # Click the 'Detune' slider in the Poly/Detune area to adjust an oscillator-related control.
        elem = page.locator('xpath=/html/body/div/side-panel/div/div[3]/div[4]/div/div')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' sections are still displayed.
        # Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' sections are still displayed.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div/poly-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' sections are still displayed.
        # Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' sections are still displayed.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div[2]/vcf-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' sections are still displayed.
        # Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' sections are still displayed.
        elem = page.locator('xpath=/html/body/div/side-panel/div/div[3]/div[4]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' labels are still visible.
        # Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' labels are still visible.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div/poly-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' labels are still visible.
        # Click the 'Detune' slider in the Poly section, then the 'Freq' slider in the VCF section, then the 'Attack' slider in the VCA ENV EDITOR, and verify the 'Oscillators', 'VCF', and 'Envelopes' labels are still visible.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div[2]/vcf-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly section to adjust the oscillator control.
        # Click the 'Detune' slider in the Poly section to adjust the oscillator control.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div/poly-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly section to adjust the oscillator control.
        # Click the 'Detune' slider in the Poly section to adjust the oscillator control.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div[2]/vcf-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider in the Poly section to adjust the oscillator control.
        # Click the 'Detune' slider in the Poly section to adjust the oscillator control.
        elem = page.locator('xpath=/html/body/div/side-panel/div/div[3]/div[4]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider, then the 'Freq' slider, then the 'Attack' envelope slider, and verify that the 'Oscillators', 'VCF', and 'Envelopes' labels are still visible on the page.
        # Click the 'Detune' slider, then the 'Freq' slider, then the 'Attack' envelope slider, and verify that the 'Oscillators', 'VCF', and 'Envelopes' labels are still visible on the page.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div/poly-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Detune' slider, then the 'Freq' slider, then the 'Attack' envelope slider, and verify that the 'Oscillators', 'VCF', and 'Envelopes' labels are still visible on the page.
        # Click the 'Detune' slider, then the 'Freq' slider, then the 'Attack' envelope slider, and verify that the 'Oscillators', 'VCF', and 'Envelopes' labels are still visible on the page.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div[2]/vcf-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the main sound-design sections are still displayed
        await page.locator("xpath=/html/body/div[1]/control-grid/div/div[2]/osc-section/div/div[1]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Oscillators section (its Edit button) is visible.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[2]/osc-section/div/div[1]/button").nth(0)).to_be_visible(timeout=15000), "The Oscillators section (its Edit button) is visible."
        await page.locator("xpath=/html/body/div[1]/control-grid/div/div[2]/vcf-section/div/div[1]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The VCF section (its Edit button) is visible.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[2]/vcf-section/div/div[1]/button").nth(0)).to_be_visible(timeout=15000), "The VCF section (its Edit button) is visible."
        await page.locator("xpath=/html/body/div[1]/control-grid/div/div[2]/env-section/div/div[1]/button").nth(0).scroll_into_view_if_needed()
        # Assert: The Envelopes section (its Edit button) is visible.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[2]/env-section/div/div[1]/button").nth(0)).to_be_visible(timeout=15000), "The Envelopes section (its Edit button) is visible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    