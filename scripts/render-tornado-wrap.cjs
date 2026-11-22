// Generate the two matching depth layers for the tornado on the same frame clock.
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright");

async function build() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const strips = await page.evaluate(() => {
      const frames = 48;
      const size = 96;
      const turn = Math.PI * 2;
      const windings = [
        { height: .21, radius: .465, depth: .070, tilt: -.034, phase: 0, thickness: 1.8 },
        { height: .44, radius: .363, depth: .069, tilt: -.068, phase: 2.2, thickness: 1.5 },
        { height: .65, radius: .247, depth: .061, tilt: -.055, phase: 4.1, thickness: 1.15 },
      ];
      return ["rear", "near"].map(side => {
        const canvas = document.createElement("canvas");
        canvas.width = size * frames;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.lineCap = "round";

        for (let frame = 0; frame < frames; frame++) {
          ctx.save();
          ctx.translate(frame * size, 0);
          for (const band of windings) {
            const head = turn * frame / frames + band.phase - Math.PI / 2;
            const arc = 2.5;
            const segments = 52;
            const point = angle => {
              const x = Math.cos(angle);
              const depth = Math.sin(angle);
              return [size * (.5 + band.radius * x), size * (band.height + band.depth * depth + band.tilt * x)];
            };
            for (let segment = 0; segment < segments; segment++) {
              const progress = (segment + .5) / segments;
              const angle = head - arc + arc * progress;
              const depth = Math.sin(angle);
              if ((side === "near") !== (depth >= 0)) continue;
              const strength = Math.sin(Math.PI * progress) * Math.abs(depth) ** .45;
              const [x1, y1] = point(angle - arc / (2 * segments));
              const [x2, y2] = point(angle + arc / (2 * segments));
              ctx.strokeStyle = side === "near" ? `rgba(255, 247, 224, ${.33 * strength})`
                : `rgba(160, 151, 137, ${.25 * strength})`;
              ctx.lineWidth = band.thickness * (.55 + strength * .45);
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }
          ctx.restore();
        }
        return [side, canvas.toDataURL("image/webp", .92).split(",")[1]];
      });
    });
    for (const [side, data] of strips) {
      writeFileSync(join(__dirname, "../site/chef-tour/art", `tornado-wrap-${side}.webp`), Buffer.from(data, "base64"));
    }
  } finally {
    await browser.close();
  }
}

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
