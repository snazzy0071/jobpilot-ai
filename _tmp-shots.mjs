import { chromium } from "@playwright/test";

const out = "C:/Users/ANBGRA~1/AppData/Local/Temp/claude/d--xampp-htdocs-rizzume/0d5bf455-61ed-4377-8818-8106e820b870/scratchpad";
const routes = process.argv.slice(2);
const browser = await chromium.launch();
const results = [];
for (const [label, viewport] of [["d", { width: 1440, height: 900 }], ["m", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const route of routes) {
    await page.goto(`http://localhost:3000${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    // scroll through so whileInView reveals fire
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += 500) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(90);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    const name = `${label}${route.replace(/\//g, "_") || "_home"}.png`;
    await page.screenshot({ path: `${out}/${name}`, fullPage: true });
    results.push(`${label} ${route} h=${h} hscroll=${overflow}`);
  }
  if (errors.length) results.push(`ERRORS(${label}): ${[...new Set(errors)].slice(0, 5).join(" | ")}`);
  await context.close();
}
await browser.close();
console.log(results.join("\n"));
