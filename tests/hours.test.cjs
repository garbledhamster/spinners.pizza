const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, mock, test } = require("node:test");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const rendererPath = path.join(root, "scripts/render-hours.cjs");
const browserScript = path.join(root, "scripts/hours.js");
const origin = "https://hours.test";

const fixture = {
  effectiveFrom: "2026-11-20",
  effectiveThrough: "2027-01-03",
  weekly: {
    Sunday: { opens: "11:00", closes: "18:00" },
    Monday: { opens: "11:00", closes: "20:00" },
    Tuesday: { opens: "11:00", closes: "20:00" },
    Wednesday: "closed",
    Thursday: { opens: "11:00", closes: "21:00" },
    Friday: { opens: "11:00", closes: "21:00" },
    Saturday: { opens: "11:00", closes: "21:00" },
  },
  overrides: [
    { start: "2026-11-26", state: "hours", opens: "12:00", closes: "15:00", label: "Holiday hours" },
    { start: "2026-12-23", end: "2026-12-26", state: "closed", label: "December closure" },
    { start: "2027-01-01", state: "unconfirmed", label: "New Year's Day" },
  ],
};

function renderSection(schedule, posting) {
  const renderHours = require(rendererPath);
  if (schedule === undefined && posting === undefined) return renderHours({ root });

  const read = fs.readFileSync;
  const visitHoursFile = path.join(root, "data/visit-hours.json");
  const postingFile = path.join(root, "data/hours.json");
  const fixtureRead = mock.method(fs, "readFileSync", (filename, ...args) => {
    if (schedule !== undefined && filename === visitHoursFile) return JSON.stringify(schedule);
    if (posting !== undefined && filename === postingFile) return JSON.stringify(posting);
    return read(filename, ...args);
  });

  try {
    return renderHours({ root });
  } finally {
    fixtureRead.mock.restore();
  }
}

function pageHtml(schedule, posting) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <title>Hours test</title><script defer src="/scripts/hours.js"></script></head>
    <body><a href="#hours">Hours</a><main>${renderSection(schedule, posting)}</main></body></html>`;
}

let browser;

before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.SPINNERS_CHROME,
    args: ["--disable-background-networking", "--disable-component-update"],
  });
});

after(async () => {
  await browser?.close();
});

async function createPage(t, html, options) {
  const context = await browser.newContext(options);
  t.after(() => context.close());
  await context.route("**/*", async (route) => {
    const requested = new URL(route.request().url());
    if (requested.origin === origin && requested.pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: html });
    } else if (requested.origin === origin && requested.pathname === "/scripts/hours.js") {
      await route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(browserScript) });
    } else {
      await route.abort();
    }
  });
  return context.newPage();
}

async function openDisclosureWithoutScript(page) {
  await page.goto(origin);
  await page.getByRole("link", { name: "Hours", exact: true }).first().click();
  assert.equal(new URL(page.url()).hash, "#hours");
  const summary = page.locator("#hours-details summary");
  assert.equal(await summary.count(), 1, "the Hours anchor must reach a native disclosure");
  await summary.click();
  assert.equal(await page.locator("#hours-details").getAttribute("open"), "");
}

async function selectDate(page, date, expectedState, expectedText) {
  await page.getByLabel("Visit date").fill(date);
  const result = page.getByRole("status");
  assert.equal(await result.getAttribute("data-state"), expectedState, date);
  assert.match(await result.innerText(), expectedText, date);
  return result.innerText();
}

test("Hours exposes a native disclosure with posted information when scripts are off", async (t) => {
  const page = await createPage(t, pageHtml(), { javaScriptEnabled: false });
  await openDisclosureWithoutScript(page);
  const disclosure = page.locator("#hours-details");
  assert.match(await disclosure.innerText(), /posted weekly hours/i);
  assert.match(await disclosure.locator(".weekly").innerText(), /Wednesday\s+Closed/);
  assert.match(await disclosure.innerText(), /call to confirm hours for your visit date/i);
  assert.match(await disclosure.innerText(), /Seasonal and holiday notes[\s\S]*Thanksgiving Day/i);
  const phone = disclosure.getByRole("link", { name: /417.*462.*7746/ });
  assert.equal(await phone.getAttribute("href"), "tel:+14174627746");
  assert.equal(await phone.textContent(), "(417)\u00a0462\u20117746");
  assert.ok(await disclosure.getByText("Call to check hours", { exact: true }).isVisible());
  assert.equal(await page.locator("#visit-date").isVisible(), false);
  assert.doesNotMatch(await disclosure.innerText(), /open now|closed now/i);
});

test("defaults at Grovespring midnight and resolves the same date in two device timezones", async (t) => {
  const html = pageHtml(fixture);
  const holiday = [];
  for (const timezoneId of ["Asia/Tokyo", "America/Los_Angeles"]) {
    const page = await createPage(t, html, { timezoneId });
    for (const [instant, date, weekday] of [
      ["2026-11-21T05:59:00Z", "2026-11-20", "Friday"],
      ["2026-11-21T06:01:00Z", "2026-11-21", "Saturday"],
    ]) {
      await page.clock.setFixedTime(new Date(instant));
      await page.goto(origin);
      await page.getByRole("link", { name: "Hours", exact: true }).click();
      assert.equal(await page.locator("#hours-details").getAttribute("open"), "");
      assert.equal(await page.getByLabel("Visit date").inputValue(), date);
      assert.match(await page.getByRole("status").innerText(), new RegExp(weekday));
    }
    holiday.push(await selectDate(page, "2026-11-26", "hours", /12 pm–3 pm[\s\S]*Holiday hours/i));
  }
  assert.equal(holiday[0], holiday[1]);
});

test("resolves weekly hours, range endpoints, and inclusive coverage", async (t) => {
  const page = await createPage(t, pageHtml(fixture));
  await page.goto(`${origin}/#hours`);
  assert.equal(await page.locator("#hours-details").getAttribute("open"), "");
  const scenarios = [
    ["2026-11-19", "unknown", /Hours unconfirmed/],
    ["2026-11-20", "hours", /11 am–9 pm[\s\S]*Friday/],
    ["2026-11-23", "hours", /11 am–8 pm[\s\S]*Monday/],
    ["2026-11-25", "closed", /Closed[\s\S]*Wednesday/],
    ["2026-12-22", "hours", /11 am–8 pm/],
    ["2026-12-23", "closed", /Closed[\s\S]*December closure/],
    ["2026-12-26", "closed", /Closed[\s\S]*December closure/],
    ["2026-12-27", "hours", /11 am–6 pm/],
    ["2027-01-01", "unknown", /Hours unconfirmed[\s\S]*New Year's Day/],
    ["2027-01-03", "hours", /11 am–6 pm/],
    ["2027-01-04", "unknown", /Hours unconfirmed/],
    ["", "unknown", /Hours unconfirmed/],
  ];
  const result = page.getByRole("status");
  assert.equal(await result.getAttribute("aria-atomic"), "true");
  for (const [date, state, output] of scenarios) await selectDate(page, date, state, output);
  assert.ok(await page.getByRole("link", { name: /417.*462.*7746/ }).isVisible());
  assert.doesNotMatch(await page.locator("#hours").innerText(), /open now|closed now/i);
});

test("the script-disabled fixture shows the same coverage, exceptions and phone", async (t) => {
  const page = await createPage(t, pageHtml(fixture), { javaScriptEnabled: false });
  await openDisclosureWithoutScript(page);
  const disclosure = page.locator("#hours-details");
  const dates = await disclosure.locator("time[datetime]").evaluateAll((nodes) => nodes.map((node) => node.dateTime));
  assert.deepEqual(dates, ["2026-11-20", "2027-01-03", "2026-11-26", "2026-12-23", "2026-12-26", "2027-01-01"]);
  assert.match(await disclosure.innerText(), /Holiday hours[\s\S]*12 pm–3 pm/);
  assert.match(await disclosure.innerText(), /December closure[\s\S]*Closed/);
  assert.match(await disclosure.innerText(), /New Year's Day[\s\S]*Hours unconfirmed/);
  assert.ok(await page.getByRole("link", { name: /417.*462.*7746/ }).isVisible());
});

test("missing or unusable schedule data keeps the phone fallback and native Hours panel", async (t) => {
  const html = pageHtml(fixture);
  const embedded = /(<script id="published-hours" type="application\/json">).*?(<\/script>)/s;
  assert.match(html, embedded);
  const invalidWeekly = { ...fixture, weekly: { ...fixture.weekly, Friday: { opens: "25:00", closes: "21:00" } } };
  const invalidDate = { ...fixture, effectiveFrom: "2026-11-31" };
  const outsideOverride = { ...fixture, overrides: [{ ...fixture.overrides[0], start: "2026-11-19" }] };
  const conflictingOverrides = { ...fixture, overrides: [fixture.overrides[0], fixture.overrides[0]] };
  for (const candidate of [
    pageHtml(),
    html.replace(embedded, ""),
    html.replace(embedded, (_, start, end) => `${start}{bad${end}`),
    html.replace(embedded, (_, start, end) => `${start}${JSON.stringify(invalidWeekly)}${end}`),
    pageHtml(invalidDate),
    pageHtml(outsideOverride),
    pageHtml(conflictingOverrides),
  ]) {
    const page = await createPage(t, candidate);
    await page.goto(`${origin}/#hours`);
    await selectDate(page, "2026-11-20", "unknown", /Hours unconfirmed/);
    assert.ok(await page.getByRole("link", { name: /417.*462.*7746/ }).isVisible());
  }
});

test("unusable previous posting still exposes the native phone fallback", async (t) => {
  const page = await createPage(t, pageHtml(null, { days: [null], notes: [null] }), { javaScriptEnabled: false });
  await openDisclosureWithoutScript(page);
  assert.match(await page.locator("#hours-details").innerText(), /Call to confirm hours for your visit date/);
  assert.ok(await page.getByRole("link", { name: /417.*462.*7746/ }).isVisible());
});
