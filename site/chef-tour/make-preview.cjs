// Run from any directory: node site/chef-tour/make-preview.cjs
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, "../..");
const input = readFileSync(resolve(root, "index.html"), "utf8");

if (!/src="site\/chef-tour\/spinners-tours\.mjs(?:\?[^"]+)?"/.test(input)) {
  throw new Error("Build the integrated Counter Ticket site first");
}

const preview = input
  .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">')
  .replace(/<title>.*?<\/title>/, "<title>Spinners Pizza · Private chef guide</title>");
writeFileSync(resolve(root, "chef-tour-preview.html"), preview);
