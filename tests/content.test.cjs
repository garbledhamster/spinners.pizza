const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const ids = ["menu", "scoops", "discounts", "story", "gallery", "reviews"];
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, "data", name), "utf8"));
const render = (options) => require("../scripts/render-content.cjs")({ root, ...options });

function text(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => (
    { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" }[entity]
  ));
}

function section(html, id) {
  const match = html.match(new RegExp('<section id="' + id + '"[^>]*>([\\s\\S]*?)</section>'));
  assert.ok(match, "missing section " + id);
  return match[1];
}

test("renders all static destinations, menu groups, and attributed reviews from pinned data", () => {
  const html = render({ preview: false });
  for (const id of ids) section(html, id);

  const menu = section(html, "menu");
  const groups = [...menu.matchAll(/<details class="menu-group" open>([\s\S]*?)<\/details>/g)];
  const source = read("menu.json");
  assert.equal(groups.length, source.sections.length);
  assert.deepEqual(groups.map(([, group]) => ({
    title: text(group.match(/<summary>(.*?)<\/summary>/)[1]),
    items: [...group.matchAll(/<li>(.*?)<\/li>/g)].map(([, row]) => text(row)),
  })), source.sections.map(({ title, items }) => ({
    title: title.replace("Drinks & Desert", "Drinks & Dessert"), items,
  })));
  assert.match(menu, /Drinks &amp; Dessert/);

  const reviews = [...section(html, "reviews").matchAll(
    /<blockquote>([\s\S]*?)<\/blockquote>\s*<figcaption>([\s\S]*?)<\/figcaption>/g,
  )].map(([, review, author]) => ({ review: text(review), author: text(author) }));
  assert.deepEqual(reviews, read("reviews.json").map(({ review, author }) => ({ review, author })));
  const reviewUrls = [...section(html, "reviews").matchAll(/<a href="([^"]+)"/g)];
  assert.deepEqual(reviewUrls.map(([, href]) => text(href)), read("reviews.json").map(({ href }) => href));
  assert.match(section(html, "story"), /Stoughton[\s\S]*Grovespring/);
  assert.match(section(html, "discounts"), /service members, police, firefighters, and first responders/);
  assert.deepEqual(groups.map(([, group]) => group.match(/<img src="([^"]+)"/)[1]), source.sections.map(({ photo }) => photo));
  assert.deepEqual(
    [...menu.matchAll(/<a href="([^"]+)" data-menu-photo/g)].map(([, href]) => href),
    source.images.map(src => new URL(src).pathname.slice(1)),
  );
  assert.match(menu, /These pages show an older address/);
  assert.match(section(html, "story"), /assets\/images\/logos\/97\.png/);
});

test("renders locally resolvable image links and sources with encoded filenames", () => {
  const html = render();
  const links = [...section(html, "gallery").matchAll(/<a[^>]+href="([^"]+)"[^>]+data-gallery/g)];
  assert.deepEqual(links.map(([, href]) => href), read("gallery.json").map(({ src }) => (
    new URL(src).pathname.slice(1)
  )));
  assert.ok(links.every(([, href]) => href.includes("%20")));
  for (const [, url] of html.matchAll(/(?:href|src)="(assets\/[^"]+)"/g)) {
    assert.ok(fs.statSync(path.join(root, decodeURIComponent(url))).isFile(), url);
  }
  assert.match(html, /<dialog id="photo-dialog" aria-labelledby="photo-label">/);
  assert.doesNotMatch(html, /<script\b/);
});

test("publishes the confirmed dessert offering with labeled illustrations", () => {
  const publicHtml = render({ preview: false });
  assert.match(section(publicHtml, "scoops"), /More than 25 flavors of Kemps ice cream, plus shakes, malts and sundaes\./);
  assert.match(section(publicHtml, "scoops"), /<figcaption>Illustration<\/figcaption>/);
  assert.match(section(publicHtml, "discounts"), /assets\/images\/counter-ticket\/illustrations\/pizza-boxes\.webp/);
  assert.doesNotMatch(publicHtml, /_preview\/|Preview proposal/);
});

test("Chromium supports no-script menu and image links plus keyboard gallery focus return", async (t) => {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({
    executablePath: process.env.SPINNERS_CHROME,
    args: ["--disable-background-networking", "--disable-component-update"],
  });
  t.after(() => browser.close());
  const origin = "http://counter-ticket.test";

  async function openPage(javaScriptEnabled) {
    const page = await browser.newPage({ javaScriptEnabled, viewport: { width: 390, height: 844 } });
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/") {
        return route.fulfill({
          contentType: "text/html",
          body: '<!doctype html><html lang="en"><title>Content check</title><main>' +
            '<script src="scripts/gallery.js" defer></script>' +
            '<a href="#menu">Menu</a><a href="#story">Our Family Story</a>' +
            render({ preview: false }) + "</main></html>",
        });
      }
      if (!javaScriptEnabled && route.request().resourceType() === "image") return route.abort();
      if (url.pathname.startsWith("/assets/images/") || url.pathname === "/scripts/gallery.js") {
        return route.fulfill({ path: path.join(root, decodeURIComponent(url.pathname)) });
      }
      return route.abort();
    });
    await page.goto(origin);
    return page;
  }

  const plain = await openPage(false);
  await plain.getByRole("link", { name: "Menu", exact: true }).click();
  assert.equal(new URL(plain.url()).hash, "#menu");
  const menuRows = plain.locator("#menu li");
  assert.equal(await menuRows.count(), 27);
  for (const row of await menuRows.all()) assert.ok(await row.isVisible());
  assert.ok(await plain.evaluate(() => window.find("Radar Burger")));
  await plain.getByRole("link", { name: "Our Family Story" }).click();
  assert.equal(new URL(plain.url()).hash, "#story");
  const plainLink = plain.locator("[data-gallery]").first();
  const href = await plainLink.getAttribute("href");
  await plainLink.press("Enter");
  await plain.waitForURL(new URL(href, origin).href);

  const enhanced = await openPage(true);
  const printed = enhanced.getByRole("link", { name: "Printed menu page 1" });
  await printed.press("Enter");
  const menuDialog = enhanced.getByRole("dialog");
  assert.match(await menuDialog.getByRole("heading").textContent(), /Printed menu page 1/);
  await enhanced.keyboard.press("ArrowRight");
  assert.match(await menuDialog.getByRole("heading").textContent(), /Printed menu page 2/);
  assert.equal(new URL(await menuDialog.getByRole("link", { name: "Open full size" }).getAttribute("href")).pathname,
    "/assets/images/menu/menu2.png");
  await enhanced.keyboard.press("Escape");
  await menuDialog.waitFor({ state: "hidden" });
  assert(await printed.evaluate(link => link === document.activeElement));

  const trigger = enhanced.locator("[data-gallery]").nth(1);
  const description = await trigger.locator("img").getAttribute("alt");
  await trigger.press("Enter");
  const dialog = enhanced.getByRole("dialog", { name: description });
  const close = dialog.getByRole("button", { name: "Close" });
  assert.ok(await dialog.isVisible());
  assert.ok(await close.evaluate((button) => document.activeElement === button));
  const original = await trigger.getAttribute("href");
  assert.equal(await dialog.locator("img").getAttribute("src"), new URL(original, origin).href);
  await enhanced.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await trigger.evaluate((link) => {
    if (document.activeElement !== link) throw new Error("Gallery trigger did not regain focus");
  });
});
