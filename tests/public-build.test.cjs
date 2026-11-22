const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const root = join(__dirname, "..");

test("the tracked GitHub Pages home is the public Counter Ticket build", () => {
  execFileSync(process.execPath, ["scripts/build-counter-ticket.cjs", "--check"], { cwd: root });
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.match(html, /name="robots" content="index,follow/);
  assert.doesNotMatch(html, /\bPreview\b|_preview\/|Street number and map pin need confirmation/);
  assert.match(html, /9537 MO-5, Grovespring, MO 65662/);
  assert.match(html, /maps\?cid=10087945801653444493/);
  assert.match(html, /tel:\+14174627746/);
  const schedule = require("../data/visit-hours.json");
  if (schedule.effectiveFrom && schedule.effectiveThrough) {
    assert.match(html, /Published weekly hours/);
    assert.match(html, /Effective <time/);
  } else {
    assert.match(html, /Posted weekly hours/);
    assert.match(html, /December 23rd thru December 26th/);
  }
  assert.match(html, /25 flavors of Kemps ice cream/);
});

test("publishes the restaurant's Google map in the visit section", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const visit = html.match(/<section id="visit"[\s\S]*?<\/section>/)?.[0];
  assert.match(visit, /<iframe class="locator-map" title="Spinners Pizza on Google Maps" loading="lazy"/);
  assert.match(visit, /google\.com\/maps\/embed\?pb=[^"]+8bf775b1d6a5af4d/);
  assert.match(visit, /google\.com\/maps\/dir\/\?api=1&amp;destination=9537/);
  assert.doesNotMatch(visit, /ozarks\.webp/);
});
