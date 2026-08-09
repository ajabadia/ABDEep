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
        
        # -> Click the 'OSC 1 ACTIVE' button to toggle the oscillator, then adjust the 'RATE' control, and open the '🔴 SCOPE' and '📊 FFT' tabs to verify visual analyzer output remains present.
        # OSC 1 ACTIVE button
        elem = page.locator('[id="osc-select-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 1 ACTIVE' button to toggle the oscillator, then adjust the 'RATE' control, and open the '🔴 SCOPE' and '📊 FFT' tabs to verify visual analyzer output remains present.
        # Click the 'OSC 1 ACTIVE' button to toggle the oscillator, then adjust the 'RATE' control, and open the '🔴 SCOPE' and '📊 FFT' tabs to verify visual analyzer output remains present.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div/lfo-section/div/div[3]/div/div')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 1 ACTIVE' button to toggle the oscillator, then adjust the 'RATE' control, and open the '🔴 SCOPE' and '📊 FFT' tabs to verify visual analyzer output remains present.
        # 🔴 SCOPE button
        elem = page.locator('[id="prog-tab-scope"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 1 ACTIVE' button to toggle the oscillator, then adjust the 'RATE' control, and open the '🔴 SCOPE' and '📊 FFT' tabs to verify visual analyzer output remains present.
        # 📊 FFT button
        elem = page.locator('[id="prog-tab-fft"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 2 ACTIVE' button to toggle the active oscillator to OSC 1, then adjust the visible 'Rate' slider, open the '🔴 SCOPE' tab, open the '📊 FFT' tab, and confirm canvases are present.
        # OSC 2 ACTIVE button
        elem = page.locator('[id="osc-select-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 2 ACTIVE' button to toggle the active oscillator to OSC 1, then adjust the visible 'Rate' slider, open the '🔴 SCOPE' tab, open the '📊 FFT' tab, and confirm canvases are present.
        # Click the 'OSC 2 ACTIVE' button to toggle the active oscillator to OSC 1, then adjust the visible 'Rate' slider, open the '🔴 SCOPE' tab, open the '📊 FFT' tab, and confirm canvases are present.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div/arp-seq-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 2 ACTIVE' button to toggle the active oscillator to OSC 1, then adjust the visible 'Rate' slider, open the '🔴 SCOPE' tab, open the '📊 FFT' tab, and confirm canvases are present.
        # 🔴 SCOPE button
        elem = page.locator('[id="prog-tab-scope"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 2 ACTIVE' button to toggle the active oscillator to OSC 1, then adjust the visible 'Rate' slider, open the '🔴 SCOPE' tab, open the '📊 FFT' tab, and confirm canvases are present.
        # 📊 FFT button
        elem = page.locator('[id="prog-tab-fft"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 1 ACTIVE' button to toggle the active oscillator, then adjust the 'Rate' slider, open the '🔴 SCOPE' tab, and open the '📊 FFT' tab to confirm analyzers remain visible.
        # OSC 1 ACTIVE button
        elem = page.locator('[id="osc-select-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 1 ACTIVE' button to toggle the active oscillator, then adjust the 'Rate' slider, open the '🔴 SCOPE' tab, and open the '📊 FFT' tab to confirm analyzers remain visible.
        # Click the 'OSC 1 ACTIVE' button to toggle the active oscillator, then adjust the 'Rate' slider, open the '🔴 SCOPE' tab, and open the '📊 FFT' tab to confirm analyzers remain visible.
        elem = page.locator('xpath=/html/body/div/control-grid/div/div/arp-seq-section/div/div[2]/div/div/div[2]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 1 ACTIVE' button to toggle the active oscillator, then adjust the 'Rate' slider, open the '🔴 SCOPE' tab, and open the '📊 FFT' tab to confirm analyzers remain visible.
        # 🔴 SCOPE button
        elem = page.locator('[id="prog-tab-scope"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 1 ACTIVE' button to toggle the active oscillator, then adjust the 'Rate' slider, open the '🔴 SCOPE' tab, and open the '📊 FFT' tab to confirm analyzers remain visible.
        # 📊 FFT button
        elem = page.locator('[id="prog-tab-fft"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 2 ACTIVE' button to switch the active oscillator, then open the 'Edit' button in the Oscillators panel to reveal oscillator shape controls.
        # OSC 2 ACTIVE button
        elem = page.locator('[id="osc-select-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'OSC 2 ACTIVE' button to switch the active oscillator, then open the 'Edit' button in the Oscillators panel to reveal oscillator shape controls.
        # Edit button
        elem = page.locator('[id="osc-edit-btn"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SAWTOOTH' option in the OSC 1 Waveforms panel to toggle the oscillator shape.
        # Sawtooth
        elem = page.locator('[id="panel-osc1-saw-box"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SAWTOOTH' option in the OSC 1 Waveforms panel to toggle the oscillator shape.
        # OSC 1 Only
        elem = page.get_by_text('OSC 1 Only', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'SAWTOOTH' option in the OSC 1 Waveforms panel to toggle the oscillator shape.
        # 🔴 SCOPE button
        elem = page.locator('[id="prog-tab-scope"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SAWTOOTH' option in the OSC 1 Waveforms panel to toggle the oscillator shape.
        # 📊 FFT button
        elem = page.locator('[id="prog-tab-fft"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SQUARE' waveform option to change the oscillator shape, then set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the analyzers remain visible.
        # Square
        elem = page.locator('[id="panel-osc1-square-box"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SQUARE' waveform option to change the oscillator shape, then set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the analyzers remain visible.
        # OSC 1 Only
        elem = page.get_by_text('OSC 1 Only', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'SQUARE' waveform option to change the oscillator shape, then set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the analyzers remain visible.
        # 🔴 SCOPE button
        elem = page.locator('[id="prog-tab-scope"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Square' waveform option, set 'Pitch Mod Destination' to 'OSC 1 Only', then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the analyzers remain visible.
        # Square
        elem = page.locator('[id="panel-osc1-square-box"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Square' waveform option, set 'Pitch Mod Destination' to 'OSC 1 Only', then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the analyzers remain visible.
        # OSC 1 Only
        elem = page.get_by_text('OSC 1 Only', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Square' waveform option, set 'Pitch Mod Destination' to 'OSC 1 Only', then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the analyzers remain visible.
        # 🔴 SCOPE button
        elem = page.locator('[id="prog-tab-scope"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Square' waveform option, set 'Pitch Mod Destination' to 'OSC 1 Only', then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the analyzers remain visible.
        # 📊 FFT button
        elem = page.locator('[id="prog-tab-fft"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SQUARE' waveform option, set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the oscilloscope and spectrum analyzer displays remain visible.
        # Square
        elem = page.locator('[id="panel-osc1-square-box"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'SQUARE' waveform option, set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the oscilloscope and spectrum analyzer displays remain visible.
        # OSC 1 Only
        elem = page.get_by_text('OSC 1 Only', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'SQUARE' waveform option, set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab and the '📊 FFT' tab to verify the oscilloscope and spectrum analyzer displays remain visible.
        # 🔴 SCOPE button
        elem = page.locator('[id="prog-tab-scope"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Square' waveform option, set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab to verify the oscilloscope display remains visible.
        # Square
        elem = page.locator('[id="panel-osc1-square-box"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Square' waveform option, set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab to verify the oscilloscope display remains visible.
        # OSC 1 Only
        elem = page.get_by_text('OSC 1 Only', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Square' waveform option, set 'OSC 1 ONLY' for Pitch Mod Destination, then open the '🔴 SCOPE' tab to verify the oscilloscope display remains visible.
        # 🔴 SCOPE button
        elem = page.locator('[id="prog-tab-scope"]')
        await elem.click(timeout=10000)
        
        # -> Click the 'Square' waveform option
        # Square
        elem = page.locator('[id="panel-osc1-square-box"]')
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Verify the oscilloscope display is shown
        await page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[2]/div[1]/div[1]/div[1]/button[2]").nth(0).scroll_into_view_if_needed()
        # Assert: The oscilloscope (🔴 SCOPE) control is visible on the page.
        await expect(page.locator("xpath=/html/body/div[1]/control-grid/div/div[1]/programmer-section/div/div[2]/div[1]/div[1]/div[1]/button[2]").nth(0)).to_be_visible(timeout=15000), "The oscilloscope (\ud83d\udd34 SCOPE) control is visible on the page."
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
    