const map = document.querySelector(".visit-map");
const stage = map.querySelector(".visit-map-stage");
const canvas = stage.querySelector("canvas");
const zoomIn = stage.querySelector('[data-map-zoom="in"]');
const zoomOut = stage.querySelector('[data-map-zoom="out"]');
const fallback = document.querySelector("iframe.locator-map");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const focusZoom = 3.4;
const maxZoom = 4.1;

function exposureZoom(rect, viewportHeight) {
  const visible = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
  const share = clamp(visible / Math.min(rect.height, viewportHeight), 0, 1);
  const centered = 1 - clamp(Math.abs(rect.top + rect.height / 2 - viewportHeight / 2) /
    ((viewportHeight + rect.height) / 2), 0, 1);
  return 2.45 * (.7 * share + .3 * centered);
}

const scaleChoices = [
  [1609.344, "1 mi"], [804.672, "½ mi"], [304.8, "1,000 ft"], [152.4, "500 ft"],
  [60.96, "200 ft"], [30.48, "100 ft"], [15.24, "50 ft"],
];

function paint(ctx, data, width, height, zoom) {
  const x = width / 2;
  const y = height * .54;
  const scale = width * 2 ** zoom / 5200;
  const project = point => [x + point[0] * scale, y + point[1] * scale];
  const trace = (paths, color, weight) => {
    ctx.beginPath();
    for (const path of paths) {
      ctx.moveTo(...project(path[0]));
      for (let i = 1; i < path.length; i++) ctx.lineTo(...project(path[i]));
    }
    ctx.lineWidth = weight;
    ctx.strokeStyle = color;
    ctx.stroke();
  };

  ctx.fillStyle = "#f1e3cc";
  ctx.fillRect(0, 0, width, height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  trace(data.lines.water ?? [], "#769eaa", 1.5);
  if (zoom > .85) trace(data.lines.service ?? [], "#c4ab8a", 1.3);
  trace(data.lines.local ?? [], "#b39577", 3);
  trace(data.lines.local ?? [], "#fff9ed", 1.65);
  const highways = [...(data.lines.tertiary ?? []), ...(data.lines.secondary ?? [])];
  trace(highways, "#a87658", 5);
  trace(highways, "#fbf2de", 3);
  trace(data.lines.primary, "#8c4634", 6.5);
  trace(data.lines.primary, "#f4ca8d", 4.3);

  function label(text, px, py, font, ink, paper = "#fff9ef") {
    ctx.font = font + " system-ui, sans-serif";
    const w = ctx.measureText(text).width + 16;
    if (px - w / 2 < 3 || px + w / 2 > width - 3 || py < 12 || py > height - 12) return;
    ctx.beginPath();
    ctx.roundRect(px - w / 2, py - 11, w, 22, 4);
    ctx.fillStyle = paper;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.fillText(text, px, py + .5);
  }

  for (const [name, mx, my] of data.places) {
    const [px, py] = project([mx, my]);
    label(name, px, py, "700 12px", "#49382c");
  }
  for (const [route, kind, index] of data.routes) {
    const points = data.lines[kind][index].map(project);
    const row = route === "5" ? height * .76 : height * .29;
    const visible = points.filter(([px, py]) => px > 25 && px < width - 70 && py > 32 && py < height - 32);
    const point = visible.reduce((closest, p) => !closest || Math.abs(p[1] - row) < Math.abs(closest[1] - row)
      ? p : closest, null);
    if (point && (Math.abs(point[1] - (y - 42)) > 26 || Math.abs(point[0] - x) > 80)) {
      label(route === "5" ? "MO-5" : "AA", point[0], point[1], "750 11px", "#67311d");
    }
  }

  // The point of the pin stays on the real restaurant coordinates at every zoom.
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - 3, y - 6, x - 12, y - 13, x - 12, y - 23);
  ctx.arc(x, y - 23, 12, Math.PI, 0);
  ctx.bezierCurveTo(x + 12, y - 13, x + 3, y - 6, x, y);
  ctx.fillStyle = "#9f2923";
  ctx.fill();
  ctx.strokeStyle = "#fff9ef";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 23, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#fff9ef";
  ctx.fill();
  label("Spinners Pizza", x, y - 51, "800 13px", "#fff9ef", "#7f211b");

  const [distance, unit] = scaleChoices.find(([meters]) => meters * scale < width * .22) ?? scaleChoices.at(-1);
  ctx.strokeStyle = "#49382c";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(14, height - 15);
  ctx.lineTo(14, height - 10);
  ctx.lineTo(14 + distance * scale, height - 10);
  ctx.lineTo(14 + distance * scale, height - 15);
  ctx.stroke();
  ctx.font = "650 11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#38291f";
  ctx.fillText(unit, 14, height - 15);
  ctx.fillText("↑ N", 14, 25);
}

function install(data, ctx) {
  let zoom = 0;
  let manualZoom = null;
  let frame = 0;
  let drawnZoom;
  let drawnWidth;
  let drawnHeight;

  function queue() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function render() {
    frame = 0;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const focused = stage.matches(":focus-within");
    const target = focused ? manualZoom ?? focusZoom : exposureZoom(rect, window.innerHeight);
    if (reducedMotion.matches || drawnZoom === undefined || Math.abs(target - zoom) < .012) zoom = target;
    else zoom += (target - zoom) * .21;

    stage.dataset.mapMode = focused ? "focus" : "scroll";
    zoomIn.setAttribute("aria-disabled", String(focused && target >= maxZoom));
    zoomOut.setAttribute("aria-disabled", String(focused && target <= 0));
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (width !== drawnWidth || height !== drawnHeight) {
      canvas.width = drawnWidth = width;
      canvas.height = drawnHeight = height;
      drawnZoom = undefined;
    }
    if (drawnZoom !== zoom) {
      ctx.setTransform(width / rect.width, 0, 0, height / rect.height, 0, 0);
      paint(ctx, data, rect.width, rect.height, zoom);
      stage.dataset.zoom = zoom.toFixed(3);
      drawnZoom = zoom;
    }
    if (zoom !== target) queue();
  }

  canvas.addEventListener("click", () => {
    manualZoom = null;
    stage.focus({ preventScroll: true });
    queue();
  });
  for (const [button, amount] of [[zoomIn, .65], [zoomOut, -.65]]) {
    button.addEventListener("click", () => {
      button.focus({ preventScroll: true });
      manualZoom = clamp((manualZoom ?? zoom) + amount, 0, maxZoom);
      queue();
    });
  }
  stage.addEventListener("focusin", queue);
  stage.addEventListener("focusout", event => {
    if (!stage.contains(event.relatedTarget)) manualZoom = null;
    queue();
  });
  reducedMotion.addEventListener("change", queue);
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  new ResizeObserver(queue).observe(stage);

  map.hidden = false;
  fallback.hidden = true;
  render();
}

async function load() {
  const ctx = canvas.getContext("2d");
  if (!ctx || !ctx.roundRect) return;
  try {
    const response = await fetch(new URL("../data/grovespring-map.json?v=1", import.meta.url));
    if (!response.ok) return;
    const data = await response.json();
    if (!data.lines?.primary?.length || !Array.isArray(data.routes) || !Array.isArray(data.places)) return;
    install(data, ctx);
  } catch {
    map.hidden = true;
    fallback.hidden = false;
  }
}

load();
