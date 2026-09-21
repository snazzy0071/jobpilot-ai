import { test, expect, type Page } from "@playwright/test";

// Site-wide scrollbar styling (src/app/globals.css). Public pages only, so this needs no accounts and
// doesn't touch the sign-in rate limit.

const computed = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      width: s.getPropertyValue("scrollbar-width"),
      color: s.getPropertyValue("scrollbar-color"),
      overscrollX: s.getPropertyValue("overscroll-behavior-x"),
      overscrollY: s.getPropertyValue("overscroll-behavior-y"),
    };
  });

test.describe("scrollbars", () => {
  test("nested scrollers are thin and contained, the page scrollbar keeps its normal width", async ({ page }) => {
    await page.goto("/compare");
    const root = await computed(page, "html");
    expect(root.width).toBe("auto");

    const table = await computed(page, ".overflow-x-auto");
    expect(table.width).toBe("thin");
    expect(table.overscrollX).toBe("contain");
    expect(table.color).not.toMatch(/auto/);
  });

  test("the scrollbar colours and colour-scheme follow the theme, with a visible thumb in both", async ({ page }) => {
    await page.goto("/compare");
    const thumbOf = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--scrollbar-thumb").trim());
    const schemeOf = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

    expect(await schemeOf()).toBe("light");
    const light = await thumbOf();
    expect(light).not.toBe("");

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    expect(await schemeOf()).toBe("dark");
    const dark = await thumbOf();
    expect(dark).not.toBe("");
    expect(dark).not.toBe(light);
  });

  test("a scroller that can't scroll vertically doesn't trap the page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto("/compare");
    const box = await page.locator(".overflow-x-auto").first().boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + Math.min(box!.height / 2, 100));
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });

  test("the page can't be scrolled sideways on a phone", async ({ page }) => {
    // scrollWidth is unreliable here (decorative glows are clipped, not scrollable — see globals.css), so ask
    // the browser what a sideways scroll actually does.
    await page.setViewportSize({ width: 375, height: 760 });
    for (const path of ["/", "/compare", "/pricing", "/blog"]) {
      await page.goto(path);
      await page.evaluate(() => window.scrollTo(200, 0));
      expect(await page.evaluate(() => window.scrollX), path).toBe(0);
    }
  });
});
