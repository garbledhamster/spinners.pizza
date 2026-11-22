// Serve the preview, then run: node site/chef-tour/verify-preview.cjs [url]
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { chromium, webkit } = require("playwright");

const url = process.argv[2] ?? "http://127.0.0.1:54243/";
const captures = process.env.SPINNERS_TOUR_CAPTURES;
const tours = [["Site", 3], ["Menu", 4], ["Restaurant", 4], ["Family", 3]];
const screens = [
  ["desktop", chromium, { width: 1440, height: 900 }],
  ["phone", chromium, { width: 390, height: 844 }],
  ["small", webkit, { width: 360, height: 640 }],
  ["narrow", chromium, { width: 320, height: 640 }],
];

async function geometry(page) {
  return page.evaluate(() => {
    const get = (selector) => document.querySelector(selector);
    const nozzle = (get(".cg-peel-emitter") ?? get(".cg-emitter")).getBoundingClientRect();
    const spot = get(".cg-dot").getBoundingClientRect();
    const mark = get(".cg-highlight").getBoundingClientRect();
    const avatar = get(".cg-visual").getBoundingClientRect();
    const beam = get(".cg-laser");
    const matrix = new DOMMatrix(getComputedStyle(beam).transform);
    const length = parseFloat(beam.style.width);
    const point = { x: spot.x + spot.width / 2, y: spot.y + spot.height / 2 };
    const overlap = Math.max(0, Math.min(avatar.right, mark.right) - Math.max(avatar.left, mark.left))
      * Math.max(0, Math.min(avatar.bottom, mark.bottom) - Math.max(avatar.top, mark.top));
    return {
      emitterError: Math.hypot(nozzle.x - matrix.e, nozzle.y - matrix.f),
      tipError: Math.hypot(point.x - matrix.e - length * matrix.a, point.y - matrix.f - length * matrix.b),
      inside: point.x >= mark.left && point.x <= mark.right && point.y >= mark.top && point.y <= mark.bottom,
      overlap,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

async function checkScreen(name, engine, viewport) {
  const browser = await engine.launch(engine === chromium ? { executablePath: process.env.SPINNERS_CHROME } : {});
  try {
    const page = await browser.newPage({ viewport, hasTouch: name !== "desktop" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error));
    page.on("response", (response) => {
      if (response.url().startsWith(new URL(url).origin) && !response.ok() && response.status() !== 304)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const image = page.locator(".cg-art");
    await image.evaluate(img => img.decode());
    await page.locator('.chef-guide[data-performer="ready"]').waitFor({ state: "attached" });
    const funnel = page.locator(".cg-funnel-frame");
    await funnel.waitFor();
    const firstFrame = await funnel.evaluate(el => getComputedStyle(el).backgroundPositionX);
    await page.waitForFunction(initial => {
      const frame = document.querySelector(".cg-funnel-frame");
      return getComputedStyle(frame).backgroundPositionX !== initial;
    }, firstFrame);

    const launch = page.getByRole("button", { name: "Ask the Spinners chef" });
    const picker = page.locator(".cg-picker");
    const progress = page.locator(".cg-progress");
    const capture = async (state) => {
      if (captures && ["desktop", "phone"].includes(name)) {
        await page.screenshot({ path: join(captures, `spinners-tour-${name}-${state}.png`) });
      }
    };

    const badge = launch.getByText("Ask the chef", { exact: true });
    const propOrder = await page.locator(".cg-avatar").evaluate(avatar => {
      const order = selector => Number(getComputedStyle(avatar.querySelector(selector)).zIndex);
      return [order(".cg-funnel-rim"), order(".cg-prop-layer"), order(".cg-grip-layer")];
    });
    assert(propOrder[0] < propOrder[1] && propOrder[1] < propOrder[2], "The spatula belongs between the tornado and the grip.");
    const [captionBox, funnelBox] = await Promise.all([badge.boundingBox(), funnel.boundingBox()]);
    assert(captionBox.y >= funnelBox.y + funnelBox.height + 4, `${name}: the caption overlaps the tornado`);
    assert(captionBox.y + captionBox.height <= viewport.height, `${name}: the caption is cut off`);
    const frame = await page.locator(".cg-frame-art").boundingBox();
    assert(Math.abs(frame.width - frame.height) < .05, `${name}: the square chef sprite is stretched`);
    const waist = await page.locator(".cg-avatar").evaluate(avatar => {
      const rider = avatar.querySelector(".cg-performance");
      const funnel = avatar.querySelector(".cg-funnel");
      const rim = avatar.querySelector(".cg-funnel-rim");
      const [, pivotY] = getComputedStyle(rider).transformOrigin.split(" ").map(parseFloat);
      return {
        pose: avatar.dataset.frame,
        gap: Math.abs(pivotY - parseFloat(getComputedStyle(funnel).top)),
        rim: getComputedStyle(rim).maskImage,
      };
    });
    assert.equal(waist.pose, "idle");
    assert(waist.gap < 1 && waist.rim.includes("gradient"), `${name}: torso and funnel rim are disconnected`);
    await capture("standby");
    name === "desktop" ? await badge.click() : await badge.tap();
    await picker.getByRole("button", { name: "Guided tours", exact: true }).waitFor();
    await capture("picker");
    for (const [tour, count] of tours) {
      if (!(await picker.isVisible())) await launch.click();
      await picker.getByRole("button", { name: "Guided tours", exact: true }).click();
      if (tour === "Menu") {
        await page.evaluate(() => {
          const samples = window.guideMotionSamples = [];
          const avatar = document.querySelector(".cg-avatar");
          const rider = avatar.querySelector(".cg-performance");
          const beam = document.querySelector(".cg-laser");
          const started = performance.now();
          const sample = now => {
            samples.push({
              y: scrollY, flying: avatar.hasAttribute("data-travel"), beam: !beam.hidden,
              lean: parseFloat(rider.style.getPropertyValue("--cg-rider-lean")) || 0,
            });
            if (now - started < 3000) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
      }
      await picker.getByRole("button", { name: `${tour} tour`, exact: true }).click();
      for (let index = 1; index <= count; index++) {
        assert.equal(await progress.textContent(), `${tour} tour · ${index} of ${count}`);
        await page.locator(".cg-laser").waitFor({ state: "visible", timeout: 4200 }).catch(async () => {
          throw Error(`${name} ${tour} ${index}: beam did not settle in pose ${await page.locator(".cg-avatar").getAttribute("data-frame")}`);
        });
        await page.waitForFunction(() => !document.querySelector(".cg-avatar").getAnimations().length);
        const facts = await geometry(page);
        const label = `${name} ${tour} ${index}: ${JSON.stringify(facts)}`;
        assert.ok(facts.emitterError < 2 && facts.tipError < 1 && facts.inside && !facts.overflow, label);
        if (tour === "Menu" && index === 1) {
          const samples = await page.evaluate(() => window.guideMotionSamples);
          const ys = samples.map(frame => frame.y);
          const delta = Math.abs(ys.at(-1) - ys[0]);
          assert(delta > 150, `${name}: the test should exercise a long page scroll`);
          assert(new Set(ys).size >= 12, `${name}: the page jumped to the destination`);
          assert(ys.every((y, i) => i === 0 || Math.abs(y - ys[i - 1]) < delta * .5), `${name}: page motion skipped frames`);
          assert(samples.filter(frame => frame.flying && frame.y !== ys[0] && frame.y !== ys.at(-1)).length >= 10);
          assert(samples.some(frame => frame.lean > 4) && samples.some(frame => frame.lean < -4));
          assert(!samples.some(frame => frame.flying && frame.beam), `${name}: the laser appeared during flight`);
          assert.match(await page.locator(".cg-copy").textContent(), /Welcome to my kitchen/);
          assert.equal(facts.overlap, 0, label);
          assert.ok(await page.getByRole("link", { name: "Desserts" }).evaluate(link => {
            const rect = link.getBoundingClientRect();
            return link.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
          }), `${label} · Desserts should stay tappable`);
          await capture("menu");
        }
        if (index === 2) {
          await page.getByRole("button", { name: "Back", exact: true }).click();
          assert.equal(await progress.textContent(), `${tour} tour · 1 of ${count}`);
          await page.getByRole("button", { name: "Next", exact: true }).click();
        }
        await page.getByRole("button", { name: index === count ? "Finish" : "Next", exact: true }).click();
      }
    }
    await launch.focus();
    await page.keyboard.press("Enter");
    assert.equal(await picker.isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await picker.isVisible(), false);
    const before = await launch.boundingBox();
    await page.mouse.move(before.x + 37, before.y + 35);
    await page.mouse.down();
    await page.mouse.move(before.x - 25, before.y - 22, { steps: 6 });
    await page.mouse.up();
    const coast = page.locator(".cg-avatar[data-coast]");
    await coast.waitFor({ state: "detached" });
    const after = await launch.boundingBox();
    assert.ok(Math.hypot(after.x - before.x, after.y - before.y) > 25);
    assert.equal(await picker.isVisible(), false);
    if (name === "desktop") {
      const wake = () => page.evaluate(() => {
        const avatar = document.querySelector(".cg-avatar");
        const puffs = [...document.querySelectorAll(".cg-dust:not([hidden])")];
        return {
          bank: parseFloat(avatar.style.getPropertyValue("--cg-funnel-bank")),
          stretch: parseFloat(avatar.style.getPropertyValue("--cg-funnel-stretch")),
          count: puffs.length,
          duration: Math.max(0, ...puffs.flatMap(puff => puff.getAnimations().map(animation => animation.effect.getTiming().duration))),
        };
      });
      await page.waitForFunction(() => !document.querySelector(".cg-dust:not([hidden])"));
      const x = after.x + after.width / 2, y = after.y + 32;
      await page.mouse.move(x, y);
      await page.mouse.down();
      const updates = await launch.evaluate(async (control, { x, y }) => {
        const style = control.parentElement.style;
        const set = style.setProperty;
        let writes = 0;
        style.setProperty = function (property, ...values) {
          if (property === "--cg-x") writes++;
          return set.call(this, property, ...values);
        };
        try {
          for (let i = 1; i <= 30; i++) {
            control.dispatchEvent(new PointerEvent("pointermove", {
              pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: x - i, clientY: y,
            }));
          }
          const beforeFrame = writes;
          await new Promise(requestAnimationFrame);
          return [beforeFrame, writes];
        } finally {
          style.setProperty = set;
        }
      }, { x, y });
      assert.deepEqual(updates, [0, 1], "Pointer samples should be batched into one rendered frame.");
      await page.mouse.move(x, y, { steps: 6 });
      await page.mouse.move(x - 32, y, { steps: 12 });
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const slow = await wake();
      await page.mouse.move(x - 252, y - 40);
      await page.evaluate(() => new Promise(requestAnimationFrame));
      const fast = await wake();
      assert(fast.bank < slow.bank && fast.stretch > slow.stretch + .05, JSON.stringify({ slow, fast }));
      assert(fast.count > slow.count && fast.duration > slow.duration + 150, JSON.stringify({ slow, fast }));
      const released = await launch.boundingBox();
      await page.mouse.up();
      await coast.waitFor({ state: "attached" });
      await capture("fast-drag");
      await coast.waitFor({ state: "detached" });
      const settled = await launch.boundingBox();
      assert(settled.x < released.x - 30, "A quick flick continues in the release direction.");
      await page.waitForFunction(() => !document.querySelector(".cg-dust:not([hidden])"));
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launch.click();
    await picker.getByRole("button", { name: "Guided tours", exact: true }).click();
    await picker.getByRole("button", { name: "Menu tour", exact: true }).click();
    assert.equal(await page.locator(".cg-avatar").evaluate(el => getComputedStyle(el).transitionDuration), "0s");
    assert.equal(await funnel.evaluate(el => getComputedStyle(el).animationName), "none");
    assert.equal(await page.locator(".cg-performance").evaluate(el => getComputedStyle(el).animationName), "none");
    assert.equal(await page.locator(".cg-dust:not([hidden])").count(), 0);
    if (name === "desktop") {
      await page.setViewportSize({ width: 900, height: 700 });
      await page.goto(url);
      await funnel.waitFor();
      const avatar = await page.locator(".cg-avatar").boundingBox();
      const control = await page.locator("#motion-control").boundingBox();
      assert(avatar.width >= 160, "A narrower desktop window should render the larger chef.");
      assert(avatar.x + avatar.width < control.x, "The wider chef should leave the emblem control clear.");
    }
    assert.deepEqual(errors, []);
    console.log(`${name} ${browser.version()}: 14 stops, shared waist pivot, clear caption, coordinated scroll and lean, beam alignment, Back, Finish, Escape, drag, reduced motion.`);
  } finally {
    await browser.close();
  }
}

async function verify() {
  for (const screen of screens) await checkScreen(...screen);
}

verify().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
