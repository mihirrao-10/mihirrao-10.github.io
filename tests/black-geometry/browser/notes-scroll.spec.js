import { test, expect } from '@playwright/test';

for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
  test(`notes scroll cue leaves space and tracks the list at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#notes');
    const notes = page.locator('#notes');
    const cue = page.locator('.notes-scroll-hint');
    await expect(cue).toBeVisible();
    const bounds = await notes.evaluate(element => {
      const panel = element.getBoundingClientRect();
      const cue = element.querySelector('.notes-scroll-hint').getBoundingClientRect();
      return { bottom: panel.bottom, cueTop: cue.top, cueBottom: cue.bottom, viewport: innerHeight };
    });
    expect(bounds.cueTop).toBeGreaterThan(bounds.bottom);
    expect(bounds.cueBottom).toBeLessThan(bounds.viewport);
    await notes.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    await expect(notes).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('End');
    await expect(cue).toBeHidden();
    await page.keyboard.press('Home');
    await expect(cue).toBeVisible();
    await page.locator('.site-index a[href="#top"]').click();
    await expect(cue).toBeHidden();
    await page.locator('.site-index a[href="#notes"]').click();
    await expect(cue).toBeVisible();
    await notes.evaluate(element => { element.style.maxHeight = 'none'; });
    await expect(cue).toBeHidden();
  });
}
