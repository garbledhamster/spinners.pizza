const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { after, before, test } = require("node:test");

const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const origin = "http://medallion.test";
const fixture = `<!doctype html>
<meta charset="utf-8">
<title>Medallion fixture</title>
<link rel="stylesheet" href="/styles/medallion.css">
<script src="/scripts/medallion.js" defer></script>
<div id="medallion" aria-hidden="true">
  <span class="seal-ring"></span>
  <img id="chef" src="/assets/images/logos/1.png" alt="" width="105" height="105">
</div>
<button id="motion-control" type="button" hidden>Pause emblem</button>`;

let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.SPINNERS_CHROME,
    args: ["--disable-background-networking"],
  });
});

after(async () => {
  await browser?.close();
});

async function openFixture(t, options = {}) {
  const page = await browser.newPage({ reducedMotion: "no-preference", ...options });
  t.after(() => page.close());
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: fixture });
    if (!/^\/(styles\/medallion\.css|scripts\/medallion\.js|assets\/images\/logos\/[1-6]\.png)$/.test(url.pathname)) {
      return route.fulfill({ status: 404 });
    }
    const file = path.join(root, url.pathname.slice(1));
    return route.fulfill(existsSync(file) ? { path: file } : { status: 404 });
  });
  if (options.javaScriptEnabled !== false) {
    await page.addInitScript(() => {
      const samples = [0, 0.25, 0.45, 0.65, 0.85];
      let index = 0;
      Math.random = () => samples[index++ % samples.length];
    });
    const time = new Date("2026-11-20T12:00:00Z");
    await page.clock.install({ time });
    await page.clock.pauseAt(new Date(time.getTime() + 1000));
  }
  await page.goto(origin);
  return page;
}

function pose(page) {
  return page.locator("#medallion").evaluate((badge) => {
    const animation = badge.getAnimations()[0];
    return {
      playState: animation?.playState ?? "none",
      transform: getComputedStyle(badge).transform,
    };
  });
}

async function chefVariant(page) {
  return page.locator("#chef").evaluate(async (image) => {
    await image.decode();
    return new URL(image.currentSrc).pathname.split("/").at(-1);
  });
}

test("the chef and ring share a four-second Y-axis turn", async (t) => {
  const page = await openFixture(t);
  const animation = await page.locator("#medallion").evaluate(async (badge) => {
    const [flip] = badge.getAnimations();
    if (!flip) return null;
    flip.pause();
    await flip.ready;
    flip.currentTime = 500;
    const { m13, m31 } = new DOMMatrixReadOnly(getComputedStyle(badge).transform);
    const { duration, iterations } = flip.effect.getTiming();
    const ringAndChef = [...badge.querySelectorAll(".seal-ring, #chef")];
    return {
      duration,
      iterations,
      m13,
      m31,
      children: ringAndChef.length,
      childAnimations: ringAndChef.flatMap((part) => part.getAnimations()).length,
    };
  });
  assert.ok(animation, "Expected a CSS animation on the whole #medallion");
  assert.equal(animation.duration, 4000);
  assert.equal(animation.iterations, Infinity);
  assert.ok(Math.abs(animation.m13) > 0.1 && Math.abs(animation.m31) > 0.1, "Expected a Y-axis turn at 500 ms");
  assert.equal(animation.children, 2);
  assert.equal(animation.childAnimations, 0);
  assert.equal(await page.locator("#medallion").getAttribute("aria-hidden"), "true");
});

test("reduced motion keeps the badge still and shuffles all six original images on schedule", async (t) => {
  const page = await openFixture(t, { reducedMotion: "reduce" });
  assert.deepEqual(await pose(page), { playState: "none", transform: "none" });
  assert.equal(await chefVariant(page), "1.png");
  await page.clock.runFor(3999);
  assert.equal(await chefVariant(page), "1.png");
  await page.clock.runFor(1);
  assert.equal(await chefVariant(page), "2.png");
  for (const expected of ["3.png", "4.png", "5.png", "6.png", "1.png"]) {
    await page.clock.runFor(4000);
    assert.equal(await chefVariant(page), expected);
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal((await pose(page)).playState, "running");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.deepEqual(await pose(page), { playState: "none", transform: "none" });
  await page.clock.runFor(4000);
  assert.equal(await chefVariant(page), "3.png");
});

test("keyboard Pause holds the image and rotation, and Resume uses the live motion preference", async (t) => {
  const page = await openFixture(t);
  const pause = page.getByRole("button", { name: "Pause emblem", exact: true });
  const resume = page.getByRole("button", { name: "Resume emblem", exact: true });
  assert.equal(await pause.isVisible(), true, "Expected the initialized Pause button");
  await page.keyboard.press("Tab");
  assert.equal(await pause.evaluate((button) => {
    const { outlineStyle, outlineWidth } = getComputedStyle(button);
    return button === document.activeElement && outlineStyle !== "none" && parseFloat(outlineWidth) >= 2;
  }), true);
  await page.keyboard.press("Enter");
  assert.equal(await resume.isVisible(), true);
  await page.locator("#medallion").evaluate((badge) => badge.getAnimations()[0].ready);
  const pausedPose = await pose(page);
  assert.equal(pausedPose.playState, "paused");
  await page.clock.runFor(4000);
  assert.deepEqual(await pose(page), pausedPose);
  assert.equal(await chefVariant(page), "1.png");

  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.deepEqual(await pose(page), { playState: "none", transform: "none" });
  await page.clock.runFor(4000);
  assert.equal(await chefVariant(page), "1.png");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal((await pose(page)).playState, "paused");
  await page.clock.runFor(4000);
  assert.equal(await chefVariant(page), "1.png");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.keyboard.press("Space");
  assert.equal(await pause.isVisible(), true);
  assert.deepEqual(await pose(page), { playState: "none", transform: "none" });
  await page.clock.runFor(3999);
  assert.equal(await chefVariant(page), "1.png");
  await page.clock.runFor(1);
  assert.equal(await chefVariant(page), "2.png");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal((await pose(page)).playState, "running");
});

test("the badge stays still and the control stays hidden with scripts disabled", async (t) => {
  const page = await openFixture(t, { javaScriptEnabled: false });
  assert.deepEqual(await pose(page), { playState: "none", transform: "none" });
  assert.equal(await chefVariant(page), "1.png");
  assert.equal(await page.locator("#motion-control").isVisible(), false);
});
