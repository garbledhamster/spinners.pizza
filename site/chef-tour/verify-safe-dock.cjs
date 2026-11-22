const assert = require("node:assert/strict");
const { chromium, webkit } = require("playwright");

const url = process.argv[2] ?? "http://127.0.0.1:54243/";
const launcherName = "Ask the Spinners chef";

async function hitPoints(locator) {
  return locator.evaluate(el => {
    const box = el.getBoundingClientRect();
    const left = Math.max(0, box.left);
    const right = Math.min(innerWidth, box.right);
    const top = Math.max(0, box.top);
    const bottom = Math.min(innerHeight, box.bottom);
    const x = (left + right) / 2;
    const y = (top + bottom) / 2;
    return [[x, y], [left + 3, y], [right - 3, y], [x, top + 3], [x, bottom - 3]].map(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return { x, y, clear: right > left && bottom > top && el.contains(hit),
        hit: hit?.id || hit?.getAttribute("class") || hit?.localName };
    });
  });
}

async function assertHits(locator) {
  const points = await hitPoints(locator);
  assert(points.every(point => point.clear), JSON.stringify(points.filter(point => !point.clear)));
  return points;
}

async function startReviewsFlight(page) {
  await page.getByRole("button", { name: launcherName }).click();
  for (const name of ["About Spinners", "Customer reviews"]) {
    await page.locator(".cg-picker").getByRole("button", { name, exact: true }).click();
  }
  await page.waitForFunction(() => scrollY > 70 && document.querySelector(".cg-step[data-en-route]"));
}

async function verify(browser, url) {
  let failures = 0;
  async function run(name, viewport, check, hasTouch = true) {
    const page = await browser.newPage({ viewport, hasTouch, isMobile: hasTouch });
    page.setDefaultTimeout(4000);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.locator('.chef-guide[data-performer="ready"]').waitFor({ state: "attached" });
      await check(page);
      console.log("PASS", name);
    } catch (error) {
      failures++;
      console.error("FAIL", name, error.message);
    } finally {
      await page.close();
    }
  }

  await run("320×568 Pause emblem", { width: 320, height: 568 }, async page => {
    const pause = page.getByRole("button", { name: "Pause emblem" });
    const [center] = await assertHits(pause);
    await page.touchscreen.tap(center.x, center.y);
    await page.getByRole("button", { name: "Resume emblem" }).waitFor();
  });

  await run("568×320 native Hours", { width: 568, height: 320 }, async page => {
    const hours = page.locator('#home .actions a[href="#hours"]');
    const [center] = await assertHits(hours);
    await page.touchscreen.tap(center.x, center.y);
    await page.locator("#hours-details[open]").waitFor();
    const summary = page.locator("#hours-details summary");
    await summary.scrollIntoViewIfNeeded();
    const [summaryCenter] = await assertHits(summary);
    await page.touchscreen.tap(summaryCenter.x, summaryCenter.y);
    await page.locator("#hours-details:not([open])").waitFor();
  });

  for (const viewport of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
    await run(`${viewport.width}×${viewport.height} Directions → Maps center and edges`, viewport, async page => {
      await page.locator('#home .actions a[href="#visit"]').tap();
      await page.waitForURL(/#visit$/);
      const maps = page.locator("#visit .locator-copy a");
      await maps.scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const points = await assertHits(maps);
      // Record real touch clicks without leaving the local site.
      await maps.evaluate(el => el.addEventListener("click", event => {
        event.preventDefault();
        if (event.isTrusted) el.dataset.testTaps = Number(el.dataset.testTaps ?? 0) + 1;
      }));
      for (const { x, y } of points) await page.touchscreen.tap(x, y);
      assert.equal(await maps.getAttribute("data-test-taps"), "5");
    });
  }

  await run("390×844 native Menu and Carry-out", { width: 390, height: 844 }, async page => {
    for (const [hash, target] of [["menu", "#menu .menu-group summary"], ["carry-out", "#carry-out a"]]) {
      const homeLink = page.locator(`#home .actions a[href="#${hash}"]`);
      const [point] = await assertHits(homeLink);
      await page.touchscreen.tap(point.x, point.y);
      await page.waitForURL(new RegExp(`#${hash}$`));
      const control = page.locator(target).first();
      await control.scrollIntoViewIfNeeded();
      await assertHits(control);
      if (hash === "carry-out") await page.locator("#carry-out-details[open]").waitFor();
      await page.goto(url);
    }
  });

  await run("the same launcher retains focus between the hero and compact dock", { width: 390, height: 844 }, async page => {
    const launch = page.getByRole("button", { name: launcherName });
    await launch.focus();
    const owner = await launch.elementHandle();
    await page.locator("#visit").evaluate(el => el.scrollIntoView());
    await launch.getByText("Guide", { exact: true }).waitFor();
    assert(await owner.evaluate(el => el === document.activeElement));
    await page.keyboard.press("Enter");
    await page.locator(".cg-picker").waitFor();
    await page.keyboard.press("Escape");
    assert(await owner.evaluate(el => el === document.activeElement));
    await page.evaluate(() => window.scrollTo(0, 0));
    await launch.getByText("Ask the chef", { exact: true }).waitFor();
    assert(await owner.evaluate(el => el === document.activeElement));
  }, false);

  await run("1440×900 full desktop chef on hero", { width: 1440, height: 900 }, async page => {
    const hero = await page.locator("#hero-art").boundingBox();
    const art = page.locator(".cg-visual");
    assert(await art.isVisible());
    const box = await art.boundingBox();
    assert.equal(box.width, 235);
    assert(box.x >= hero.x && box.x + box.width <= hero.x + hero.width);
    assert(box.y >= hero.y && box.y + box.height <= hero.y + hero.height);
    await assertHits(page.getByRole("button", { name: "Pause emblem" }));
  }, false);

  await run("explicit close glides into the compact dock", { width: 1440, height: 900 }, async page => {
    const launch = page.getByRole("button", { name: launcherName });
    await launch.click();
    for (const name of ["Menu & desserts", "Browse by category", "Specialty Pizzas"]) {
      await page.locator(".cg-picker").getByRole("button", { name, exact: true }).click();
    }
    await page.locator(".cg-laser").waitFor();
    const close = page.getByRole("button", { name: "Close guide tip" });
    await close.evaluate(button => button.addEventListener("click", () => {
      const art = document.querySelector(".cg-visual");
      const trace = window.returnTrace = [];
      const deadline = performance.now() + 3500;
      const sample = () => {
        const { x, y } = art.getBoundingClientRect();
        const visible = getComputedStyle(art).visibility === "visible";
        trace.push({ x, y, visible, scrollY });
        if (visible && performance.now() < deadline) requestAnimationFrame(sample);
      };
      sample();
    }, { capture: true, once: true }));
    await close.click();
    await launch.getByText("Guide", { exact: true }).waitFor();
    await page.waitForFunction(() => window.returnTrace.at(-1)?.visible === false);
    const trace = await page.evaluate(() => window.returnTrace);
    assert(trace.length > 10 && trace.slice(0, -1).every(frame => frame.visible));
    assert(trace.every(frame => frame.scrollY === trace[0].scrollY));
    assert(Math.hypot(trace[1].x - trace[0].x, trace[1].y - trace[0].y) < 25);
    const end = trace.at(-1);
    const lastVisible = trace.at(-2);
    assert(Math.hypot(end.x - lastVisible.x, end.y - lastVisible.y) < 12);
    assert(Math.hypot(end.x - trace[0].x, end.y - trace[0].y) > 150);
    assert(await launch.evaluate(el => el === document.activeElement));
  }, false);

  for (const key of ["Home", "PageDown"]) {
    await run(`${key} interrupts automatic scroll and keeps native scrolling`, { width: 390, height: 680 }, async page => {
      await startReviewsFlight(page);
      const focus = page.locator("#chef-step-title");
      assert(await focus.evaluate(el => document.activeElement === el));
      await page.keyboard.press(key);
      await page.locator(".cg-step[data-en-route]").waitFor({ state: "detached", timeout: 300 });
      if (key === "Home") {
        await page.waitForFunction(() => scrollY === 0);
      } else {
        await page.waitForFunction(() => scrollY > 400 && scrollY < document.querySelector("#reviews").offsetTop - 680);
      }
      assert(await focus.evaluate(el => document.activeElement === el));
    }, false);
  }
  await run("a focused visit input keeps its native keys during flight", { width: 390, height: 680 }, async page => {
    await startReviewsFlight(page);
    const input = page.locator("#visit-date");
    await input.evaluate(el => {
      el.closest("details").open = true;
      el.focus({ preventScroll: true });
      el.addEventListener("keydown", event => {
        requestAnimationFrame(() => { el.dataset.keyAllowed = String(!event.defaultPrevented); });
      }, { once: true });
    });
    assert(await input.evaluate(el => document.activeElement === el));
    await page.keyboard.press("Home");
    await page.waitForFunction(() => document.querySelector("#visit-date").dataset.keyAllowed === "true");
    assert.equal(await page.locator(".cg-step[data-en-route]").count(), 1);
  }, false);
  return failures;
}

(async () => {
  let failures = 0;
  for (const engine of [chromium, webkit]) {
    const options = engine === chromium ? { executablePath: process.env.SPINNERS_CHROME } : {};
    const browser = await engine.launch(options);
    console.log(engine.name(), browser.version(), url);
    try {
      failures += await verify(browser, url);
    } finally {
      await browser.close();
    }
  }
  if (failures) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
