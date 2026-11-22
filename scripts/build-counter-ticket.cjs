const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const renderHours = require("./render-hours.cjs");
const renderContent = require("./render-content.cjs");

const root = path.resolve(__dirname, "..");
const options = new Set(process.argv.slice(2));
const preview = options.has("--preview");
const check = options.has("--check");
for (const option of options) {
  assert.ok(option === "--preview" || option === "--check", "Unknown build option: " + option);
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function insert(html, marker, markup) {
  assert.equal(html.split(marker).length, 2, "Expected one " + marker + " placeholder");
  return html.replace(marker, () => markup.trim());
}

let html = read("site/layout.html");
if (preview) {
  html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">');
}
html = insert(html, "<!-- COUNTER_TICKET_HOURS -->", renderHours({ root }));
html = insert(html, "<!-- COUNTER_TICKET_CONTENT -->", renderContent({ root }));
html = insert(html, "<!-- COUNTER_TICKET_LOCATOR_ART -->", [
  '<figure class="locator-art">',
  '  <img src="assets/images/counter-ticket/illustrations/ozarks.webp" width="648" height="492" alt="Illustrated road through the Ozarks hills" loading="lazy" decoding="async">',
  '  <figcaption>Ozarks illustration</figcaption>',
  '</figure>',
].join("\n"));
if (check) {
  assert.equal(read("index.html"), html, "Regenerate index.html with the same build flags.");
} else {
  fs.writeFileSync(path.join(root, "index.html"), html);
}
