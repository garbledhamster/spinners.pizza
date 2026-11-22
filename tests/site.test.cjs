const assert = require("node:assert/strict");
const { test } = require("node:test");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium, webkit } = require("playwright");

const preview = pathToFileURL(resolve(__dirname, "../index.html")).href;
const actionLinks = [/^Menu$/, /^Hours$/, /^Call for Carry-Out/i, /^Directions/i];

async function openPreview(browser, options = {}) {
  const page = await browser.newPage(options);
  const errors = [];
  const remoteRequests = [];
  await page.route(/^https?:/, async (route) => {
    remoteRequests.push(route.request().url());
    await route.abort();
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(2500);
  await page.goto(preview, { timeout: 10000 });
  return { page, errors, remoteRequests };
}

test("assembled Counter Ticket visitor paths", { timeout: 20000 }, async (suite) => {
  const useWebKit = process.env.SPINNERS_BROWSER === "webkit";
  const browser = useWebKit
    ? await webkit.launch()
    : await chromium.launch({ executablePath: process.env.SPINNERS_CHROME });
  suite.after(() => browser.close());

  await suite.test("all four phone actions fit and point to rendered destinations", async () => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
      const { page, errors, remoteRequests } = await openPreview(browser, { viewport, hasTouch: true });
      try {
        const actions = page.getByRole("navigation", { name: "Quick actions" });
        assert.equal(await actions.count(), 1);
        const links = actionLinks.map((name) => actions.getByRole("link", { name }));
        for (const action of links) {
          const box = await action.boundingBox();
          assert.ok(box && box.height >= 44 && box.width >= 44);
          assert.ok(box.y >= 0 && box.y + box.height <= viewport.height);
        }
        for (const action of links) {
          const destination = await action.getAttribute("href");
          assert.ok(destination.startsWith("#") && await page.locator(destination).count() === 1);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width);
        assert.deepEqual(errors, []);
        assert.deepEqual(remoteRequests, []);
      } finally {
        await page.close();
      }
    }
  });

  await suite.test("enlarged text reflows", async () => {
    const { page } = await openPreview(browser, { viewport: { width: 320, height: 630 } });
    try {
      await page.addStyleTag({ content: "html { font-size: 200%; }" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    } finally {
      await page.close();
    }
  });

  await suite.test("a missing hero photo leaves visit actions available", async () => {
    const { page } = await openPreview(browser, { viewport: { width: 390, height: 844 } });
    try {
      await page.locator("#hero-photo").evaluate((image) => {
        image.removeAttribute("srcset");
        image.src = "assets/intentional-missing-photo.jpg";
      });
      await page.getByText("Photo unavailable", { exact: true }).waitFor();
      assert.equal(await page.locator("#hero-photo").isVisible(), false);
      const actions = page.getByRole("navigation", { name: "Quick actions" });
      await actions.getByRole("link", { name: /^Call for Carry-Out/i }).click();
      assert.ok(await page.locator("#carry-out a[href^='tel:']").isVisible());
    } finally {
      await page.close();
    }
  });

  await suite.test("key visit routes survive without scripts", async () => {
    const { page } = await openPreview(browser, {
      viewport: { width: 320, height: 630 },
      javaScriptEnabled: false,
    });
    try {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
      const actions = page.getByRole("navigation", { name: "Quick actions" });
      await actions.getByRole("link", { name: /^Hours$/ }).click();
      assert.equal(new URL(page.url()).hash, "#hours");
      const hours = page.locator("#hours-details");
      if (!(await hours.getAttribute("open") === "")) await hours.locator("summary").click();
      assert.match(await hours.innerText(), /Wednesday\s+Closed/i);
      await actions.getByRole("link", { name: /^Menu$/ }).click();
      assert.match(await page.locator("#menu").textContent(), /Specialty Pizzas/i);
      const call = page.locator("#carry-out");
      const dialer = call.locator('a[href="tel:+14174627746"]');
      assert.equal(await dialer.isVisible(), false);
      await actions.getByRole("link", { name: /^Call for Carry-Out/i }).click();
      assert.equal(new URL(page.url()).hash, "#carry-out");
      assert.match(await call.innerText(), /462.7746/);
      assert.ok(await dialer.isVisible());
      await actions.getByRole("link", { name: /^Directions/i }).click();
      assert.equal(new URL(page.url()).hash, "#visit");
      assert.match(await page.locator("#visit").innerText(), /Grovespring/i);
    } finally {
      await page.close();
    }
  });

  await suite.test("hours, motion, menu and story connect on one preview", async () => {
    const { page, errors } = await openPreview(browser, {
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
      timezoneId: "Pacific/Auckland",
    });
    try {
      const actions = page.getByRole("navigation", { name: "Quick actions" });
      await actions.getByRole("link", { name: /^Hours$/ }).click();
      assert.equal(await page.locator("#hours-details").getAttribute("open"), "");
      const date = page.locator("#visit-date");
      assert.match(await date.inputValue(), /^\d{4}-\d{2}-\d{2}$/);
      await date.fill("1900-01-01");
      assert.match(await page.locator("#date-result").textContent(), /call/i);
      const motion = page.locator("#motion-control");
      assert.ok(await motion.isVisible());
      await motion.press("Space");
      assert.match(await motion.innerText(), /resume|play/i);
      await motion.press("Space");
      assert.match(await motion.innerText(), /pause/i);
      await page.getByRole("link", { name: /Our family story/i }).click();
      assert.match(await page.locator("#story").textContent(), /Stoughton/i);
      assert.deepEqual(errors, []);
    } finally {
      await page.close();
    }
  });
});
