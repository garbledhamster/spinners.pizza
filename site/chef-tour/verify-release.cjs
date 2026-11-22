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

async function verifyGuideAutoplay(page) {
  const funnel = page.locator(".cg-funnel-frame");
  const rider = page.locator(".cg-body-layer");
  const animationState = locator => locator.evaluate(element => getComputedStyle(element).animationPlayState);
  const picker = page.locator(".cg-picker");
  assert.equal(await funnel.evaluate(element => getComputedStyle(element).animationName),
    "cg-tornado-spin", "The guide should play when the browser requests reduced motion");
  assert.equal(await page.locator("#medallion").evaluate(element => getComputedStyle(element).animationName),
    "none", "Chef autoplay should leave the separate emblem still");

  const loops = await page.evaluate(async () => {
    const rider = document.querySelector(".cg-body-layer");
    const funnel = document.querySelector(".cg-funnel-frame");
    const subjects = [[rider, "cg-balance", "rotate"], [funnel, "cg-tornado-spin", "backgroundPosition"]];
    const animations = subjects.map(([element, name]) => element.getAnimations().find(animation => animation.animationName === name));
    await Promise.all(animations.map(animation => animation.ready));
    const iteration = animation => animation.effect.getComputedTiming().currentIteration;
    const initial = animations.map(iteration);
    const samples = [new Set(), new Set()];
    const until = performance.now() + 7000;
    window.guideLoopProbe = animations;

    return new Promise(resolve => {
      function sample(now) {
        subjects.forEach(([element, , property], index) => samples[index].add(getComputedStyle(element)[property]));
        const iterations = animations.map((animation, index) => iteration(animation) - initial[index]);
        if (iterations.every(count => count >= 2) || now > until) {
          resolve({ iterations, samples: samples.map(values => values.size) });
        } else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
  });
  assert(loops.iterations.every(count => count >= 2) && loops.samples.every(count => count > 15), JSON.stringify(loops));

  await open(page, "Guide settings");
  const pause = picker.getByRole("button", { name: "Pause motion", exact: true });
  await pause.press("Enter");
  const resume = picker.getByRole("button", { name: "Resume motion", exact: true });
  assert(await resume.evaluate(element => element === document.activeElement));
  assert.equal(await animationState(funnel), "paused");
  assert.equal(await animationState(rider), "paused");
  await resume.press("Enter");
  const launcher = await page.getByRole("button", { name: "Ask the Spinners chef" }).boundingBox();
  const before = await picker.boundingBox();
  const screen = page.viewportSize();
  const x = launcher.x + launcher.width / 2;
  const y = launcher.y + Math.min(50, launcher.height / 3);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (x < screen.width / 2 ? 1 : -1) * screen.width * .36, y - 80, { steps: 8 });
  await page.mouse.up();
  await page.locator(".cg-avatar[data-coast]").waitFor({ state: "detached" });
  const after = await picker.boundingBox();
  assert(await pause.isVisible(), "Dragging the chef should keep the same submenu open");
  assert(after && Math.hypot(after.x - before.x, after.y - before.y) > 25, "The speech bubble should move with the chef");
  assert(await picker.getAttribute("data-tail"), "The speech bubble should point back to the chef");
  assert(after.x >= 0 && after.y >= 0 && after.x + after.width <= screen.width && after.y + after.height <= screen.height);
  await picker.getByRole("button", { name: "Close guide menu" }).click();
  assert(await page.evaluate(() => window.guideLoopProbe.every(animation =>
    animation.playState === "running" && animation.effect.getComputedTiming().currentIteration >= 2
  )), "Pause, resume and closing the picker should preserve both animation playheads");

  await open(page, "Menu & desserts", "Full menu");
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
  assert(await page.evaluate(() => window.guideLoopProbe.every(animation =>
    animation.playState === "running" && animation.effect.getComputedTiming().currentIteration >= 2
  )), "Returning to the dock should continue the existing loops");
  console.log("With reduced motion set, the chef and tornado loop by default, pause by keyboard, and resume without restarting.");
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
    await verifyGuideAutoplay(reducedPhone);

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
    const reducedDesktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await reducedDesktop.goto(production, { waitUntil: "domcontentloaded" });
    await reducedDesktop.locator('.chef-guide[data-tornado="ready"][data-performer="ready"]').waitFor({ state: "attached" });
    await verifyGuideAutoplay(reducedDesktop);

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
    assert.equal(await motion.locator(".cg-funnel-frame").evaluate(el => getComputedStyle(el).animationPlayState),"running");
    await motion.locator(".cg-laser").waitFor();
    console.log("Changing device motion during a flight leaves the guide playing and the pointer settles.");

    const basic = await browser.newPage({javaScriptEnabled:false,viewport:{width:320,height:640}});
    await basic.goto(preview,{waitUntil:"domcontentloaded"});
    assert(await basic.getByRole("navigation",{name:"Quick actions"}).getByRole("link",{name:"Menu",exact:true}).isVisible());
    assert(await basic.locator("#hours-details summary").isVisible());
    assert.equal(await basic.locator(".chef-guide").count(),0);
    console.log("JavaScript off: native visit and menu routes still render.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
