import { createTornadoMotion } from "./tornado-motion.mjs?v=4";

const radians = Math.PI / 180;
const spriteScale = .86;
const gripRadius = .085;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const easeTravel = p => p * p * (3 - 2 * p);
const peelOutline = [
  [.032, .55], [.55, .54], [.63, .42], [.68, .26], [.81, .25], [.82, .17],
  [.96, .17], [.972, .29], [.936, .69], [.875, .79], [.66, .85], [.57, .66], [.032, .66],
];

function intersects(from, to, box, pad = 1) {
  let earliest = 0;
  let latest = 1;
  for (const [axis, low, high] of [["x", box.left, box.right], ["y", box.top, box.bottom]]) {
    const delta = to[axis] - from[axis];
    if (!delta) {
      if (from[axis] < low - pad || from[axis] > high + pad) return false;
      continue;
    }
    const a = (low - pad - from[axis]) / delta;
    const b = (high + pad - from[axis]) / delta;
    earliest = Math.max(earliest, Math.min(a, b));
    latest = Math.min(latest, Math.max(a, b));
    if (earliest > latest) return false;
  }
  return true;
}

function node(className) {
  const element = document.createElement("span");
  element.className = className;
  element.setAttribute("aria-hidden", "true");
  return element;
}

function polygon(points, project) {
  const path = new Path2D();
  const [start, ...rest] = points;
  path.moveTo(...project(...start));
  for (const point of rest) path.lineTo(...project(...point));
  path.closePath();
  return path;
}

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image.decode().then(() => image);
}

export function createChefPerformance({ root, avatar, pose, tornado, config, still }) {
  const layers = node("cg-performance");
  const wrist = node("cg-wrist");
  const peel = node("cg-moving-peel");
  const emitter = node("cg-peel-emitter");
  const bodyLayer = node("cg-rider-plane cg-body-layer");
  const propLayer = node("cg-rider-plane cg-prop-layer");
  const body = document.createElement("canvas");
  body.className = "cg-frame-art";
  body.width = body.height = 384;
  const ctx = body.getContext("2d");
  const grip = document.createElement("canvas");
  grip.className = "cg-grip-art";
  grip.width = grip.height = 72;
  const gripContext = grip.getContext("2d");
  root.style.setProperty("--cg-waist-y", `calc(var(--cg-avatar-width) * ${config.waistY})`);
  body.style.width = `${spriteScale * 100}%`;
  grip.style.width = `${spriteScale * gripRadius * 200}%`;
  peel.append(emitter);
  bodyLayer.append(body);
  wrist.append(peel, grip);
  propLayer.append(wrist);
  layers.append(bodyLayer, propLayer);
  pose.append(layers);
  const images = {};
  let current = null;
  let animation = 0;
  let aimFrame = 0;
  let speechTimer = 0;
  let idleTimer = 0;
  let dragTimer = 0;
  let traveling = false;
  let coastDone;
  let sweepReady = false;
  let shot = null;
  let ready = false;
  let speaking = false;

  const wake = config.tornado && createTornadoMotion({ root, avatar, tornado, art: config.tornado, waistY: config.waistY, still });

  function artOrigin(entry) {
    return [.5 - entry.waist[0] * spriteScale, config.waistY - entry.waist[1] * spriteScale];
  }

  function artPoint(entry, [u, v], size) {
    const [left, top] = artOrigin(entry);
    return [(left + u * spriteScale) * size, (top + v * spriteScale) * size];
  }

  function frame(name) {
    const entry = config.frames[name];
    if (!ready || !entry || !images[entry.sheet] || name === current) return false;
    current = name;
    const image = images[entry.sheet];
    const { columns = 1, rows = 1 } = config.images[entry.sheet];
    const width = image.naturalWidth / columns;
    const height = image.naturalHeight / rows;
    const [column, row] = entry.cell ?? [0, 0];
    const [x, y, w, h] = entry.crop ?? [0, 0, 1, 1];
    const registration = entry.registration ?? [0, 0];
    const [left, top] = artOrigin(entry);
    body.style.left = `${left * 100}%`;
    body.style.top = `${top * 100}%`;
    ctx.clearRect(0, 0, body.width, body.height);
    ctx.drawImage(image, (column + x) * width, (row + y) * height, w * width, h * height, registration[0] * body.width, registration[1] * body.height, body.width, body.height);
    // Lift the pointing fist out of the painted pose at the cuff.
    gripContext.clearRect(0, 0, grip.width, grip.height);
    grip.classList.toggle("cg-wrist-cutout", Boolean(entry.wrist));
    if (entry.grip) {
      const [u, v] = entry.grip;
      const cropX = u - gripRadius;
      const cropY = v - gripRadius;
      const [gripX, gripY] = artPoint(entry, [cropX, cropY], 100);
      const crop = gripRadius * 2 * body.width;
      grip.style.left = `${gripX}%`;
      grip.style.top = `${gripY}%`;
      gripContext.save();
      if (entry.wrist) {
        gripContext.clip(polygon(entry.wrist.cut, (x, y) => [
          (x - cropX) * grip.width / (2 * gripRadius),
          (y - cropY) * grip.height / (2 * gripRadius),
        ]));
      }
      gripContext.drawImage(body, cropX * body.width, cropY * body.height,
        crop, crop, 0, 0, grip.width, grip.height);
      gripContext.restore();
      if (entry.wrist) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.fill(polygon(entry.wrist.cut, (x, y) => [x * body.width, y * body.height]));
        ctx.restore();
      }
    }
    avatar.dataset.frame = name;
    return true;
  }

  function stopIdle() {
    clearTimeout(idleTimer);
    delete avatar.dataset.standby;
  }

  function park() {
    if (!ready) return;
    if (avatar.hasAttribute("data-standby") && !still() && !document.hidden) {
      restingProp();
      return;
    }
    stopIdle();
    frame("idle");
    restingProp();
    shot = null;
    sweepReady = false;
    if (!still() && !document.hidden) {
      avatar.dataset.standby = "";
      idleTimer = setTimeout(standby, 3100);
    }
  }

  function standby() {
    if (traveling || still() || document.hidden || !avatar.hasAttribute("data-standby")) return;
    frame("blink");
    idleTimer = setTimeout(() => {
      frame("idle");
      idleTimer = setTimeout(standby, 4200 + Math.random() * 1400);
    }, 120);
  }

  const poseFor = (target, position, viewport, side) => {
    const center = viewport.width / 2;
    const targetInMiddle = Math.abs(target.x - center) <= viewport.width * .18;
    const chefOnEdge = Math.abs(position.x + avatar.offsetWidth / 2 - center) >= viewport.width * .16;
    const facing = targetInMiddle && chefOnEdge ? "rear" : "front";
    return `${facing}-${side < 0 ? "left" : "right"}`;
  };

  function placeWrist(entry, side, size, restAngle = 0) {
    const width = size * config.prop.width;
    const height = width / images.peel.naturalWidth * images.peel.naturalHeight;
    const { grip: [gx, gy], tip: [tx, ty] } = config.prop;
    const [x, y] = artPoint(entry, entry.grip, size);
    const [wx, wy] = artPoint(entry, entry.wrist?.pivot ?? entry.grip, 100);
    wrist.style.transformOrigin = `${wx}% ${wy}%`;
    Object.assign(peel.style, { left: `${x - gx * width}px`, top: `${y - gy * height}px`, width: `${width}px`, height: `${height}px` });
    peel.style.transformOrigin = `${gx * 100}% ${gy * 100}%`;
    peel.style.transform = `scaleX(${side}) rotate(${restAngle}rad)`;
    [emitter.style.left, emitter.style.top] = [`${tx * 100}%`, `${ty * 100}%`];
    wrist.hidden = false;
  }

  function rotateWrist(theta, side) {
    wrist.style.transform = `rotate(${side * theta}rad)`;
  }

  function restingProp(side = 1) {
    if (!ready) return;
    const entry = config.frames[current];
    if (!entry?.grip) {
      wrist.hidden = true;
      return;
    }
    placeWrist(entry, side, avatar.offsetWidth, 1.05);
    rotateWrist(0, side);
  }

  function aim(position, target, viewport, side, animate = false) {
    if (!ready || traveling) return;
    stopIdle();
    clearTimeout(speechTimer);
    speaking = false;
    cancelAnimationFrame(aimFrame);
    const size = avatar.offsetWidth;
    const name = poseFor(target, position, viewport, side);
    const entry = config.frames[name];
    const [x, y] = artPoint(entry, entry.wrist.pivot, size);
    const [gripX, gripY] = artPoint(entry, entry.grip, size);
    const point = { x: target.x - position.x, y: target.y - position.y };
    const dx = (point.x - x) * side;
    const dy = point.y - y;
    const width = size * config.prop.width;
    const height = width / images.peel.naturalWidth * images.peel.naturalHeight;
    const barrel = config.prop.angle * radians;
    const [gx, gy] = config.prop.grip;
    const [tx, ty] = config.prop.tip;
    const relativeToWrist = ([u, v]) => [
      (gripX - x) * side + (u - gx) * width,
      gripY - y + (v - gy) * height,
    ];
    const [rx, ry] = relativeToWrist([tx, ty]);
    const offset = -Math.sin(barrel) * rx + Math.cos(barrel) * ry;
    const theta = Math.atan2(dy, dx) - barrel - Math.asin(clamp(offset / Math.max(1, Math.hypot(dx, dy)), -1, 1));
    const slew = clamp(theta, -Math.PI * .48, Math.PI * .48);
    const lens = { x: x + side * (Math.cos(slew) * rx - Math.sin(slew) * ry), y: y + Math.sin(slew) * rx + Math.cos(slew) * ry };
    const propCorners = peelOutline.map(point => {
      const [rx, ry] = relativeToWrist(point);
      return { x: x + side * (Math.cos(slew) * rx - Math.sin(slew) * ry), y: y + Math.sin(slew) * rx + Math.cos(slew) * ry };
    });
    const [u0, v0, u1, v1] = entry.head;
    const [left, top] = artPoint(entry, [u0, v0], size);
    const [right, bottom] = artPoint(entry, [u1, v1], size);
    const head = { left, top, right, bottom };
    const aimable = dx > 4 && (point.x - lens.x) * side > 4
      && Math.abs(theta - slew) < .03
      && !propCorners.some((corner, i) => intersects(corner, propCorners[(i + 1) % propCorners.length], head))
      && !intersects(lens, point, head, size * .018);
    if (!aimable) {
      delete avatar.dataset.pointing;
      frame("speak");
      restingProp();
      shot = null;
      sweepReady = false;
      return;
    }

    const alreadyAiming = current === name && sweepReady;
    frame(name);
    shot = { side };
    placeWrist(entry, side, size);
    sweepReady = true;
    avatar.dataset.pointing = name;
    // The wrist moves while the selected head pose holds still.
    if (animate && !still() && !alreadyAiming) {
      sweepReady = false;
      const started = performance.now();
      const rest = slew + .22;
      const sweep = now => {
        const t = clamp((now - started) / 180, 0, 1);
        rotateWrist(rest + (slew - rest) * easeTravel(t), side);
        if (t < 1) aimFrame = requestAnimationFrame(sweep);
        else sweepReady = true;
      };
      rotateWrist(rest, side);
      aimFrame = requestAnimationFrame(sweep);
    } else {
      rotateWrist(slew, side);
    }
  }

  function speak(onDone) {
    stopIdle();
    frame("speak");
    restingProp();
    delete avatar.dataset.pointing;
    sweepReady = false;
    shot = null;
    if (still()) onDone();
    else {
      speaking = true;
      speechTimer = setTimeout(() => { speaking = false; onDone(); }, 260);
    }
  }

  function cancel() {
    cancelAnimationFrame(animation);
    cancelAnimationFrame(aimFrame);
    clearTimeout(speechTimer);
    clearTimeout(dragTimer);
    traveling = sweepReady = speaking = false;
    coastDone = undefined;
    wrist.hidden = true;
    shot = null;
    delete avatar.dataset.travel;
    delete avatar.dataset.coast;
    layers.style.removeProperty("--cg-rider-lean");
    delete avatar.dataset.pointing;
    stopIdle();
    wake?.rest();
  }

  function endDrag() {
    clearTimeout(dragTimer);
    layers.style.removeProperty("--cg-rider-lean");
    wake?.rest();
  }

  function balance({ vx, speed, acceleration }) {
    const lean = clamp(vx * 8 + acceleration * 180, -13, 13);
    layers.style.setProperty("--cg-rider-lean", `${lean}deg`);
    const changed = frame(speed < .18 ? "idle" : Math.abs(vx) < .16 ? "glide" : vx < 0 ? "bank-left" : "bank-right");
    if (changed || wrist.hidden) restingProp();
  }

  function dragTo(position, at) {
    if (!ready || still()) return;
    const motion = wake?.sample(position, at);
    if (!motion) return;
    balance(motion);
    clearTimeout(dragTimer);
    dragTimer = setTimeout(() => {
      endDrag();
      frame("idle");
      restingProp();
    }, 110);
  }

  function stopCoast() {
    if (!coastDone) return;
    const done = coastDone;
    coastDone = undefined;
    cancelAnimationFrame(animation);
    delete avatar.dataset.coast;
    endDrag();
    done();
  }

  function coast(from, move, done) {
    const start = performance.now();
    const velocity = ready && !still() && !document.hidden && wake?.flickVelocity(start);
    if (!velocity) {
      endDrag();
      done();
      return;
    }
    clearTimeout(dragTimer);
    coastDone = done;
    avatar.dataset.coast = "";
    const duration = 285;
    let last = from;
    const tick = now => {
      if (still() || document.hidden) return stopCoast();
      const progress = clamp((now - start) / duration, 0, 1);
      const remaining = 1 - progress;
      // This curve starts at release velocity, then eases to a stop.
      const displacement = duration * (1 - remaining ** 3) / 3;
      const x = from.x + velocity.x * displacement;
      const y = from.y + velocity.y * displacement;
      const next = move(x, y);
      const atEdge = (next.x !== x || next.y !== y) && next.x === last.x && next.y === last.y;
      if (atEdge || progress === 1) return stopCoast();
      last = next;
      const motion = wake.sample(next, now, remaining ** 2);
      if (motion) balance(motion);
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  }

  function travel(from, to, move, onDone, minimumMs = 0) {
    cancel();
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (!ready || still()) {
      move(to.x, to.y, 1);
      onDone();
      return;
    }
    const hop = distance < 55;
    const duration = Math.max(minimumMs, hop ? 590 : clamp(870 + distance * 1.25, 1050, 1920));
    const start = performance.now();
    // Close destinations still get a visible hop, even when they share a dock.
    const nudge = distance < 12 ? (from.x > window.innerWidth / 2 ? -24 : 24) : 0;
    const turn = (nudge || to.x - from.x) < 0 ? "left" : "right";
    wake?.begin(from, start, 1.7);
    const stages = ["takeoff", `turn-${turn}`, `bank-${turn}`, "glide", `brake-${turn}`, "settle"];
    const beats = [.12, .24, .54, .77, .92, 1.01];
    traveling = true;
    avatar.dataset.travel = turn;
    avatar.dataset.flightMs = Math.round(duration);
    frame("takeoff");
    restingProp();
    const tick = now => {
      const progress = clamp((now - start) / duration, 0, 1);
      if (progress === 1 || still()) {
        traveling = false;
        delete avatar.dataset.travel;
        layers.style.removeProperty("--cg-rider-lean");
        move(to.x, to.y, 1);
        wake?.rest();
        onDone();
        return;
      }
      const t = easeTravel(progress);
      const arc = Math.sin(Math.PI * progress);
      const lift = arc * (hop ? 22 : Math.min(26, distance * .09));
      const position = {
        x: from.x + (to.x - from.x) * t + arc * nudge,
        y: from.y + (to.y - from.y) * t - lift,
      };
      move(position.x, position.y, progress);
      wake?.sample(position, now);
      // Lean into acceleration, then counterbalance as the tornado brakes under him.
      const lean = Math.sin(progress * 2 * Math.PI) * (turn === "left" ? -9 : 9);
      layers.style.setProperty("--cg-rider-lean", `${lean}deg`);
      const stage = stages[beats.findIndex(beat => progress < beat)];
      if (stage !== current) {
        frame(stage);
        restingProp(stage === "turn-left" ? -1 : 1);
      }
      animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  }

  const requiredImages = [];
  for (const [key, asset] of Object.entries(config.images)) {
    const loaded = loadImage(asset.src).then(image => { images[key] = image; });
    if (asset.optional) loaded.catch(() => {});
    else requiredImages.push(loaded);
  }
  Promise.all(requiredImages).then(() => {
    peel.style.backgroundImage = `url("${images.peel.src}")`;
    root.dataset.performer = "ready";
    ready = true;
    park();
  }).catch(() => { /* Keep the original transparent chef available if an asset fails. */ });

  return {
    get ready() { return ready; },
    get traveling() { return traveling; },
    get coasting() { return Boolean(coastDone); },
    get busy() { return speaking || Boolean(shot && !sweepReady); },
    get source() { return sweepReady && shot ? emitter : null; },
    get side() { return shot?.side; },
    aim, cancel, park, speak, travel, dragTo, endDrag, coast, stopCoast, wake,
  };
}
