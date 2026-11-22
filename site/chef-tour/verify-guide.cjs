// Serve the preview, then run: node site/chef-tour/verify-guide.cjs [url]
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { chromium, webkit } = require("playwright");
const url = process.argv[2] ?? "http://127.0.0.1:54243/";
const captures = process.env.SPINNERS_TOUR_CAPTURES;
const menuDetails = new Map([
  ["Full menu", /Welcome to my kitchen/],
  ["Specialty Pizzas", /Alfredo Chicken.*A-1 Steak/],
  ["Create Your Own Pizza", /hand-tossed or gluten-free crust/],
  ["House Specials", /lasagna or a gyro/],
  ["Burgers", /Hoagie Burgers.*Spinner Special Smoked/],
  ["Appetizers", /garlic breadsticks or wings/],
  ["Drinks & Dessert", /fountain drink.*cookie/],
  ["The scoop counter", /shakes, malts and sundaes/],
]);
const destinations = [
  [["Menu & desserts"], "Full menu", "#menu-title"],
  ...["Specialty Pizzas", "Create Your Own Pizza", "House Specials", "Burgers", "Appetizers", "Drinks & Dessert"].map((name, i) =>
    [["Menu & desserts", "Browse by category"], name, `#menu .menu-group >> nth=${i} >> summary`]),
  [["Menu & desserts"], "The scoop counter", "#scoop-title"],
  [["Plan a visit","Hours & date check"], "Today’s hours", "#date-result"],
  [["Plan a visit","Hours & date check"], "Weekly hours", "#hours-details .weekly"],
  [["Plan a visit","Hours & date check"], "Check a visit date", "#visit-date"],
  [["Plan a visit","Hours & date check"], "Holiday hours and exceptions", "#hours-details .ticket-body ul"],
  [["Plan a visit","Directions"], "Show the address", ".locator-copy h3"],
  [["Plan a visit","Directions"], "Open in Maps", ".locator-copy a"],
  [["Plan a visit","Carry-out"], "Show the phone number", "#carry-out-number"],
  [["Plan a visit","Carry-out"], "Open the phone dialer", "#carry-out a"],
  [["Plan a visit"], "Discounts for our heroes", "#discount-title"],
  [["About Spinners"], "Our family story", "#story-title"],
  [["About Spinners","Inside Spinners"], "Show the photo gallery", "#gallery-title"],
  [["About Spinners","Inside Spinners"], "See the entrance", ".gallery-grid a:nth-child(1)"],
  [["About Spinners","Inside Spinners"], "See the counter", ".gallery-grid a:nth-child(2)"],
  [["About Spinners","Inside Spinners"], "See the dining room", ".gallery-grid a:nth-child(4)"],
  [["About Spinners"], "Customer reviews", "#reviews-title"],
];

async function verify({ name, engine, viewport, touch = false }) {
  const browser = await engine.launch(engine === chromium ? { executablePath: process.env.SPINNERS_CHROME } : {});
  const page = await browser.newPage({ viewport, hasTouch: touch });
  try {
    const errors = [];
    page.on("pageerror", error => errors.push(error));
    await page.goto(url);
    await page.locator('.chef-guide[data-performer="ready"]').waitFor({state:"attached"});
    const launch = page.getByRole("button", { name:"Ask the Spinners chef", exact:true });
    const avatar = page.locator(".cg-avatar");
    const picker = page.locator('.cg-picker');
    const tip = page.locator('.cg-step');
    const button = name => picker.getByRole("button",{name, exact:true});
    const press = locator => touch ? locator.tap({timeout:5000}) : locator.click({timeout:5000});
    async function open(...path) {
      await press(launch);
      for (const label of path) await press(button(label));
    }
    const laser = page.locator(".cg-laser");
    const outline = page.locator(".cg-highlight");
    const closeTip = async () => press(tip.getByRole("button",{name:"Close guide tip",exact:true}));
    const capturePicker = async state => {
      if (!captures) return;
      await picker.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
      await page.screenshot({ path: join(captures, `spinners-guide-${name}-${state}.png`) });
    };
    await open();
    await capturePicker("home");
    await press(button("Close guide menu"));
    for (const [path, leaf, target] of destinations) {
      await open(...path);
      await press(button(leaf));
      if (touch && leaf === "Specialty Pizzas") {
        await page.locator(".cg-step[data-en-route]").waitFor({ state: "attached" });
        assert.equal(await tip.getByRole("button", { name: "Point again" }).isVisible(), false);
      }
      await tip.getByRole("heading",{name:leaf,exact:true}).waitFor({timeout:4000});
      await outline.waitFor({timeout:3500});
      await page.waitForFunction(() => {
        const avatar = document.querySelector(".cg-avatar");
        return !avatar.dataset.travel && avatar.dataset.frame !== "speak";
      });
      await laser.waitFor({timeout:1200}).catch(() => {
        throw Error(`${name}: no beam for ${leaf}`);
      });
      if (menuDetails.has(leaf)) assert.match(await tip.locator(".cg-copy").textContent(), menuDetails.get(leaf));
      const box = await page.locator(target).boundingBox();
      assert(box, `${name} target ${leaf}`);
      const mark = await outline.boundingBox();
      assert(mark && mark.x < box.x + box.width && mark.x + mark.width > box.x && mark.y < box.y + box.height && mark.y + mark.height > box.y, `${name} mark ${leaf}`);
      const dot = await page.locator(".cg-dot").boundingBox();
      const x = dot.x + dot.width / 2;
      const y = dot.y + dot.height / 2;
      assert(x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height,
        `${name}: laser missed ${leaf}`);
      if (leaf === "Specialty Pizzas" && captures) {
        await page.screenshot({ path: join(captures, `spinners-guide-${name}-points.png`) });
      }
      if (touch && leaf === "Specialty Pizzas") {
        const chef = await page.locator(".cg-visual").boundingBox();
        assert(chef && chef.y >= box.y + box.height, "The chef should leave the category heading clear.");
      }
      if (leaf === "Today’s hours") {
        assert.equal(await page.locator('#date-result').getAttribute("data-state"),"unknown");
        await tip.getByRole("link", { name: "Call to check" }).waitFor();
      }
      if (leaf === "Check a visit date") {
        await press(tip.getByRole("button", { name: "Go to highlight", exact: true }));
        assert(await page.locator("#visit-date").evaluate(el => document.activeElement === el));
        await page.locator("#visit-date").fill("2026-12-24");
        assert.match(await page.locator("#result-text").textContent(), /Dec 24, 2026/);
      }
      if (leaf === "Open in Maps" || leaf === "Open the phone dialer") {
        const href = await tip.getByRole("link", { name:leaf, exact:true }).getAttribute("href");
        assert.match(href, leaf === "Open in Maps" ? /^https:\/\// : /^tel:/);
      }
      if (leaf === "See the counter") {
        await press(tip.getByRole("button", { name: "Open photo", exact:true }));
        const dialog = page.getByRole("dialog");
        await dialog.waitFor();
        assert.equal(await dialog.getByRole("heading").textContent(), "Looking at the Counter");
        await press(dialog.getByRole("button",{name:"Close"}));
        await page.waitForFunction(() => document.activeElement?.classList.contains("cg-tip-button"));
        await outline.waitFor();
      }
      await closeTip();
    }
    await open("Menu & desserts","Pick something for me");
    const first = await picker.getByRole("heading").textContent();
    await press(button("Pick again"));
    const selected = await picker.getByRole("heading").textContent();
    assert(first !== selected, "Pick again changed the dish");
    await press(button("Show me on the menu"));
    await tip.getByRole("heading",{name:selected,exact:true}).waitFor();
    await outline.waitFor();
    assert((await tip.locator(".cg-copy").textContent()).includes(`I picked ${selected} for you.`));
    const dish = page.locator("#menu li").filter({ hasText: selected }).first();
    await dish.evaluate(el => { el.closest("details").open = false; });
    await outline.waitFor({ state: "hidden" });
    await press(tip.getByRole("button", { name: "Point again" }));
    await laser.waitFor();
    assert(await dish.isVisible());
    await closeTip();
    await open("Plan a visit","Directions");
    await press(button("Back"));
    assert(await button("Directions").evaluate(el => document.activeElement === el));
    await page.keyboard.press("Escape");
    assert(await launch.evaluate(el => document.activeElement === el));

    await open("Guided tours");
    await press(button("Menu tour"));
    await press(tip.getByRole("button",{name:"Next",exact:true}));
    await open("Menu & desserts","Full menu");
    await outline.waitFor();
    await open("Resume tour");
    assert.match(await tip.locator(".cg-progress").textContent(), /2 of 4/);
    await press(tip.getByRole("button",{name:"End tour",exact:true}));
    await open("Menu & desserts","Full menu");
    await laser.waitFor();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await outline.waitFor({ state:"hidden" });
    await press(tip.getByRole("button",{name:"Point again",exact:true}));
    await laser.waitFor();
    await closeTip();

    const settings = picker.locator(".cg-settings");
    const control = name => settings.getByRole("button", { name, exact: true });
    await open();
    assert(await settings.evaluate(el => el.previousElementSibling.matches(".cg-card-head")));
    await press(control("Move chef"));
    await press(control("Top left"));
    const corner = await avatar.boundingBox();
    assert(corner.x < 25 && corner.y < 30);
    await press(control("Reset position"));
    const defaultDock = await avatar.boundingBox();
    assert(Math.hypot(defaultDock.x - corner.x, defaultDock.y - corner.y) > 50);
    const motion = control("Guide motion");
    assert.equal(await motion.getAttribute("aria-pressed"), "true");
    const icon = motion.locator(".cg-settings-icon");
    const image = () => icon.evaluate(el => getComputedStyle(el).backgroundImage);
    const playingFace = await image();
    await press(motion);
    assert((await page.locator(".chef-guide").getAttribute("class")).includes("cg-still"));
    assert.equal(await motion.getAttribute("aria-pressed"), "false");
    assert.notEqual(await image(), playingFace);
    await press(motion);
    assert.equal(await image(), playingFace);
    const follow = control("Follow me");
    assert.equal(await follow.getAttribute("aria-pressed"), "true");
    await press(follow);
    assert.equal(await follow.getAttribute("aria-pressed"), "false");
    await press(follow);
    await press(button("Close guide menu"));
    await page.evaluate(() => window.scrollTo(0, document.querySelector('#menu').offsetTop - 90));
    const note = page.getByRole("button", { name: "Let me show you my menu", exact: true });
    await note.waitFor();
    const [funnel, invitation] = await Promise.all([page.locator(".cg-funnel").boundingBox(), note.boundingBox()]);
    assert(invitation.y > funnel.y + funnel.height && invitation.y + invitation.height <= viewport.height);
    if (touch) await press(note);
    else await note.press("Enter");
    assert.match(await tip.locator(".cg-progress").textContent(), /Menu tour · 1 of 4/);
    await press(tip.getByRole("button", { name: "Next", exact: true }));
    await tip.getByRole("heading", { name: "Specialty Pizzas", exact: true }).waitFor();
    await press(tip.getByRole("button", { name: "End tour", exact: true }));
    await open();
    await press(control("Hide chef"));
    assert(!(await launch.isVisible()));
    assert(await control("Move chef").isDisabled());
    await press(control("Show chef"));
    assert(await launch.isVisible());
    assert(await button("Menu & desserts").isVisible());
    await press(button("Menu & desserts"));
    await press(button("Browse by category"));
    await capturePicker("categories");
    assert.deepEqual(errors, []);
    console.log(name, destinations.length, "direct beam hits, food picker, tour resume, and guide settings.");
  } finally {
    await browser.close();
  }
}

Promise.all([
  verify({name:"desktop",engine:chromium,viewport:{width:1440,height:900}}),
  verify({name:"phone",engine:webkit,viewport:{width:390,height:844},touch:true}),
]).catch(error=> { console.error(error);process.exitCode = 1; });
