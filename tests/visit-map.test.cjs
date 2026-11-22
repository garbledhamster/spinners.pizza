const assert = require("node:assert/strict");
const { join } = require("node:path");
const { test } = require("node:test");
const { chromium, webkit } = require("playwright");

const origin = "http://spinners-map.test";
const root = join(__dirname, "..");
const assets = new Map([
  ["/", ["index.html", "text/html"]],
  ["/styles/counter-ticket.css", ["styles/counter-ticket.css", "text/css"]],
  ["/scripts/visit-map.mjs", ["scripts/visit-map.mjs", "text/javascript"]],
  ["/data/grovespring-map.json", ["data/grovespring-map.json", "application/json"]],
]);

async function open(browser, options = {}, failData = false) {
  const page = await browser.newPage(options);
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname === "www.google.com" && url.pathname === "/maps/embed") {
      return route.fulfill({ contentType: "text/html", body: "<title>Google Maps</title>" });
    }
    const asset = assets.get(url.pathname);
    if (url.origin !== origin || !asset || (failData && url.pathname.endsWith(".json"))) return route.abort();
    return route.fulfill({ path: join(root, asset[0]), contentType: asset[1] });
  });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  return page;
}

for (const [engine, viewport] of [
  [chromium, { width: 1440, height: 900 }],
  [webkit, { width: 390, height: 844 }],
]) {
  test(`${engine.name()}: the map responds to exposure and focuses the same pin`, async t => {
    const browser = await engine.launch();
    t.after(() => browser.close());
    const page = await open(browser, { viewport, hasTouch: engine === webkit });
    const stage = page.getByRole("region", { name: "Map centered on Spinners Pizza" });
    await stage.waitFor();
    const scrollToShow = amount => stage.evaluate((element, fraction) => {
      const rect = element.getBoundingClientRect();
      const top = fraction === 1 ? (innerHeight - rect.height) / 2 : innerHeight - rect.height * fraction;
      scrollTo({ top: scrollY + rect.top - top, behavior: "instant" });
    }, amount);
    const zoomIs = (min, max) => page.waitForFunction(([low, high]) => {
      const value = Number(document.querySelector(".visit-map-stage").dataset.zoom);
      return value >= low && value <= high;
    }, [min, max]);

    await scrollToShow(.17);
    await zoomIs(.2, .85);
    await scrollToShow(1);
    await zoomIs(2.25, 2.45);
    assert.ok(await stage.locator("canvas").evaluate(canvas => {
      const color = canvas.getContext("2d").getImageData(canvas.width / 2, canvas.height * .54 - 13, 1, 1).data;
      return color[0] > color[1] * 1.6;
    }), "The branded pin remains centered on the restaurant");
    await scrollToShow(.17);
    await zoomIs(.2, .85);
    await scrollToShow(1);
    await stage.focus();
    await zoomIs(3.38, 3.4);
    assert.equal(await stage.getAttribute("data-map-mode"), "focus");
    await stage.getByRole("button", { name: "Zoom out" }).press("Enter");
    await zoomIs(2.73, 2.78);
    await page.getByRole("link", { name: "Get directions", exact: true }).focus();
    await zoomIs(2.25, 2.45);
    assert.equal(await stage.getAttribute("data-map-mode"), "scroll");
    assert.match(await page.getByRole("link", { name: "Open in Google Maps" }).getAttribute("href"), /10087945801653444493/);
    assert.match(await page.getByRole("link", { name: "OpenStreetMap" }).getAttribute("href"), /openstreetmap\.org\/copyright/);
  });
}

test("the original Google map remains available without the enhanced map", async t => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const [enabled, failData] of [[false, false], [true, true]]) {
    const page = await open(browser, { javaScriptEnabled: enabled }, failData);
    assert.equal(await page.locator(".visit-map").isVisible(), false);
    assert.equal(await page.locator('iframe[title="Spinners Pizza on Google Maps"]').isVisible(), true);
    await page.close();
  }
});
