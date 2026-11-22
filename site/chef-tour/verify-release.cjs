const assert = require("node:assert/strict");
const { join } = require("node:path");
const { chromium, webkit } = require("playwright");
const preview = process.argv[2] ?? "http://127.0.0.1:54243/";
const production = process.argv[3] ?? "http://127.0.0.1:54244/";
const captures = process.env.SPINNERS_TOUR_CAPTURES;
const chrome = process.env.SPINNERS_CHROME;

async function open(page, ...labels) {
  await page.getByRole("button", { name: "Ask the Spinners chef" }).click();
  const picker = page.locator(".cg-picker");
  for (const name of labels) await picker.getByRole("button", { name, exact: true }).click();
}

async function verifyGuideMotionOptIn(page) {
  const funnel = page.locator(".cg-funnel-frame");
  const animationName = locator => locator.evaluate(element => getComputedStyle(element).animationName);
  const picker = page.locator(".cg-picker");
  assert.equal(await animationName(funnel), "none");

  await open(page, "Guide settings");
  const play = picker.getByRole("button", { name: "Play motion", exact: true });
  assert.equal(await play.count(), 1, "Reduced-motion visitors need an explicit Play motion action");
  await play.press("Enter");
  const restore = picker.getByRole("button", { name: "Use device setting", exact: true });
  assert(await restore.evaluate(element => element === document.activeElement));
  assert.equal(await animationName(funnel), "cg-tornado-spin");
  assert.equal(await animationName(page.locator("#medallion")), "none", "Guide opt-in must not animate the emblem");

  await picker.getByRole("button", { name: "Back", exact: true }).click();
  for (const name of ["Menu & desserts", "Full menu"]) {
    await picker.getByRole("button", { name, exact: true }).click();
  }
  await page.locator(".cg-avatar[data-travel]").waitFor({ state: "attached" });
  const frames = await page.evaluate(() => new Promise(resolve => {
    const avatar = document.querySelector(".cg-avatar");
    const funnel = avatar.querySelector(".cg-funnel-frame");
    const poses = new Set();
    const tornado = new Set();
    const positions = new Set();
    const until = performance.now() + 430;
    function sample(now) {
      poses.add(avatar.dataset.frame);
      tornado.add(getComputedStyle(funnel).backgroundPosition);
      positions.add(avatar.getBoundingClientRect().y);
      if (now < until) requestAnimationFrame(sample);
      else resolve([poses.size, tornado.size, positions.size]);
    }
    requestAnimationFrame(sample);
  }));
  assert(frames.every(count => count > 1), `Travel should change the chef pose, tornado frame and position: ${frames}`);
  await page.locator(".cg-laser").waitFor();
  await page.getByRole("button", { name: "Close guide tip" }).click();
  await page.locator(".cg-avatar[data-travel]").waitFor({ state: "detached" });
  await open(page, "Guide settings");
  await restore.click();
  assert(await play.isEnabled());
  assert.equal(await animationName(funnel), "none");
  console.log("With reduced motion set, guide playback can be enabled by keyboard and reset independently of the emblem.");
}

async function assessHits(locator) {
  return locator.evaluateAll(elements => elements.map(el => {
    const rect = el.getBoundingClientRect();
    const points = [
      [rect.left + rect.width / 2, rect.top + rect.height / 2],
      [rect.left + rect.width / 2, rect.top + 4],
      [rect.right - 5, rect.top + rect.height / 2],
    ];
    return [el.textContent.trim().slice(0, 35) || el.querySelector("img")?.alt,
      ...points.map(([x, y]) => el.contains(document.elementFromPoint(x, y)))];
  }));
}

(async () => {
  const safariEngine = await webkit.launch();
  try {
    const landscape = await safariEngine.newPage({ viewport: { width: 568, height: 320 }, hasTouch: true });
    await landscape.goto(preview, { waitUntil: "domcontentloaded" });
    await landscape.locator('.chef-guide[data-performer="ready"]').waitFor({ state: "attached" });
    await open(landscape, "Guided tours", "Site tour");
    const details = landscape.getByRole("button", { name: "Details", exact: true });
    assert.equal(await details.getAttribute("aria-expanded"),"false");
    await landscape.locator(".cg-highlight").waitFor();
    const links = await assessHits(landscape.locator("#home .actions a"));
    console.log("Landscape native links (center, top, side):", links);
    assert(links.every(row => row.slice(1).every(Boolean)));
    if (captures) await landscape.screenshot({ path: join(captures, "landscape-folded.jpg"), type: "jpeg", quality: 86 });
    await details.click();
    assert.equal(await landscape.getByRole("button", { name: "Less", exact: true }).getAttribute("aria-expanded"),"true");
    await landscape.keyboard.press("Escape");
    await open(landscape, "About Spinners", "Inside Spinners", "See the counter");
    await landscape.locator(".cg-highlight").waitFor();
    const photo = await assessHits(landscape.locator("#gallery .gallery-grid a:nth-child(2)"));
    console.log("Landscape photo (center, top, side):",photo);
    assert(photo[0].slice(1).every(Boolean));

    const phone = await safariEngine.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await phone.goto(preview, { waitUntil: "domcontentloaded" });
    await open(phone, "Menu & desserts", "Full menu");
    await phone.locator(".cg-laser").waitFor();
    const dessert = await assessHits(phone.locator('#menu a[href="#scoops"]'));
    assert(dessert[0].slice(1).every(Boolean), JSON.stringify(dessert));
    await phone.keyboard.press("Escape");
    await open(phone, "Plan a visit", "Hours & date check", "Check a visit date");
    await phone.locator(".cg-highlight").waitFor();
    await phone.getByRole("button",{name:"Go to highlight"}).click();
    assert(await phone.locator("#visit-date").evaluate(el => el === document.activeElement));
    await phone.keyboard.press("Escape");
    assert(!await phone.locator(".cg-step").isVisible());
    console.log("WebKit phone: Desserts tap area clear. Native date input focused. Escape closes from the input.");
    const reducedPhone = await safariEngine.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await reducedPhone.goto(production, { waitUntil: "domcontentloaded" });
    await reducedPhone.locator('.chef-guide[data-tornado="ready"][data-performer="ready"]').waitFor({ state: "attached" });
    await verifyGuideMotionOptIn(reducedPhone);

  } finally { await safariEngine.close(); }

  const browser = await chromium.launch({ executablePath: chrome });
  try {
    const page = await browser.newPage({ reducedMotion: "reduce", viewport: {width:390,height:844} });
    await page.goto(production, { waitUntil: "domcontentloaded" });
    await page.locator('.chef-guide[data-performer="ready"]').waitFor({ state: "attached" });
    assert.equal(await page.locator("#scoop-title").textContent(),"The scoop counter");
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"),/^index,/);
    await open(page, "Menu & desserts", "The scoop counter");
    await page.locator(".cg-laser").waitFor();
    assert.equal(await page.locator("#chef-step-title").textContent(),"The scoop counter");
    assert.match(await page.locator("#scoops").textContent(),/25 flavors of Kemps ice cream/);
    assert.match(await page.locator(".cg-copy").textContent(),/shakes, malts and sundaes/);
    await page.keyboard.press("Escape");
    await open(page, "Plan a visit", "Hours & date check", "Today’s hours");
    await page.locator(".cg-highlight").waitFor();
    assert(await page.getByRole("link",{name:"Call to check"}).isVisible());
    assert.equal(await page.locator("#date-result").getAttribute("data-state"),"unknown");
    console.log("Public build: chef starts on index, matching dessert details, native date and phone fallback.");
    await page.keyboard.press("Escape");
    await page.locator('.chef-guide[data-tornado="ready"]').waitFor({ state: "attached" });
    await verifyGuideMotionOptIn(page);


    const recovery = await browser.newPage({viewport:{width:390,height:844}});
    await recovery.route(/chef-flight\.(?:png|webp)|tornado-spin\.webp/, route => route.abort());
    await recovery.goto(preview, {waitUntil:"domcontentloaded"});
    await open(recovery, "About Spinners", "Our family story");
    await recovery.locator(".cg-highlight").waitFor();
    assert(await recovery.locator(".cg-art").isVisible());
    assert(await recovery.locator(".cg-tornado").isVisible());
    if (captures) await recovery.screenshot({ path: join(captures, "missing-atlas.jpg"), type: "jpeg", quality: 86 });
    await recovery.keyboard.press("Escape");
    await recovery.getByRole("button",{name:"Ask the Spinners chef"}).click();
    await recovery.getByRole("button",{name:"About Spinners",exact:true}).click();
    await recovery.locator("#reviews-title").evaluate(el => el.remove());
    await recovery.getByRole("button",{name:"Customer reviews",exact:true}).click();
    assert(await recovery.getByText("That spot is unavailable right now.",{exact:true}).first().isVisible());
    if (captures) await recovery.screenshot({ path: join(captures, "missing-destination.jpg"), type: "jpeg", quality: 86 });
    console.log("Recovery: old art and outline survive failed atlases; a removed destination produces a visible message and the menu stays open.");

    const motion = await browser.newPage({viewport:{width:1440,height:900}});
    await motion.goto(preview,{waitUntil:"domcontentloaded"});
    await motion.locator('.chef-guide[data-tornado="ready"][data-performer="ready"]').waitFor({state:"attached"});
    await open(motion, "Menu & desserts", "Full menu");
    await motion.locator(".cg-avatar[data-travel]").waitFor({state:"attached"});
    await motion.locator(".cg-dust:not([hidden])").first().waitFor();
    await motion.emulateMedia({reducedMotion:"reduce"});
    await motion.locator(".cg-avatar[data-travel]").waitFor({state:"detached"});
    await motion.locator(".cg-laser").waitFor();
    assert.equal(await motion.locator(".cg-dust:not([hidden])").count(),0);
    assert.equal(await motion.locator(".cg-funnel-frame").evaluate(el => getComputedStyle(el).animationName),"none");
    console.log("Turning on reduced motion during flight stops particles and spin, then settles the pointer.");

    const basic = await browser.newPage({javaScriptEnabled:false,viewport:{width:320,height:640}});
    await basic.goto(preview,{waitUntil:"domcontentloaded"});
    assert(await basic.getByRole("navigation",{name:"Quick actions"}).getByRole("link",{name:"Menu",exact:true}).isVisible());
    assert(await basic.locator("#hours-details summary").isVisible());
    assert.equal(await basic.locator(".chef-guide").count(),0);
    console.log("JavaScript off: native visit and menu routes still render.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
