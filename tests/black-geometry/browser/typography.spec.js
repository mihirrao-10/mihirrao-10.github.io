import { test, expect } from '@playwright/test';

for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) {
  test(`shared text roles stay consistent at ${width} × ${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('**/generated/world-*.js', route => route.abort());
    await page.goto('/');
    await expect(page.locator('.site-loader')).toBeHidden();
    for (const selector of ['.entry-title, .note-link', '.entry-detail, .course-list', '.entry-dates, .entry-location, .note-byline', '.navigation-hint, .notes-scroll-hint, .rotation-hint']) {
      const sizes = await page.locator(selector).evaluateAll(elements => elements.map(element => getComputedStyle(element).fontSize));
      expect(new Set(sizes).size, selector).toBe(1);
    }
    const colors = await page.locator('.entry-dates, .entry-location, .note-byline, .notes-scroll-hint').evaluateAll(elements => elements.map(element => getComputedStyle(element).color));
    expect(new Set(colors).size).toBe(1);
    const lefts = [];
    for (const id of ['education', 'experience', 'teaching', 'personal-projects', 'notes']) {
      await page.locator(`.site-index a[href="#${id}"]`).click();
      lefts.push(await page.locator(`#${id}`).evaluate(element => element.getBoundingClientRect().left));
      await expect(page.locator(`#${id}`)).toHaveCSS('text-align', 'left');
    }
    expect(new Set(lefts).size).toBe(1);
  });
}
