// The reader's three modes in headless Chromium at phone and desktop size, on a real minted issue: scroll, page
// turns (buttons, arrow keys), guided panel-by-panel (keys and swipe), full screen, the remembered mode, and a
// clean console.   node scripts/e2e-reader.mjs     (app on :4320; no AI spend)
import { chromium } from "playwright";

const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const comics = (await (await fetch(`${BASE}/api/comics`)).json()).comics;
const comic = [...comics].sort((a, b) => b.pageCount - a.pageCount)[0];
const panels = comic.pageCount * 4;

const browser = await chromium.launch();
try {
  for (const [size, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, hasTouch: size === "phone", isMobile: size === "phone" });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${BASE}/c/${comic.id}/read`, { waitUntil: "networkidle" });
    const pos = () => page.locator("[aria-live=polite]").filter({ hasText: /Page|Panel/ }).first().innerText();

    const scrollPages = await page.locator("[data-page]").count();
    check(`R1-${size}`, "scroll mode shows every page", scrollPages === comic.pageCount, `${scrollPages} pages`);

    await page.getByRole("radio", { name: "Pages" }).click();
    const p1 = await pos();
    if (comic.pageCount > 1) {
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(300);
    }
    const p2 = await pos();
    check(`R2-${size}`, "pages mode: one page at a time, arrow keys turn", p1 === `Page 1 of ${comic.pageCount}` && (comic.pageCount === 1 || p2 === `Page 2 of ${comic.pageCount}`), `${p1} → ${p2}`);

    await page.getByRole("radio", { name: "Guided" }).click();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    const g2 = await pos();
    await page.getByRole("button", { name: /Next/ }).click();
    await page.waitForTimeout(300);
    const g3 = await pos();
    // A leftward drag turns forward (pointer events, which phones also send).
    const box = await page.locator(".comic-sheet").first().boundingBox();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const g4 = await pos();
    const oneFigure = (await page.locator(".comic-sheet figure").count()) === 1;
    check(`R3-${size}`, "guided mode: one panel at a time with its lettering; keys, button and swipe step through", g2.startsWith(`Panel 2 of ${panels}`) && g3.startsWith(`Panel 3 of ${panels}`) && g4.startsWith(`Panel 4 of ${panels}`) && oneFigure, `${g2} → ${g3} → ${g4}`);

    await page.getByRole("button", { name: "Full screen" }).click();
    await page.waitForTimeout(400);
    const isFull = await page.evaluate(() => Boolean(document.fullscreenElement));
    if (isFull) await page.getByRole("button", { name: "Exit full screen" }).click();
    check(`R4-${size}`, "full screen toggles", isFull);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const remembered = await page.getByRole("radio", { name: "Guided" }).getAttribute("aria-checked");
    check(`R5-${size}`, "the chosen mode is remembered", remembered === "true");
    check(`R6-${size}`, "clean console", errors.length === 0, errors.slice(0, 2).join(" | "));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
