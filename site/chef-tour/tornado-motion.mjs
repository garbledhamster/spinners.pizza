const radians = Math.PI / 180;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function prepareArt(src, use) {
  const image = new Image();
  image.src = src;
  image.decode().then(() => use(`url("${src}")`)).catch(() => {
    // The legacy funnel and gradient puffs are available if an atlas fails.
  });
}

export function createTornadoMotion({ root, avatar, tornado, art, waistY, still }) {
  const funnel = document.createElement("span");
  funnel.className = "cg-funnel";
  funnel.setAttribute("aria-hidden", "true");
  const spin = document.createElement("span");
  spin.className = "cg-funnel-frame";
  funnel.append(spin);
  tornado.after(funnel);
  const rim = funnel.cloneNode(true);
  rim.className = "cg-funnel-rim";
  rim.firstElementChild.className = "cg-rim-frame";
  tornado.parentElement.append(rim);

  prepareArt(art.spin, image => {
    root.style.setProperty("--cg-spin-art", image);
    root.style.setProperty("--cg-frame-count", art.frames);
    root.dataset.tornado = "ready";
  });
  prepareArt(art.dust, image => {
    root.style.setProperty("--cg-dust-art", image);
    root.style.setProperty("--cg-dust-size", "400% 100%");
  });

  const puffs = Array.from({ length: 44 }, () => {
    const puff = document.createElement("span");
    puff.className = "cg-dust";
    puff.setAttribute("aria-hidden", "true");
    puff.hidden = true;
    root.append(puff);
    return { element: puff, animation: null };
  });
  let previous;
  let width;
  let vx = 0;
  let vy = 0;
  let distanceSincePuff;
  let puffIndex = 0;

  function setSpinRate(rate) {
    for (const layer of [spin, rim.firstElementChild]) {
      for (const animation of layer.getAnimations()) animation.updatePlaybackRate(rate);
    }
  }

  function begin(position, now = performance.now(), spinRate = 1.45) {
    previous = { ...position, now };
    width = avatar.offsetWidth;
    vx = vy = 0;
    distanceSincePuff = 0;
    setSpinRate(spinRate);
  }

  function emit(position, direction, speed, bank, stretch, intensity) {
    const index = puffIndex++;
    const slot = puffs[index % puffs.length];
    const puff = slot.element;
    const widthPx = width * (.13 + index % 4 * .014 + speed * .043) * (.65 + intensity * .35);
    const spread = ((index % 5) - 2) * width * (.012 + speed * .004);
    const tipLength = .38 * stretch;
    const tipX = position.x + width * (.5 - tipLength * Math.sin(bank * radians));
    const tipY = position.y + width * (waistY + tipLength * Math.cos(bank * radians));
    const originX = tipX - direction.x * width * .075 - direction.y * spread;
    const originY = tipY - direction.y * width * .075 + direction.x * spread;
    const drift = width * .07 + speed * 47;
    const angle = Math.atan2(direction.y, direction.x) / radians;
    Object.assign(puff.style, {
      width: `${widthPx}px`,
      height: `${widthPx * .45}px`,
      left: `${originX}px`,
      top: `${originY}px`,
      backgroundPosition: `${(index % 4) * 100 / 3}% center`,
    });
    slot.animation?.cancel();
    puff.hidden = false;
    const offset = (x, y, scale) =>
      `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${angle}deg) scale(${scale})`;
    const animation = slot.animation = puff.animate([
      { transform: offset(0, 0, .78), opacity: .76 * intensity },
      { transform: offset(-direction.x * drift * .35, -direction.y * drift * .35 - 3, 1.05), opacity: .52 * intensity },
      { transform: offset(-direction.x * drift, -direction.y * drift - 9, 1.6), opacity: 0 },
    ], { duration: 400 + speed * 390 + index % 3 * 28, easing: "ease-out" });
    animation.onfinish = () => {
      if (slot.animation !== animation) return;
      slot.animation = null;
      puff.hidden = true;
    };
  }

  function sample(position, now = performance.now(), intensity = 1) {
    if (still() || document.hidden) return;
    if (!previous || now - previous.now > 180) {
      begin(position, now);
      return;
    }
    const start = previous;
    const dx = position.x - start.x;
    const dy = position.y - start.y;
    const distance = Math.hypot(dx, dy);
    const elapsed = Math.max(now - start.now, 8);
    previous = { ...position, now };
    const weight = 1 - Math.exp(-elapsed / 45);
    const lastVx = vx;
    vx += (dx / elapsed - vx) * weight;
    vy += (dy / elapsed - vy) * weight;
    const speed = clamp(Math.hypot(vx, vy), 0, 2.2);
    const bank = clamp(vx * 29, -27, 27);
    const stretch = 1 + speed * .125;
    avatar.style.setProperty("--cg-funnel-bank", `${bank}deg`);
    avatar.style.setProperty("--cg-funnel-stretch", stretch);
    if (distance > 0 && intensity > .08) {
      const spacing = Math.max(distance / 5, clamp(width * (.13 - speed * .018), 7, 20) * (1 + (1 - intensity) * .75));
      const direction = { x: dx / distance, y: dy / distance };
      // Space each puff along the path, including along large gaps between pointer events.
      const first = Math.max(0, spacing - distanceSincePuff);
      for (let along = first; along <= distance; along += spacing) {
        emit({ x: start.x + direction.x * along, y: start.y + direction.y * along },
          direction, speed, bank, stretch, intensity);
      }
      distanceSincePuff = (distanceSincePuff + distance) % spacing;
    }
    return { vx, speed, acceleration: (vx - lastVx) / elapsed };
  }

  function flickVelocity(now) {
    if (!previous || now - previous.now > 85) return;
    const speed = Math.hypot(vx, vy);
    if (speed < .42) return;
    const scale = Math.min(1, 1.1 / speed);
    return { x: vx * scale, y: vy * scale };
  }

  function rest() {
    previous = undefined;
    setSpinRate(1);
    avatar.style.removeProperty("--cg-funnel-bank");
    avatar.style.removeProperty("--cg-funnel-stretch");
  }

  function clear() {
    rest();
    for (const slot of puffs) {
      slot.animation?.cancel();
      slot.animation = null;
      slot.element.hidden = true;
    }
  }

  return { begin, sample, flickVelocity, rest, clear };
}
