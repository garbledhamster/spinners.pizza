const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { after, before, test } = require("node:test");
const { chromium } = require("playwright");

const root = join(__dirname, "..");
const origin = "http://counter-ticket.test";
const layout = join(root, "site/layout.html");
const hoursFixture = `
  <section id="hours" class="visit-strip">
    <div class="wrap strip-inner">
      <h2>Check your visit</h2>
      <details id="hours-details" class="ticket">
        <summary>Hours &amp; date check</summary>
        <p>Fixture Wednesday: Closed</p>
        <a href="#carry-out">Check by phone</a>
      </details>
    </div>
  </section>`;
const contentFixture = `
  <section id="menu" class="wrap section"><h2>On the menu</h2><p>Fixture pizza</p></section>
  <section id="discounts" class="wrap section"><h2>Discounts for our heroes</h2></section>
  <section id="story" class="wrap section"><h2 id="about">Our Family Story</h2><p>Fixture story</p></section>
  <section id="gallery" class="wrap section"><h2>Gallery</h2></section>
  <section id="reviews" class="wrap section"><h2>Reviews</h2></section>`;

const assets = new Map([
  ["/styles/counter-ticket.css", ["styles/counter-ticket.css", "text/css"]],
  ["/scripts/visit-ui.js", ["scripts/visit-ui.js", "text/javascript"]],
  ["/assets/images/logos/1.png", ["assets/images/logos/1.png", "image/png"]],
  ["/assets/images/background/1.png", ["assets/images/background/1.png", "image/png"]],
  ["/assets/images/background/current.jpg", ["assets/images/background/current.jpg", "image/jpeg"]],
  ["/assets/images/counter-ticket/pizza-720.jpg", ["assets/images/counter-ticket/pizza-720.jpg", "image/jpeg"]],
  ["/assets/images/counter-ticket/pizza-1200.jpg", ["assets/images/counter-ticket/pizza-1200.jpg", "image/jpeg"]],
]);

let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.SPINNERS_CHROME,
    args: ["--disable-background-networking", "--disable-component-update", "--disable-sync"],
  });
});
after(async () => { await browser?.close(); });

function render() {
  if (process.env.COUNTER_LAYOUT_BASELINE || !existsSync(layout)) {
    return execFileSync("git", ["show", "b359233:index.html"], { cwd: root, encoding: "utf8" });
  }
  return readFileSync(layout, "utf8")
    .replace("<!-- COUNTER_TICKET_HOURS -->", hoursFixture)
    .replace("<!-- COUNTER_TICKET_CONTENT -->", contentFixture);
}

async function preview(t, { width = 360, height = 640, javaScriptEnabled = true, blockHero = false } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    isMobile: width < 500,
    hasTouch: width < 500,
    javaScriptEnabled,
  });
  t.after(() => context.close());
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: render() });
    if (blockHero && /\/(current|pizza-720|pizza-1200)\.jpg$/.test(url.pathname)) return route.abort();
    const asset = assets.get(url.pathname);
    if (!asset) return route.fulfill({ status: 204 });
    const [file, contentType] = asset;
    return route.fulfill({ contentType, path: join(root, file) });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  await page.goto(origin);
  return page;
}

function quickActions(page) {
  return page.getByRole("navigation", { name: "Quick actions", exact: true });
}

test("carry-out first reveals the published number with scripts disabled", async (t) => {
  const page = await preview(t, { javaScriptEnabled: false });
  const quick = quickActions(page);
  assert.equal(await quick.count(), 1, "the first screen needs a named group of visit actions");
  const call = quick.getByRole("link", { name: /^Call for Carry-Out/ });
  const details = page.locator("#carry-out-details");
  const dial = details.getByRole("link", { name: "Open dialer", exact: true });
  assert.equal(await details.evaluate((node) => node.open), false);
  assert.equal(await dial.isVisible(), false);
  await call.tap();
  assert.equal(page.url(), origin + "/#carry-out");
  assert.equal(await details.evaluate((node) => node.open), true);
  assert.match(await details.innerText(), /\(417\)\s462-7746/);
  assert.equal(await dial.isVisible(), true);
  assert.equal(await dial.getAttribute("href"), "tel:+14174627746");
});

test("the four visit actions and story precede the photo on both phones", async (t) => {
  for (const [width, height] of [[390, 844], [360, 640]]) {
    const page = await preview(t, { width, height });
    const quick = quickActions(page);
    const call = quick.getByRole("link", { name: /^Call for Carry-Out/ });
    const directions = quick.getByRole("link", { name: /^Directions/ });
    const actions = [
      quick.getByRole("link", { name: "Menu", exact: true }),
      quick.getByRole("link", { name: "Hours", exact: true }),
      call,
      directions,
    ];
    const photo = await page.locator("#hero-art").boundingBox();
    for (const action of actions) {
      const box = await action.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44);
      assert.ok(box.y >= 0 && box.y + box.height <= Math.min(height, photo.y));
    }
    assert.equal((await call.boundingBox()).height, (await directions.boundingBox()).height);
    const story = await page.getByRole("link", { name: "Our Family Story" }).boundingBox();
    assert.ok(story.y + story.height <= photo.y);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
  }
});

test("keyboard and touch retain visit routes when the pizza photo fails", async (t) => {
  const page = await preview(t, { blockHero: true });
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").innerText(), "Skip to content");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "main");
  assert.equal(await page.locator("#hero-caption").innerText(), "Photo unavailable");

  const quick = quickActions(page);
  for (const [name, destination] of [["Menu", "#menu"], ["Hours", "#hours"], [/^Directions/, "#visit"]]) {
    await quick.getByRole("link", { name }).tap();
    assert.equal(new URL(page.url()).hash, destination);
  }
  assert.equal(await page.locator("#hours-details").evaluate((details) => details.open), true);
  assert.ok(await page.getByText("Fixture Wednesday: Closed").isVisible());
  const mapLink = page.getByRole("link", { name: "Open in Google Maps" });
  assert.equal(new URL(await mapLink.getAttribute("href")).searchParams.get("cid"), "10087945801653444493");
  assert.equal(await page.locator("#order").count(), 1);

  await page.getByRole("link", { name: "Our Family Story" }).tap();
  assert.equal(new URL(page.url()).hash, "#story");
  assert.equal(await page.locator("#story #about").count(), 1);
});
