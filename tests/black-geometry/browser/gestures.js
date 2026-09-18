/**
 * Chromium synthesizes a browser gesture with begin/change/end phases. A raw
 * Playwright wheel packet cannot model those phases. This API does not provide
 * a fling velocity, so preventFling:false is not a physical inertial fling test.
 * WebKit's automation protocol exposes wheel deltas only; its checks exercise
 * native wheel navigation, not macOS trackpad momentum or finger release.
 */
export async function swipe(page, browserName, direction, { x = 1100, y = 450, distance = 600, speed = 2500 } = {}) {
  await page.mouse.move(x, y);
  if (browserName === 'chromium') {
    const session = await page.context().newCDPSession(page);
    try {
      await session.send('Input.synthesizeScrollGesture', {
        gestureSourceType: 'mouse', x, y,
        yDistance: -direction * distance, speed, preventFling: false,
      });
    } finally {
      await session.detach();
    }
  } else {
    await page.mouse.wheel(0, direction * distance);
  }
}
